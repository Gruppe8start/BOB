import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, KEYS, readJson, writeJson } from '../storage';
import type { DayUsage } from '../usageHistory';
import { secureGet, secureSet, secureWipe } from './secureStore';

// Sage protocol, after Hou et al. (2019) Study 2, as a day/stage state machine:
// day 0 baseline -> day 1 reflection + reminder card -> days 2-8 evening diary ->
// day 9 check-out -> maintenance. The LLM conversation parts are held for later: the
// reflection and diary are scripted question flows for now.

export type Stage = 'intro' | 'baseline' | 'waitReflection' | 'reflection' | 'card' | 'waitDiary' | 'diary' | 'checkout' | 'maintenance';

export type SageState = {
  startedAt: number | null;
  baselineMinutes: number | null;
  baselineSource: 'tracked' | 'self-report' | null;
  targetMinutes: number | null;
  selfCheckPreDone: boolean;
  reflectionDone: boolean;
  cardDone: boolean;
  diaryDays: string[];
  checkoutDone: boolean;
  lastWeeklyReflection: number | null;
  /** Days skipped ahead with the test switch (testing only). */
  dayOffset: number;
};

export const INITIAL_STATE: SageState = {
  startedAt: null,
  baselineMinutes: null,
  baselineSource: null,
  targetMinutes: null,
  selfCheckPreDone: false,
  reflectionDone: false,
  cardDone: false,
  diaryDays: [],
  checkoutDone: false,
  lastWeeklyReflection: null,
  dayOffset: 0,
};

export const DIARY_FIRST_DAY = 2;
export const DIARY_LAST_DAY = 8;
export const CHECKOUT_DAY = 9;

export const REFLECTION_QUESTIONS = [
  'How much time do you spend on social media per day and per week? How do you feel about that number?',
  'What other meaningful things could you do with that time?',
  'What would you gain from using social media less?',
  'Why do you use it? Is there another way to get the same thing?',
  'What negative effects do you notice from your use?',
];

export const WEEKLY_QUESTIONS = [
  'What went well with your social media use this week?',
  'What was hard?',
  'One strategy for the coming week:',
];

export type Card = { pros: string[]; cons: string[] };

export type DiaryEntry = {
  day: string;
  appsMinutes: Record<string, number> | null;
  howUsed: string;
  thoughts: string;
  mood: number;
  focus: number;
  strategy: string;
  expectedMinutes: number;
  actualMinutes: number | null;
};

export function loadSageState() {
  return readJson<SageState>(KEYS.sageState, INITIAL_STATE);
}

export function saveSageState(state: SageState) {
  return writeJson(KEYS.sageState, state);
}

/** Day index in the protocol: 0 on the start day. */
export function sageDay(state: SageState, now = new Date()) {
  if (state.startedAt === null) return -1;
  const start = new Date(`${dayKey(new Date(state.startedAt))}T00:00:00`).getTime();
  const today = new Date(`${dayKey(now)}T00:00:00`).getTime();
  return Math.round((today - start) / 86_400_000) + state.dayOffset;
}

/** The protocol day as a calendar day, so test-mode skips line up with diary keys. */
export function protocolDayKey(state: SageState) {
  const d = new Date();
  d.setDate(d.getDate() + state.dayOffset);
  return dayKey(d);
}

export function currentStage(state: SageState): Stage {
  if (state.startedAt === null) return 'intro';
  const day = sageDay(state);
  if (state.targetMinutes === null || !state.selfCheckPreDone) return 'baseline';
  if (!state.reflectionDone) return day >= 1 ? 'reflection' : 'waitReflection';
  if (!state.cardDone) return 'card';
  if (day < CHECKOUT_DAY) {
    if (day < DIARY_FIRST_DAY) return 'waitDiary';
    return 'diary';
  }
  if (!state.checkoutDone) return 'checkout';
  return 'maintenance';
}

/** Average daily minutes over the tracked days in the window, or null without data. */
export function averageUsage(history: Record<string, DayUsage>, days: string[]) {
  const tracked = days.filter(d => history[d]);
  if (tracked.length === 0) return null;
  return Math.round(tracked.reduce((s, d) => s + history[d].totalMinutes, 0) / tracked.length);
}

/** Maintenance: usage has been back near the baseline for about two weeks. */
export function relapseDetected(state: SageState, history: Record<string, DayUsage>, lastFourteen: string[]) {
  if (state.baselineMinutes === null) return false;
  const tracked = lastFourteen.filter(d => history[d]);
  if (tracked.length < 10) return false;
  const avg = averageUsage(history, lastFourteen) ?? 0;
  return avg >= state.baselineMinutes * 0.9;
}

/** Protocol "now", shifted by test-mode day skips. */
export function protocolNow(state: SageState) {
  return Date.now() + state.dayOffset * 86_400_000;
}

export function weeklyReflectionDue(state: SageState) {
  const since = state.lastWeeklyReflection ?? state.startedAt ?? protocolNow(state);
  return protocolNow(state) - since >= 7 * 86_400_000;
}

// ---- Sensitive data (secure storage) ----

export const loadReflection = () => secureGet<string[]>('reflection');
export const saveReflection = (answers: string[]) => secureSet('reflection', answers);
export const loadCard = () => secureGet<Card>('card');
export const saveCard = (card: Card) => secureSet('card', card);
export const loadSelfCheck = (when: 'pre' | 'post') => secureGet<number[]>(`selfcheck_${when}`);
export const saveSelfCheck = (when: 'pre' | 'post', answers: number[]) => secureSet(`selfcheck_${when}`, answers);
export const loadDiary = (day: string) => secureGet<DiaryEntry>(`diary_${day}`);
export const saveDiary = (entry: DiaryEntry) => secureSet(`diary_${entry.day}`, entry);
export const saveWeekly = (answers: string[]) => secureSet(`weekly_${dayKey()}`, answers);
export const saveFeedback = (feedback: { helpful: string; parts: string[] }) => secureSet('feedback', feedback);

/** Deletes everything Sage stored: protocol state and all sensitive entries. */
export async function deleteAllSageData() {
  await secureWipe();
  await AsyncStorage.removeItem(KEYS.sageState);
  await AsyncStorage.removeItem(KEYS.sageSafety);
}
