import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { BobProfile } from '../App';
import BobNative from '../modules/bob-native';
import { showAlert } from '../lib/alert';
import {
  alarmSupport,
  applyDistractionWatch,
  loadAlarmSettings,
  requestAlarmPermission,
  saveAlarmSettings,
  testAlarm,
  type AlarmSettings,
} from '../lib/distractionAlarm';
import { ensureNotificationPermission, notificationPermissionGranted, sendTestNudge } from '../lib/notifications';
import type { StreakState } from '../lib/streak';
import {
  getUsageAccess,
  pickDistractingAppsIos,
  requestUsageAccess,
  usageTrackingSupported,
  type UsageAccess,
} from '../lib/usage';
import { buildWidgetProps } from '../lib/widget';
import BobAvatar from './BobAvatar';
import UsageConsent from './UsageConsent';

type Props = {
  profile: BobProfile;
  streak: StreakState;
  onProfileChange: (profile: BobProfile) => void;
  onPermissionsChanged: () => void;
};

type Status = 'ready' | 'action' | 'off' | 'unavailable';

const COUNTDOWNS = [60, 180, 300];
const COOLDOWNS = [5, 10, 15];
const isWeb = Platform.OS === 'web';

export default function ReachPanel({ profile, streak, onProfileChange, onPermissionsChanged }: Props) {
  const [notifGranted, setNotifGranted] = useState(false);
  const [usageAccess, setUsageAccess] = useState<UsageAccess>('unavailable');
  const [alarm, setAlarm] = useState<AlarmSettings | null>(null);
  const [fullScreenOk, setFullScreenOk] = useState(true);
  const [consentVisible, setConsentVisible] = useState(false);

  const refresh = useCallback(async () => {
    setNotifGranted(await notificationPermissionGranted());
    setUsageAccess(await getUsageAccess());
    if (Platform.OS === 'android' && BobNative) setFullScreenOk(BobNative.canUseFullScreenIntent());
    setAlarm(await loadAlarmSettings(profile.reminderMode));
  }, [profile.reminderMode]);

  // Permissions are granted in system settings (or by installing the extension), so re-check
  // whenever the user comes back. HomeScreen re-syncs watchers and notifications on the same event.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function enableNotifications() {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (!isWeb) {
        showAlert('Blocked', 'Notifications are off for BOB. Turn them on in system settings.');
      } else if (Notification.permission === 'denied') {
        showAlert(
          'Notifications are blocked',
          'Click the icon left of the address bar → Notifications → Allow, then reload the page.'
        );
      } else {
        // Chrome sometimes hides the prompt behind a crossed-out bell in the address bar.
        showAlert(
          'No answer from the browser',
          'The permission prompt was closed or hidden. Look for a bell icon in the address bar, or click the icon left of it → Notifications → Allow.'
        );
      }
    }
    if (!profile.notificationsEnabled) onProfileChange({ ...profile, notificationsEnabled: true });
    await refresh();
    onPermissionsChanged();
  }

  async function testNudge() {
    const ok = await sendTestNudge(profile, streak);
    if (!ok) showAlert('Blocked', 'Allow notifications first.');
    else if (isWeb) showAlert('Sent', 'A notification arrives in 5 seconds. Switch to another tab to see it pop up.');
  }

  async function startUsageTracking() {
    setConsentVisible(false);
    if (!profile.usageTrackingEnabled) onProfileChange({ ...profile, usageTrackingEnabled: true });
    const access = await requestUsageAccess();
    setUsageAccess(access);
    if (isWeb && access !== 'granted') {
      showAlert(
        "Bob can't find the extension",
        'Install it with the steps below. If it is already installed, check it is switched on in chrome://extensions, then reload this page (Ctrl+R).'
      );
    }
    onPermissionsChanged();
  }

  async function stopUsageTracking() {
    const next = { ...profile, usageTrackingEnabled: false };
    onProfileChange(next);
    if (alarm) await applyDistractionWatch(next, alarm);
  }

  async function updateAlarm(next: AlarmSettings) {
    if (next.enabled && !alarm?.enabled) {
      const ok = await requestAlarmPermission();
      if (!ok && Platform.OS === 'ios') {
        showAlert('Alarms not allowed', 'Allow BOB to schedule alarms in Settings, or Bob falls back to notifications.');
      }
    }
    setAlarm(next);
    await saveAlarmSettings(next);
    try {
      await applyDistractionWatch(profile, next);
    } catch (error) {
      showAlert("Bob couldn't start watching", String(error));
    }
    refresh();
  }

  async function runTestAlarm() {
    const ok = await testAlarm();
    if (!ok) showAlert('Not allowed', isWeb ? 'Is the BOB extension installed and enabled?' : 'Allow alarms for BOB in Settings.');
    else if (!isWeb) showAlert('Armed', 'A real alarm rings in 10 seconds. Try silent mode.');
  }

  const trackingSupported = usageTrackingSupported();
  const trackingOn = profile.usageTrackingEnabled && usageAccess === 'granted';
  const support = alarmSupport();
  const notificationsSupported = !isWeb || (typeof window !== 'undefined' && 'Notification' in window);
  const notifReady = notifGranted && profile.notificationsEnabled;

  const usageStatus: Status = !trackingSupported
    ? 'unavailable'
    : !profile.usageTrackingEnabled
      ? 'off'
      : usageAccess === 'granted'
        ? 'ready'
        : 'action';

  const usageText =
    usageStatus === 'unavailable'
      ? 'Needs a development build (not Expo Go).'
      : usageStatus === 'off'
        ? isWeb
          ? 'Off. Opt in to let Bob see time spent on your distracting sites.'
          : 'Off. Opt in to let Bob see time spent in your distracting apps.'
        : usageAccess === 'needs-app-selection'
          ? 'Pick your distracting apps in the Screen Time list.'
          : usageAccess === 'needs-permission'
            ? isWeb
              ? 'Install the BOB browser extension (Chrome or Edge) so Bob can see your tabs.'
              : Platform.OS === 'android'
                ? 'Grant Usage Access to BOB in system settings.'
                : 'Allow Screen Time access.'
            : 'On. Duration only, never content or searches.';

  const alarmText = !trackingOn
    ? 'Needs app-usage tracking. Open a distracting app or site, a countdown starts, and an alarm fires if you stay.'
    : isWeb
      ? 'Full-page alarm with sound on the distracting tab. Stops only when you leave it. Returning during the cooldown rings again right away.'
      : Platform.OS === 'ios'
        ? support === 'alarmkit'
          ? 'AlarmKit: rings through Silent and Focus once you pass the countdown in your distracting apps.'
          : 'Needs iOS 26 for a real alarm. On this iPhone Bob sends a time-sensitive notification instead.'
        : fullScreenOk
          ? 'Rings until you leave the app. Reopen it during the cooldown and it rings again right away.'
          : 'Allow full-screen alerts for the loudest version. Without it Bob uses a heads-up alert.';

  return (
    <View>
      <Row
        icon="◉"
        title="In-app nudges"
        text="Bob pops into the corner when you idle, your streak is at risk, or you finish a block."
        status="ready"
      />

      <Row
        icon="✉"
        title="Notifications"
        text={
          !notificationsSupported
            ? "This browser doesn't support notifications."
            : notifReady
              ? `Max ${profile.reminderMode === 'Brutal' ? 3 : profile.reminderMode === 'Firm' ? 2 : 1}/day, fewer if you ignore them.${isWeb ? ' Delivered while a BOB tab is open.' : ''}`
              : isWeb
                ? 'Inactivity and streak-at-risk nudges while BOB is in a background tab.'
                : 'Inactivity and streak-at-risk nudges when BOB is closed.'
        }
        status={!notificationsSupported ? 'unavailable' : notifReady ? 'ready' : 'action'}
        actionLabel="Allow"
        onAction={enableNotifications}
      >
        {notifReady && (
          <View style={styles.inlineActions}>
            <Chip label="Send test nudge" onPress={testNudge} />
          </View>
        )}
      </Row>

      <Row
        icon="⏱"
        title="App-usage tracking"
        text={usageText}
        status={usageStatus}
        actionLabel={usageStatus === 'off' ? 'Opt in' : usageAccess === 'needs-app-selection' ? 'Pick apps' : isWeb ? 'Check' : 'Grant'}
        onAction={() => (usageStatus === 'off' ? setConsentVisible(true) : startUsageTracking())}
      >
        {isWeb && usageStatus === 'action' && (
          <View style={styles.steps}>
            <Text style={styles.step}>1. Open chrome://extensions (or edge://extensions)</Text>
            <Text style={styles.step}>2. Turn on Developer mode</Text>
            <Text style={styles.step}>3. Load unpacked → pick the BOB\browser-extension folder</Text>
            <Text style={styles.step}>4. Come back to this tab (it re-checks automatically)</Text>
          </View>
        )}
        {usageStatus === 'ready' && (
          <View style={styles.inlineActions}>
            {Platform.OS === 'ios' && (
              <Chip label="Change apps" onPress={async () => { await pickDistractingAppsIos(); refresh(); }} />
            )}
            <Chip label="Turn off" onPress={stopUsageTracking} />
          </View>
        )}
      </Row>

      <Row
        icon="⏰"
        title="Distraction alarm"
        text={alarmText}
        status={!trackingOn ? 'unavailable' : alarm?.enabled ? 'ready' : 'off'}
        right={
          trackingOn && alarm ? (
            <Switch
              value={alarm.enabled}
              onValueChange={enabled => updateAlarm({ ...alarm, enabled })}
              trackColor={{ false: '#2a2a2a', true: '#4a8f4d' }}
              thumbColor="#fff"
            />
          ) : undefined
        }
      >
        {trackingOn && alarm?.enabled && (
          <View>
            <Text style={styles.pickerLabel}>{Platform.OS === 'ios' ? 'Allowed use before alarm' : 'Countdown'}</Text>
            <View style={styles.inlineActions}>
              {COUNTDOWNS.map(s => (
                <Chip key={s} label={`${s / 60} min`} selected={alarm.countdownSeconds === s}
                  onPress={() => updateAlarm({ ...alarm, countdownSeconds: s })} />
              ))}
            </View>
            <Text style={styles.pickerLabel}>Cooldown</Text>
            <View style={styles.inlineActions}>
              {COOLDOWNS.map(m => (
                <Chip key={m} label={`${m} min`} selected={alarm.cooldownMinutes === m}
                  onPress={() => updateAlarm({ ...alarm, cooldownMinutes: m })} />
              ))}
            </View>
            <View style={styles.inlineActions}>
              {Platform.OS === 'android' && !fullScreenOk && (
                <Chip label="Allow full-screen" onPress={() => BobNative?.openFullScreenIntentSettings()} />
              )}
              {(isWeb || support === 'alarmkit') && <Chip label="Test alarm" onPress={runTestAlarm} />}
            </View>
          </View>
        )}
      </Row>

      <Row
        icon="□"
        title="Home screen widget"
        text={
          Platform.OS === 'ios'
            ? 'Long-press your home screen → + → BOB. Shows Bob, your streak and today’s nudge.'
            : Platform.OS === 'android'
              ? 'Long-press your home screen → Widgets → BOB. Tap it to jump back in.'
              : 'Browsers have no home screen widgets. This is how it looks on your phone:'
        }
        status={isWeb ? 'unavailable' : BobNative ? 'ready' : 'unavailable'}
      >
        {isWeb && <WidgetPreview profile={profile} streak={streak} />}
      </Row>

      <UsageConsent
        visible={consentVisible}
        onAccept={startUsageTracking}
        onDecline={() => setConsentVisible(false)}
      />
    </View>
  );
}

/** Web-only look-alike of the phone widget (widgets/BobAndroidWidget.tsx). */
function WidgetPreview({ profile, streak }: { profile: BobProfile; streak: StreakState }) {
  const props = buildWidgetProps(profile, streak);
  return (
    <View style={styles.widget}>
      <View style={styles.widgetTop}>
        <BobAvatar size={40} style={styles.widgetFace} />
        <View style={styles.widgetStreak}>
          <Text style={[styles.widgetCount, props.atRisk && styles.widgetCountRisk]}>{props.streak}</Text>
          <Text style={styles.widgetLabel}>DAY STREAK</Text>
        </View>
      </View>
      <Text style={styles.widgetNudge} numberOfLines={3}>{props.nudge}</Text>
    </View>
  );
}

function Row(props: {
  icon: string;
  title: string;
  text: string;
  status: Status;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const { icon, title, text, status, actionLabel, onAction, right, children } = props;
  const canAct = (status === 'action' || status === 'off') && actionLabel && onAction;
  const trailing = right ?? (canAct ? (
    <Pressable style={styles.button} onPress={onAction}>
      <Text style={styles.buttonText}>{actionLabel}</Text>
    </Pressable>
  ) : (
    <Text style={status === 'ready' ? styles.ready : styles.muted}>
      {status === 'ready' ? 'READY' : status === 'off' ? 'OFF' : '—'}
    </Text>
  ));
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, status !== 'ready' && styles.iconMuted]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{text}</Text>
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#171717', borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#244d2b', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconMuted: { backgroundColor: '#292929' },
  iconText: { color: '#fff' },
  copy: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  text: { color: '#777', fontSize: 12, lineHeight: 17 },
  ready: { color: '#6abf6a', fontSize: 10, fontWeight: '800', marginLeft: 8 },
  muted: { color: '#777', fontSize: 10, fontWeight: '800', marginLeft: 8 },
  button: { backgroundColor: '#4caf50', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginLeft: 44 },
  pickerLabel: { color: '#888', fontSize: 11, fontWeight: '700', marginTop: 12, marginLeft: 44 },
  steps: { marginTop: 10, marginLeft: 44, backgroundColor: '#1f1f1f', borderRadius: 8, padding: 10 },
  step: { color: '#bbb', fontSize: 12, lineHeight: 20 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1f1f1f' },
  chipSelected: { backgroundColor: '#4caf50', borderColor: '#4caf50' },
  chipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#fff', fontWeight: '800' },
  widget: { marginTop: 12, marginLeft: 44, width: 190, height: 120, backgroundColor: '#0d0d0d', borderRadius: 20, padding: 14, justifyContent: 'space-between', borderWidth: 1, borderColor: '#2a2a2a' },
  widgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  widgetFace: { borderRadius: 10 },
  widgetStreak: { alignItems: 'flex-end' },
  widgetCount: { color: '#4CAF50', fontSize: 24, fontWeight: '800' },
  widgetCountRisk: { color: '#FF7043' },
  widgetLabel: { color: '#777', fontSize: 9, fontWeight: '800' },
  widgetNudge: { color: '#fff', fontSize: 13 },
});
