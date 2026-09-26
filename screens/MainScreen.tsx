import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BobProfile } from '../App';
import { applyDistractionWatch, loadAlarmSettings } from '../lib/distractionAlarm';
import { replanNudges } from '../lib/notifications';
import { addLog, loadLogs, type SessionLog } from '../lib/sessions';
import { loadStreak, recordStudyToday, type StreakState } from '../lib/streak';
import { COLORS } from '../lib/theme';
import { getTodayUsage, type UsageSummary } from '../lib/usage';
import { loadUsageHistory, recordUsage, type DayUsage } from '../lib/usageHistory';
import { updateWidgets } from '../lib/widget';
import HomeScreen from './HomeScreen';
import SettingsScreen from './SettingsScreen';
import StatsScreen from './StatsScreen';

type Props = {
  profile: BobProfile;
  onProfileChange: (profile: BobProfile) => void;
};

type Tab = 'home' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'stats', label: 'Stats', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

/** Holds the shared day state and the bottom menu. All tabs stay mounted so a running session keeps ticking. */
export default function MainScreen({ profile, onProfileChange }: Props) {
  const [tab, setTab] = useState<Tab>('home');
  const [streak, setStreak] = useState<StreakState>({ count: 0, lastStudyDay: null });
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageHistory, setUsageHistory] = useState<Record<string, DayUsage>>({});
  const [logs, setLogs] = useState<SessionLog[]>([]);

  // Re-syncs everything that lives outside the app: notifications, widget, watchers, usage.
  const syncOutside = useCallback(async (currentStreak?: StreakState) => {
    const s = currentStreak ?? (await loadStreak());
    setStreak(s);
    setLogs(await loadLogs());
    const todayUsage = await getTodayUsage(profile.distractingApps);
    setUsage(todayUsage);
    setUsageHistory(todayUsage ? await recordUsage(todayUsage) : await loadUsageHistory());
    await Promise.allSettled([
      replanNudges(profile, s),
      updateWidgets(profile, s),
      loadAlarmSettings(profile.reminderMode).then(settings => applyDistractionWatch(profile, settings)),
    ]);
  }, [profile]);

  useEffect(() => {
    syncOutside();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncOutside();
    });
    return () => sub.remove();
  }, [syncOutside]);

  // Fresh numbers every time the stats open.
  useEffect(() => {
    if (tab === 'stats') syncOutside();
  }, [tab, syncOutside]);

  const handleSessionFinished = useCallback(async (log: SessionLog) => {
    setLogs(await addLog(log));
    const next = log.completed ? await recordStudyToday() : await loadStreak();
    await syncOutside(next);
    return next;
  }, [syncOutside]);

  return (
    <View style={styles.root}>
      <View style={[styles.page, tab !== 'home' && styles.hidden]}>
        <HomeScreen
          profile={profile}
          streak={streak}
          usage={usage}
          logs={logs}
          active={tab === 'home'}
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
      <View style={[styles.page, tab !== 'settings' && styles.hidden]}>
        <SettingsScreen
          profile={profile}
          streak={streak}
          onProfileChange={onProfileChange}
          onPermissionsChanged={syncOutside}
        />
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map(t => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1 },
  hidden: { display: 'none' },
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
