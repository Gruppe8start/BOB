import { dayKey, KEYS, readJson, writeJson } from './storage';

export type Exam = {
  id: string;
  name: string;
  /** Local day, "YYYY-MM-DD". */
  date: string;
  /** Set when it came from the device calendar, so it isn't suggested twice. */
  calendarEventId?: string;
};

export type Urgency = 'none' | 'soon' | 'close' | 'imminent';

export function loadExams() {
  return readJson<{ list: Exam[] }>(KEYS.exams, { list: [] }).then(v => v.list);
}

export function saveExams(list: Exam[]) {
  return writeJson(KEYS.exams, { list });
}

export function daysUntil(exam: Exam, from = new Date()) {
  const start = new Date(`${dayKey(from)}T00:00:00`).getTime();
  const end = new Date(`${exam.date}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function upcomingExams(list: Exam[]) {
  return list.filter(e => daysUntil(e) >= 0).sort((a, b) => a.date.localeCompare(b.date));
}

/** How hard nudges should push, based on the nearest exam. */
export function urgencyFor(days: number | null): Urgency {
  if (days === null || days > 14) return 'none';
  if (days > 7) return 'soon';
  if (days > 3) return 'close';
  return 'imminent';
}

export function nextExam(list: Exam[]) {
  const upcoming = upcomingExams(list);
  return upcoming.length > 0 ? { exam: upcoming[0], days: daysUntil(upcoming[0]) } : null;
}
