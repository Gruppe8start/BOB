import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, KEYS } from './storage';

/** A reusable session the user made, e.g. "Deep work · 50 min". */
export type SessionTemplate = {
  id: string;
  name: string;
  minutes: number;
};

/** One session the user actually ran (finished or ended early). */
export type SessionLog = {
  id: string;
  name: string;
  plannedMinutes: number;
  focusedMinutes: number;
  completed: boolean;
  startedAt: number;
  endedAt: number;
};

const DEFAULT_TEMPLATES: SessionTemplate[] = [
  { id: 'pomodoro', name: 'Pomodoro', minutes: 25 },
  { id: 'deep-work', name: 'Deep work', minutes: 50 },
  { id: 'quick-review', name: 'Quick review', minutes: 10 },
];

const LOG_RETENTION_DAYS = 60;

async function readArray<T>(key: string, fallback: T[]): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadTemplates() {
  return readArray<SessionTemplate>(KEYS.sessionTemplates, DEFAULT_TEMPLATES);
}

export async function saveTemplates(templates: SessionTemplate[]) {
  await AsyncStorage.setItem(KEYS.sessionTemplates, JSON.stringify(templates));
}

export function loadLogs() {
  return readArray<SessionLog>(KEYS.sessionLogs, []);
}

export async function addLog(log: SessionLog) {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 86_400_000;
  const logs = (await loadLogs()).filter(l => l.endedAt >= cutoff);
  logs.push(log);
  await AsyncStorage.setItem(KEYS.sessionLogs, JSON.stringify(logs));
  return logs;
}

export function logsForDay(logs: SessionLog[], day = dayKey()) {
  return logs.filter(l => dayKey(new Date(l.startedAt)) === day);
}

export function focusMinutes(logs: SessionLog[]) {
  return Math.round(logs.reduce((sum, l) => sum + l.focusedMinutes, 0));
}

/** The last `count` local days, oldest first, as day keys. */
export function lastDays(count: number) {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

/** 25 -> "25 min", 90 -> "1 h 30 min". */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}