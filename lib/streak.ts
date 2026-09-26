import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, KEYS, readJson, writeJson } from './storage';

export type StreakState = {
  count: number;
  lastStudyDay: string | null;
};

function daysBetween(fromDay: string, toDay: string) {
  const from = new Date(`${fromDay}T00:00:00`);
  const to = new Date(`${toDay}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export async function loadStreak(): Promise<StreakState> {
  const state = await readJson<StreakState>(KEYS.streak, { count: 0, lastStudyDay: null });
  if (state.lastStudyDay === null) {
    // Carry over the counter from the first version of the home screen.
    const legacy = await AsyncStorage.getItem(KEYS.legacyStreak);
    if (legacy) return { count: Number(legacy) || 0, lastStudyDay: null };
  }
  // A streak survives until the end of the day after the last study day.
  if (state.lastStudyDay && daysBetween(state.lastStudyDay, dayKey()) > 1) {
    return { count: 0, lastStudyDay: state.lastStudyDay };
  }
  return state;
}

export async function recordStudyToday(): Promise<StreakState> {
  const current = await loadStreak();
  const today = dayKey();
  if (current.lastStudyDay === today) return current;
  const next = { count: current.count + 1, lastStudyDay: today };
  await writeJson(KEYS.streak, next);
  return next;
}

export function studiedToday(state: StreakState) {
  return state.lastStudyDay === dayKey();
}
