import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BobProfile } from '../App';
import { setVoice } from '../lib/bobVoice';
import { isCalendarConnected, upcomingEvents, type CalendarEvent } from '../lib/calendar';
import { DEFAULT_LOOK, loadLook, saveLook, type KipLook } from '../lib/kipLook';
import { DEFAULT_PERSONALITY, loadPersonality, savePersonality, type Personality } from '../lib/personality';
import { applyDistractionWatch, loadAlarmSettings } from '../lib/distractionAlarm';
import { loadExams, nextExam, saveExams, type Exam } from '../lib/exams';
import { KipContext } from '../lib/kipContext';
import { replanNudges } from '../lib/notifications';
import { entitlements, FREE, loadSubscription, saveSubscription, type Subscription } from '../lib/plan';
import { INITIAL_STATE, loadCard, loadSageState, saveSageState, type Card, type SageState } from '../lib/sage/protocol';
import { planSageReminders } from '../lib/sage/reminders';
import { addLog, loadLogs, type SessionLog } from '../lib/sessions';
import { loadStreak, recordStudyToday, type StreakState } from '../lib/streak';
import { COLORS } from '../lib/theme';
import { getTodayUsage, type UsageSummary } from '../lib/usage';
import { loadUsageHistory, recordUsage, type DayUsage } from '../lib/usageHistory';
import { updateWidgets } from '../lib/widget';
import HomeScreen from './HomeScreen';
import PlansScreen from './PlansScreen';
import SageScreen from './SageScreen';
import SettingsScreen from './SettingsScreen';
import StatsScreen from './StatsScreen';

type Props = {
  profile: BobProfile;
  onProfileChange: (profile: BobProfile) => void;
  /** All data was deleted: go back to onboarding. */
  onReset: () => void;
};

type Tab = 'home' | 'stats' | 'sage' | 'settings';

/** Holds the shared day state and the bottom menu. All tabs stay mounted so a running session keeps ticking. */
export default function MainScreen({ profile, onProfileChange, onReset }: Props) {
  const [tab, setTab] = useState<Tab>('home');
  const [showPlans, setShowPlans] = useState(false);
  const [streak, setStreak] = useState<StreakState>({ count: 0, lastStudyDay: null });
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageHistory, setUsageHistory] = useState<Record<string, DayUsage>>({});
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [subscription, setSubscriptionState] = useState<Subscription>(FREE);
  const [personality, setPersonalityState] = useState<Personality>(DEFAULT_PERSONALITY);
  const [kipLook, setKipLookState] = useState<KipLook>(DEFAULT_LOOK);
  const [exams, setExamsState] = useState<Exam[]>([]);
  const [sage, setSage] = useState<SageState>(INITIAL_STATE);
  const [card, setCard] = useState<Card | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);

  const ent = entitlements(subscription);

  useEffect(() => {
    loadSubscription().then(setSubscriptionState);
    loadPersonality().then(setPersonalityState);
    loadLook().then(setKipLookState);
    loadExams().then(setExamsState);
    loadSageState().then(setSage);
    loadCard().then(setCard);
  }, []);

  // Kip's own phrases are part of his custom personality (Pro).
  useEffect(() => {
    setVoice({ phrases: ent.pro ? personality.phrases : [], mix: ent.pro ? personality.phraseMix : 0 });
  }, [personality, ent.pro]);

  const examContext = useMemo(() => {
    if (!ent.pro) return null;
    const next = nextExam(exams);
    return next ? { name: next.exam.name, days: next.days } : null;
  }, [exams, ent.pro]);

  const cardLine = useMemo(() => {
    if (!ent.sage || !card) return null;
    const lines = [...card.pros, ...card.cons];
    return lines[Math.floor(Math.random() * lines.length)] ?? null;
  }, [card, ent.sage]);

  // Re-syncs everything that lives outside the app: notifications, widget, watchers, usage, calendar.
  const syncOutside = useCallback(async (currentStreak?: StreakState) => {
    const s = currentStreak ?? (await loadStreak());
    setStreak(s);
    setLogs(await loadLogs());
    const todayUsage = await getTodayUsage(profile.distractingApps);
    setUsage(todayUsage);
    setUsageHistory(todayUsage ? await recordUsage(todayUsage) : await loadUsageHistory());
    const connected = ent.pro && (await isCalendarConnected().catch(() => false));
    setCalendarConnected(connected);
    setCalendarEvents(connected ? await upcomingEvents(30).catch(() => []) : []);
    await Promise.allSettled([
      replanNudges(profile, s, examContext),
      updateWidgets(profile, s, cardLine),
      ent.sage ? planSageReminders(sage) : Promise.resolve(),
      // Advanced accountability (distraction alarm) is a Pro feature.
      loadAlarmSettings(profile.reminderMode).then(settings =>
        applyDistractionWatch(profile, { ...settings, enabled: settings.enabled && ent.pro })
      ),
    ]);
  }, [profile, ent.pro, ent.sage, examContext, cardLine, sage]);

  useEffect(() => {
    syncOutside();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncOutside();
    });
    return () => sub.remove();
  }, [syncOutside]);

  useEffect(() => {
    if (tab === 'stats' || tab === 'sage') syncOutside();
  }, [tab]);

  // Leaving a paid plan hides the Sage tab.
  useEffect(() => {
    if (tab === 'sage' && !ent.sage) setTab('home');
  }, [ent.sage, tab]);

  const handleSessionFinished = useCallback(async (log: SessionLog) => {
    setLogs(await addLog(log));
    const next = log.completed ? await recordStudyToday() : await loadStreak();
    await syncOutside(next);
    return next;
  }, [syncOutside]);

  const context = useMemo(() => ({
    subscription,
    ent,
    setSubscription: (sub: Subscription) => {
      setSubscriptionState(sub);
      saveSubscription(sub);
    },
    personality,
    setPersonality: (next: Personality) => {
      setPersonalityState(next);
      savePersonality(next);
    },
    kipLook,
    setKipLook: (look: KipLook) => {
      setKipLookState(look);
      saveLook(look);
    },
    exams,
    setExams: (list: Exam[]) => {
      setExamsState(list);
      saveExams(list);
    },
    openPlans: () => setShowPlans(true),
  }), [subscription, personality, kipLook, exams]);

  const sageLimit =
    ent.sage && card && sage.targetMinutes !== null && usage && usage.totalMinutes >= sage.targetMinutes && cardLine
      ? { cardLine, minutes: usage.totalMinutes, target: sage.targetMinutes }
      : null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: 'stats', label: 'Stats', icon: '▤' },
    ...(ent.sage ? [{ id: 'sage' as Tab, label: 'Sage', icon: '❀' }] : []),
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <KipContext.Provider value={context}>
      <View style={styles.root}>
        <View style={[styles.page, tab !== 'home' && styles.hidden]}>
          <HomeScreen
            profile={profile}
            streak={streak}
            usage={usage}
            logs={logs}
            active={tab === 'home' && !showPlans}
            exam={examContext}
            sageLimit={sageLimit}
            calendarEvents={calendarEvents}
            calendarConnected={calendarConnected}
            onSessionFinished={handleSessionFinished}
          />
        </View>
        <View style={[styles.page, tab !== 'stats' && styles.hidden]}>
          <StatsScreen
            profile={profile}
            streak={streak}
            usage={usage}
            usageHistory={usageHistory}
            logs={logs}
            onOpenSettings={() => setTab('settings')}
          />
        </View>
        {ent.sage && (
          <View style={[styles.page, tab !== 'sage' && styles.hidden]}>
            <SageScreen
              state={sage}
              card={card}
              usage={usage}
              usageHistory={usageHistory}
              onStateChange={next => {
                setSage(next);
                saveSageState(next);
                planSageReminders(next);
              }}
              onCardChange={setCard}
            />
          </View>
        )}
        <View style={[styles.page, tab !== 'settings' && styles.hidden]}>
          <SettingsScreen
            profile={profile}
            streak={streak}
            onProfileChange={onProfileChange}
            onPermissionsChanged={syncOutside}
            onCalendarChanged={syncOutside}
            onDataDeleted={onReset}
          />
        </View>

        <View style={styles.tabBar} accessibilityRole="tablist">
          {tabs.map(t => {
            const selected = tab === t.id;
            return (
              <Pressable
                key={t.id}
                style={styles.tab}
                onPress={() => setTab(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabIcon, selected && styles.tabSelected]}>{t.icon}</Text>
                <Text style={[styles.tabLabel, selected && styles.tabSelected]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {showPlans && (
          <View style={styles.overlay}>
            <PlansScreen onClose={() => setShowPlans(false)} />
          </View>
        )}
      </View>
    </KipContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1 },
  hidden: { display: 'none' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.bg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 20, color: COLORS.textMuted },
  tabLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  tabSelected: { color: COLORS.accentSoft },
});
