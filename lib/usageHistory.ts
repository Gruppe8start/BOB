import { dayKey, KEYS, readJson, writeJson } from './storage';
import type { UsageSummary } from './usage';

export type DayUsage = {
  totalMinutes: number;
  /** Minutes per app label; absent on iOS, where Screen Time only reports a total. */
  perApp?: Record<string, number>;
};

type History = Record<string, DayUsage>;

const RETENTION_DAYS = 30;

export function loadUsageHistory() {
  return readJson<History>(KEYS.usageHistory, {});
}

/**
 * Keeps a per-day snapshot of distraction time. The platforms only answer "how much
 * today", so the history is built up from the snapshots taken whenever the app is open.
 */
export async function recordUsage(summary: UsageSummary) {
  const history = await loadUsageHistory();
  history[dayKey()] = { totalMinutes: summary.totalMinutes, perApp: summary.perApp };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  for (const day of Object.keys(history)) {
    if (day < dayKey(cutoff)) delete history[day];
  }
  await writeJson(KEYS.usageHistory, history);
  return history;
}
