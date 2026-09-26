import { Platform } from 'react-native';
import { dayKey, KEYS, readJson, writeJson } from './storage';

// The function API lives under /legacy since SDK 57; the default entry exposes the new class API.
type CalendarModule = typeof import('expo-calendar/legacy');

function calendarModule(): CalendarModule | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-calendar/legacy');
  } catch {
    return null;
  }
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
};

export type FreeSlot = { start: number; end: number };

const EXAM_WORDS = /\b(exam|exams|examen|prüfung|pruefung|klausur|test|midterm|final|quiz|assessment)\b/i;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const MIN_SLOT_MINUTES = 45;

export function calendarSupported() {
  return calendarModule() !== null;
}

export async function isCalendarConnected() {
  const Cal = calendarModule();
  if (!Cal) return false;
  const { connected } = await readJson(KEYS.calendar, { connected: false });
  return connected && (await Cal.getCalendarPermissionsAsync()).granted;
}

export async function connectCalendar() {
  const Cal = calendarModule();
  if (!Cal) return false;
  const { granted } = await Cal.requestCalendarPermissionsAsync();
  await writeJson(KEYS.calendar, { connected: granted });
  return granted;
}

export async function disconnectCalendar() {
  await writeJson(KEYS.calendar, { connected: false });
}

/** Events from all device calendars between now and `days` days ahead. Read-only. */
export async function upcomingEvents(days: number): Promise<CalendarEvent[]> {
  const Cal = calendarModule();
  if (!Cal || !(await isCalendarConnected())) return [];
  const calendars = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  if (calendars.length === 0) return [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + days * 86_400_000);
  const events = await Cal.getEventsAsync(calendars.map(c => c.id), start, end);
  return events.map(e => ({
    id: e.id,
    title: e.title ?? '',
    start: new Date(e.startDate).getTime(),
    end: new Date(e.endDate).getTime(),
    allDay: !!e.allDay,
  }));
}

export function looksLikeExam(event: CalendarEvent) {
  return EXAM_WORDS.test(event.title);
}

export function examDay(event: CalendarEvent) {
  return dayKey(new Date(event.start));
}

/** Gaps of 45+ minutes between 08:00 and 22:00 on the given day, ignoring all-day events. */
export function freeSlots(events: CalendarEvent[], day = new Date()): FreeSlot[] {
  const dayStart = new Date(day);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
  let cursor = Math.max(dayStart.getTime(), dayKey(day) === dayKey() ? Date.now() : 0);

  const busy = events
    .filter(e => !e.allDay && e.end > cursor && e.start < dayEnd.getTime())
    .sort((a, b) => a.start - b.start);

  const slots: FreeSlot[] = [];
  for (const event of busy) {
    if (event.start - cursor >= MIN_SLOT_MINUTES * 60_000) slots.push({ start: cursor, end: event.start });
    cursor = Math.max(cursor, event.end);
  }
  if (dayEnd.getTime() - cursor >= MIN_SLOT_MINUTES * 60_000) slots.push({ start: cursor, end: dayEnd.getTime() });
  return slots;
}
