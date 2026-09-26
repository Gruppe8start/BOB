import type { BobProfile } from '../App';
import { bobLine, type Trigger } from './bobVoice';
import { studiedToday, type StreakState } from './streak';
import type { UsageSummary } from './usage';

export type PopupEvent = {
  trigger: Trigger;
  title: string;
  body: string;
  actionLabel: string;
  /** Kip speaking from his warm Sage side (add-on). */
  sage?: boolean;
};

const INACTIVITY_MINUTES = { Chill: 10, Firm: 5, Brutal: 2 } as Record<string, number>;
const DISTRACTION_MINUTES = { Chill: 60, Firm: 30, Brutal: 15 } as Record<string, number>;
const STREAK_RISK_HOUR = 18;
const EXAM_POPUP_DAYS = 7;

export type TriggerContext = {
  profile: BobProfile;
  streak: StreakState;
  usage: UsageSummary | null;
  isFocusing: boolean;
  idleMs: number;
  /** Triggers already shown this session; each fires at most once, except inactivity. */
  shown: Set<Trigger>;
  exam?: { name: string; days: number } | null;
  /** Sage add-on: today's use passed the user's own limit. */
  sageLimit?: { cardLine: string; minutes: number; target: number } | null;
};

/** Decides whether Kip should pop into the corner right now, and with what. */
export function evaluateTriggers(ctx: TriggerContext): PopupEvent | null {
  const { profile, streak, usage, isFocusing, idleMs, shown, exam, sageLimit } = ctx;
  if (isFocusing) return null;
  const mode = profile.reminderMode;
  const vars = { name: profile.name, streak: streak.count };
  const say = (trigger: Trigger, extra: Record<string, string | number> = {}) => bobLine(trigger, mode, { ...vars, ...extra });

  if (!shown.has('streakAtRisk') && streak.count > 0 && !studiedToday(streak) &&
      new Date().getHours() >= STREAK_RISK_HOUR) {
    return { trigger: 'streakAtRisk', ...say('streakAtRisk'), actionLabel: 'Start block' };
  }

  if (!shown.has('examSoon') && exam && exam.days <= EXAM_POPUP_DAYS) {
    return { trigger: 'examSoon', ...say('examSoon', { exam: exam.name, days: exam.days }), actionLabel: 'Start block' };
  }

  if (!shown.has('sageLimit') && sageLimit) {
    return {
      trigger: 'sageLimit',
      ...bobLine('sageLimit', mode, { ...vars, cardLine: sageLimit.cardLine }, 'sage'),
      actionLabel: 'Thanks, Kip',
      sage: true,
    };
  }

  const distractionLimit = DISTRACTION_MINUTES[mode] ?? 30;
  if (!shown.has('distraction') && usage && usage.totalMinutes >= distractionLimit) {
    const app = usage.topApp?.label ?? 'your distracting apps';
    const minutes = usage.topApp?.minutes ?? usage.totalMinutes;
    return { trigger: 'distraction', ...say('distraction', { app, minutes }), actionLabel: 'Fine. Studying.' };
  }

  if (idleMs >= (INACTIVITY_MINUTES[mode] ?? 5) * 60_000) {
    return { trigger: 'inactivity', ...say('inactivity'), actionLabel: 'Start block' };
  }

  return null;
}

export function goalCheckIn(profile: BobProfile, streak: StreakState): PopupEvent {
  return {
    trigger: 'goalCheckIn',
    ...bobLine('goalCheckIn', profile.reminderMode, { name: profile.name, streak: streak.count }),
    actionLabel: 'Done',
  };
}
