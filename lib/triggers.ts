import type { BobProfile } from '../App';
import { bobLine, type Trigger } from './bobVoice';
import { studiedToday, type StreakState } from './streak';
import type { UsageSummary } from './usage';

export type PopupEvent = {
  trigger: Trigger;
  title: string;
  body: string;
  actionLabel: string;
};

const INACTIVITY_MINUTES = { Chill: 10, Firm: 5, Brutal: 2 } as Record<string, number>;
const DISTRACTION_MINUTES = { Chill: 60, Firm: 30, Brutal: 15 } as Record<string, number>;
const STREAK_RISK_HOUR = 18;

export type TriggerContext = {
  profile: BobProfile;
  streak: StreakState;
  usage: UsageSummary | null;
  isFocusing: boolean;
  idleMs: number;
  /** Triggers already shown this session; each fires at most once, except inactivity. */
  shown: Set<Trigger>;
};

/** Decides whether Bob should pop into the corner right now, and with what. */
export function evaluateTriggers(ctx: TriggerContext): PopupEvent | null {
  const { profile, streak, usage, isFocusing, idleMs, shown } = ctx;
  if (isFocusing) return null;
  const mode = profile.reminderMode;
  const vars = { name: profile.name, streak: streak.count };

  if (!shown.has('streakAtRisk') && streak.count > 0 && !studiedToday(streak) &&
      new Date().getHours() >= STREAK_RISK_HOUR) {
    return { trigger: 'streakAtRisk', ...bobLine('streakAtRisk', mode, vars), actionLabel: 'Start block' };
  }

  const distractionLimit = DISTRACTION_MINUTES[mode] ?? 30;
  if (!shown.has('distraction') && usage && usage.totalMinutes >= distractionLimit) {
    const app = usage.topApp?.label ?? 'your distracting apps';
    const minutes = usage.topApp?.minutes ?? usage.totalMinutes;
    return {
      trigger: 'distraction',
      ...bobLine('distraction', mode, { ...vars, app, minutes }),
      actionLabel: 'Fine. Studying.',
    };
  }

  if (idleMs >= (INACTIVITY_MINUTES[mode] ?? 5) * 60_000) {
    return { trigger: 'inactivity', ...bobLine('inactivity', mode, vars), actionLabel: 'Start block' };
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
