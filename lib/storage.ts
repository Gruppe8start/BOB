import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  profile: 'bob_profile',
  legacyStreak: 'bob_streak',
  streak: 'bob_streak_v2',
  lastActive: 'bob_last_active',
  nudgeStats: 'bob_nudge_stats',
  alarmSettings: 'bob_alarm_settings',
  usageConsent: 'bob_usage_consent',
  sessionTemplates: 'bob_session_templates',
  sessionLogs: 'bob_session_logs',
  usageHistory: 'bob_usage_history',
} as const;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return fallback;
  try {
    return { ...fallback, ...JSON.parse(value) };
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

// Local calendar day, e.g. "2026-09-25". Streaks are per local day, not UTC.
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
