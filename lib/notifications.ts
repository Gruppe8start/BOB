import { Asset } from 'expo-asset';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { BobProfile } from '../App';
import { bobLine, type Trigger } from './bobVoice';
import { dayKey, KEYS, readJson, writeJson } from './storage';
import { urgencyFor } from './exams';
import { studiedToday, type StreakState } from './streak';

const CHANNEL_ID = 'bob-nudges';
const NUDGE_TAG = 'bob-nudge';

// Hard ceiling from the feasibility doc: notification fatigue is the #1 uninstall cause.
const MAX_PER_DAY = 3;
const BASE_CAP = { Chill: 1, Firm: 2, Brutal: 3 } as Record<string, number>;
const BASE_INACTIVITY_HOURS = { Chill: 24, Firm: 8, Brutal: 4 } as Record<string, number>;
const QUIET_START = 22;
const QUIET_END = 9;

type PlannedNudge = { id: string; fireAt: number; trigger: Trigger };

type NudgeStats = {
  planned: PlannedNudge[];
  ignoredStreak: number;
  lastTapAt: number;
  firedByDay: Record<string, number>;
};

const EMPTY_STATS: NudgeStats = { planned: [], ignoredStreak: 0, lastTapAt: 0, firedByDay: {} };

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Kip nudges',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#4CAF50',
  });
}

// ---- Web: the browser Notification API. Timers only live while the BOB tab is open;
// reaching a closed tab would need Web Push and a server.
const webTimers = new Map<string, ReturnType<typeof setTimeout>>();
const webShown = new Set<string>();
let nextWebId = 0;

function webNotificationsSupported() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;
}

function showWebNotification(title: string, body: string) {
  const notification = new Notification(title, {
    body,
    icon: Asset.fromModule(require('../assets/bob-avatar.png')).uri,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
    recordTap();
  };
}

export async function notificationPermissionGranted() {
  if (Platform.OS === 'web') return webNotificationsSupported() && Notification.permission === 'granted';
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    if (!webNotificationsSupported()) return false;
    if (Notification.permission !== 'default') return Notification.permission === 'granted';
    return (await Notification.requestPermission()) === 'granted';
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  await setupNotificationChannels();
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return result.granted;
}

// Tapping a nudge counts as engagement and resets the back-off.
async function recordTap() {
  const stats = await readJson<NudgeStats>(KEYS.nudgeStats, EMPTY_STATS);
  await writeJson(KEYS.nudgeStats, { ...stats, lastTapAt: Date.now(), ignoredStreak: 0 });
}

export function listenForNudgeTaps() {
  return Notifications.addNotificationResponseReceivedListener(response => {
    if (response.notification.request.content.data?.tag === NUDGE_TAG) recordTap();
  });
}

export async function scheduleNudge(title: string, body: string, trigger: Trigger, fireAt: number): Promise<string> {
  if (Platform.OS === 'web') {
    const id = `web-${Date.now()}-${nextWebId++}`;
    webTimers.set(id, setTimeout(() => {
      webTimers.delete(id);
      webShown.add(id);
      showWebNotification(title, body);
    }, fireAt - Date.now()));
    return id;
  }
  const attachmentUri = Platform.OS === 'ios' ? await bobAvatarUri() : null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { tag: NUDGE_TAG, trigger },
      // Rich notification: Kip's face as a large attachment on iOS.
      attachments: attachmentUri ? [{ identifier: 'bob', url: attachmentUri, type: 'image' }] : undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(fireAt),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelNudge(id: string) {
  if (id.startsWith('web-')) {
    clearTimeout(webTimers.get(id));
    webTimers.delete(id);
    return;
  }
  if (Platform.OS !== 'web') await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Sends one nudge in 5 seconds so the user can see what they look like. Not counted in the cap. */
export async function sendTestNudge(profile: BobProfile, streak: StreakState) {
  if (!(await ensureNotificationPermission())) return false;
  const line = bobLine('inactivity', profile.reminderMode, { name: profile.name, streak: streak.count });
  await scheduleNudge(line.title, line.body, 'inactivity', Date.now() + 5_000);
  return true;
}

let avatarUri: string | null | undefined;
async function bobAvatarUri() {
  if (avatarUri !== undefined) return avatarUri;
  try {
    const [asset] = await Asset.loadAsync(require('../assets/bob-avatar.png'));
    avatarUri = asset.localUri ?? null;
  } catch {
    avatarUri = null;
  }
  return avatarUri;
}

function clampToWakingHours(time: number) {
  const date = new Date(time);
  if (date.getHours() >= QUIET_START) {
    date.setDate(date.getDate() + 1);
    date.setHours(QUIET_END, 0, 0, 0);
  } else if (date.getHours() < QUIET_END) {
    date.setHours(QUIET_END, 0, 0, 0);
  }
  return date.getTime();
}

function atTime(daysFromNow: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

// Updates the adaptive back-off from nudges that already fired since the last plan.
function settleFiredNudges(stats: NudgeStats, now: number): NudgeStats {
  // A web nudge only fired if its tab stayed open; ones from an earlier page load never showed.
  const fired = stats.planned.filter(n => n.fireAt <= now && (!n.id.startsWith('web-') || webShown.has(n.id)));
  const firedByDay = { ...stats.firedByDay };
  for (const nudge of fired) {
    const day = dayKey(new Date(nudge.fireAt));
    firedByDay[day] = (firedByDay[day] ?? 0) + 1;
  }
  const earliest = Math.min(...fired.map(n => n.fireAt));
  const engaged = fired.length > 0 && stats.lastTapAt >= earliest;
  const ignoredStreak = engaged ? 0 : stats.ignoredStreak + fired.length;

  // Only today's and tomorrow's counters matter for the cap.
  const keep = new Set([dayKey(), dayKey(new Date(now + 86_400_000))]);
  for (const day of Object.keys(firedByDay)) if (!keep.has(day)) delete firedByDay[day];

  return { ...stats, planned: [], ignoredStreak, firedByDay };
}

/**
 * Cancels Kip's pending nudges and schedules the next ~48h worth, respecting the
 * per-day cap and backing off when the user keeps ignoring them. Call it whenever
 * the app is opened or the user finishes a study block.
 */
export type ExamContext = { name: string; days: number } | null;

export async function replanNudges(profile: BobProfile, streak: StreakState, exam: ExamContext = null) {
  const previous = await readJson<NudgeStats>(KEYS.nudgeStats, EMPTY_STATS);
  const stats = settleFiredNudges(previous, Date.now());
  for (const nudge of previous.planned) await cancelNudge(nudge.id);

  if (!profile.notificationsEnabled || !(await notificationPermissionGranted())) {
    await writeJson(KEYS.nudgeStats, stats);
    return;
  }

  const mode = profile.reminderMode;
  const backOff = stats.ignoredStreak >= 6 ? 2 : stats.ignoredStreak >= 3 ? 1 : 0;
  // Exam countdown (Pro): nudges get more frequent as the exam approaches, never above the hard cap.
  const urgency = urgencyFor(exam?.days ?? null);
  const examBoost = urgency === 'close' || urgency === 'imminent' ? 1 : 0;
  const examGap = urgency === 'imminent' ? 0.4 : urgency === 'close' ? 0.6 : urgency === 'soon' ? 0.8 : 1;
  const dailyCap = Math.max(1, Math.min(MAX_PER_DAY, (BASE_CAP[mode] ?? 2) - backOff + examBoost));
  const gapHours = (BASE_INACTIVITY_HOURS[mode] ?? 8) * (1 + Math.min(stats.ignoredStreak, 6) * 0.25) * examGap;
  const now = Date.now();

  // Streak-at-risk nudges come first so the cap never crowds them out.
  const candidates: { fireAt: number; trigger: Trigger }[] = [];
  if (streak.count > 0) {
    if (!studiedToday(streak)) {
      candidates.push({ fireAt: atTime(0, 20, 0), trigger: 'streakAtRisk' });
      if (mode === 'Brutal') candidates.push({ fireAt: atTime(0, 21, 45), trigger: 'streakAtRisk' });
    }
    candidates.push({ fireAt: atTime(1, 20, 0), trigger: 'streakAtRisk' });
  }
  if (exam && urgency !== 'none') {
    candidates.push({ fireAt: atTime(0, 9, 30), trigger: 'examSoon' });
    candidates.push({ fireAt: atTime(1, 9, 30), trigger: 'examSoon' });
  }
  candidates.push({ fireAt: clampToWakingHours(now + gapHours * 3_600_000), trigger: 'inactivity' });
  candidates.push({ fireAt: clampToWakingHours(now + 2 * gapHours * 3_600_000), trigger: 'inactivity' });

  const perDay = { ...stats.firedByDay };
  const planned: PlannedNudge[] = [];

  for (const candidate of candidates) {
    if (candidate.fireAt <= now + 60_000) continue;
    if (planned.some(p => Math.abs(p.fireAt - candidate.fireAt) < 2 * 3_600_000)) continue;
    const day = dayKey(new Date(candidate.fireAt));
    if ((perDay[day] ?? 0) >= dailyCap) continue;

    const examDays = exam ? exam.days - (dayKey(new Date(candidate.fireAt)) === dayKey() ? 0 : 1) : 0;
    const line = bobLine(candidate.trigger, mode, { name: profile.name, streak: streak.count, exam: exam?.name ?? '', days: examDays });
    const id = await scheduleNudge(line.title, line.body, candidate.trigger, candidate.fireAt);
    perDay[day] = (perDay[day] ?? 0) + 1;
    planned.push({ id, fireAt: candidate.fireAt, trigger: candidate.trigger });
  }

  await writeJson(KEYS.nudgeStats, { ...stats, planned });
}
