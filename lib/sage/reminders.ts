import { cancelNudge, notificationPermissionGranted, scheduleNudge } from '../notifications';
import { readJson, writeJson } from '../storage';
import { BCT } from './bct';
import { CHECKOUT_DAY, DIARY_FIRST_DAY, DIARY_LAST_DAY, protocolNow, sageDay, type SageState } from './protocol';

const REMINDER_KEY = 'kip_sage_reminders';
const DIARY_HOUR = 21;

// Prompts/cues (BCT 7.1): the evening diary reminder "before bedtime" and the weekly check-in.
export const REMINDER_BCT = BCT.prompts;

/** Replaces Sage's scheduled reminders with the ones the current protocol day needs. */
export async function planSageReminders(state: SageState) {
  const { ids } = await readJson<{ ids: string[] }>(REMINDER_KEY, { ids: [] });
  for (const id of ids) await cancelNudge(id);
  if (state.startedAt === null || !(await notificationPermissionGranted())) {
    await writeJson(REMINDER_KEY, { ids: [] });
    return;
  }

  const day = sageDay(state);
  const next: string[] = [];
  const at = (daysAhead: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  if (!state.checkoutDone) {
    // Diary evenings still ahead (days 2-8), plus the check-out day.
    for (let ahead = 0; ahead <= 8; ahead++) {
      const protocolDay = day + ahead;
      const fireAt = at(ahead, DIARY_HOUR);
      if (fireAt <= Date.now()) continue;
      if (protocolDay >= DIARY_FIRST_DAY && protocolDay <= DIARY_LAST_DAY) {
        next.push(await scheduleNudge('Kip · evening diary', 'Two minutes to look back at today, no judgment.', 'sageLimit', fireAt));
      } else if (protocolDay === CHECKOUT_DAY) {
        next.push(await scheduleNudge('Kip · your Sage week', 'Time for a short check-out and to see your progress.', 'sageLimit', at(ahead, 18)));
      }
    }
  } else {
    const since = state.lastWeeklyReflection ?? state.startedAt;
    const due = since + 7 * 86_400_000 - (protocolNow(state) - Date.now());
    const d = new Date(Math.max(due, Date.now() + 60_000));
    d.setHours(19, 0, 0, 0);
    if (d.getTime() > Date.now()) {
      next.push(await scheduleNudge('Kip · weekly check-in', 'Three quick questions about your week.', 'sageLimit', d.getTime()));
    }
  }

  await writeJson(REMINDER_KEY, { ids: next });
}
