import { focusMinutes, lastDays, logsForDay, type SessionLog } from './sessions';
import type { DayUsage } from './usageHistory';

export type Bucket = { label: string; minutes: number };

const DAY_PARTS: { label: string; from: number; to: number }[] = [
  { label: 'Morning', from: 5, to: 10 },
  { label: 'Midday', from: 10, to: 14 },
  { label: 'Afternoon', from: 14, to: 18 },
  { label: 'Evening', from: 18, to: 22 },
  { label: 'Night', from: 22, to: 29 }, // 22:00-05:00
];

/** Focused minutes by time of day over the last `days` days. */
export function focusByDayPart(logs: SessionLog[], days = 28): Bucket[] {
  const cutoff = Date.now() - days * 86_400_000;
  const totals = DAY_PARTS.map(p => ({ label: p.label, minutes: 0 }));
  for (const log of logs) {
    if (log.startedAt < cutoff) continue;
    let hour = new Date(log.startedAt).getHours();
    if (hour < 5) hour += 24;
    const index = DAY_PARTS.findIndex(p => hour >= p.from && hour < p.to);
    if (index >= 0) totals[index].minutes += log.focusedMinutes;
  }
  return totals;
}

/** Focused minutes per day for the last `weeks` whole weeks, oldest first. */
export function studyHistory(logs: SessionLog[], weeks = 5) {
  return lastDays(weeks * 7).map(day => ({ day, minutes: focusMinutes(logsForDay(logs, day)) }));
}

export type WeekTrend = { label: string; avgLength: number; sessions: number; completionRate: number };

/** Average session length and completion rate per week, last 4 weeks, oldest first. */
export function sessionLengthTrend(logs: SessionLog[]): WeekTrend[] {
  const weeks: WeekTrend[] = [];
  for (let w = 3; w >= 0; w--) {
    const end = Date.now() - w * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    const inWeek = logs.filter(l => l.startedAt >= start && l.startedAt < end);
    const done = inWeek.filter(l => l.completed).length;
    weeks.push({
      label: w === 0 ? 'This wk' : `${w} wk ago`,
      avgLength: inWeek.length ? Math.round(inWeek.reduce((s, l) => s + l.focusedMinutes, 0) / inWeek.length) : 0,
      sessions: inWeek.length,
      completionRate: inWeek.length ? Math.round((done / inWeek.length) * 100) : 0,
    });
  }
  return weeks;
}

export type Period = { focus: number; sessions: number; distracted: number | null; studyDays: number };

function period(logs: SessionLog[], usage: Record<string, DayUsage>, days: string[]): Period {
  const dayLogs = days.map(d => logsForDay(logs, d));
  const tracked = days.filter(d => usage[d]);
  return {
    focus: dayLogs.reduce((s, l) => s + focusMinutes(l), 0),
    sessions: dayLogs.reduce((s, l) => s + l.length, 0),
    distracted: tracked.length ? tracked.reduce((s, d) => s + usage[d].totalMinutes, 0) : null,
    studyDays: dayLogs.filter(l => l.some(x => x.completed)).length,
  };
}

/** This week (last 7 days) against the 7 days before. */
export function weekOverWeek(logs: SessionLog[], usage: Record<string, DayUsage>) {
  const fourteen = lastDays(14);
  return {
    thisWeek: period(logs, usage, fourteen.slice(7)),
    lastWeek: period(logs, usage, fourteen.slice(0, 7)),
  };
}

/** Longest run of consecutive study days in the history, and the best single day. */
export function records(logs: SessionLog[]) {
  const history = studyHistory(logs, 8);
  let best = 0;
  let run = 0;
  let bestDay = { day: '', minutes: 0 };
  for (const d of history) {
    run = d.minutes > 0 ? run + 1 : 0;
    best = Math.max(best, run);
    if (d.minutes > bestDay.minutes) bestDay = d;
  }
  return { longestStreak: best, bestDay };
}
