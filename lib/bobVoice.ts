import type { CustomPhrase } from './personality';

export type ReminderMode = 'Chill' | 'Firm' | 'Brutal';

export type Trigger =
  | 'inactivity'
  | 'streakAtRisk'
  | 'goalCheckIn'
  | 'distraction'
  | 'examSoon'
  | 'sageLimit'
  | 'social';

/** Kip's two sides: the usual passive-aggressive study frog, and Sage, his warm motivational side. */
export type Side = 'kip' | 'sage';

type Line = { title: string; body: string };

const LINES: Record<Exclude<Trigger, 'sageLimit'>, Record<ReminderMode, Line[]>> = {
  inactivity: {
    Chill: [{ title: 'Kip here.', body: 'No pressure, but a short focus block would be nice, {name}.' }],
    Firm: [{ title: 'Still there, {name}?', body: "It's been a while. One block. Now." }],
    Brutal: [
      { title: 'Wow, {name}.', body: 'Your books called. They miss you. I told them not to get their hopes up.' },
      { title: 'Kip is disappointed.', body: 'Not surprised. Just disappointed. Start a block.' },
    ],
  },
  streakAtRisk: {
    Chill: [{ title: 'Your {streak}-day streak', body: 'still needs today’s session. You’ve got this.' }],
    Firm: [{ title: 'Streak at risk.', body: '{streak} days on the line and midnight is coming. Move.' }],
    Brutal: [{ title: '{streak} days. Gone at midnight.', body: 'Unless you actually open a book. Your call.' }],
  },
  goalCheckIn: {
    Chill: [{ title: 'Nice work.', body: 'Focus block done. Take a breather.' }],
    Firm: [{ title: 'Kip checked in.', body: 'Block done. Log it and keep the momentum.' }],
    Brutal: [{ title: 'Kip checked in.', body: 'You finished a focus block. Please accept this tiny victory.' }],
  },
  distraction: {
    Chill: [{ title: 'Quick check', body: '{minutes} min in {app} today. Maybe time for a study block?' }],
    Firm: [{ title: '{minutes} min on {app}.', body: 'Instead of studying. Just saying.' }],
    Brutal: [{ title: '{minutes} minutes. On {app}.', body: 'I did the math. That was your exam grade scrolling by.' }],
  },
  examSoon: {
    Chill: [{ title: '{exam} in {days} days', body: 'A little every day adds up. One block today?' }],
    Firm: [{ title: '{exam}: {days} days left.', body: 'This is where the grade is made. Start a block.' }],
    Brutal: [{ title: '{days} days until {exam}.', body: 'Future you is already nervous. Help them out.' }],
  },
  social: {
    Chill: [{ title: 'Heads up', body: '{friend} just passed you on the leaderboard.' }],
    Firm: [{ title: '{friend} overtook you.', body: 'Are you going to let that stand?' }],
    Brutal: [{ title: '{friend} is beating you.', body: '{friend}. Of all people.' }],
  },
};

// Sage side: digital wellbeing coach. Warm, never judgmental, never clinical wording.
const SAGE_LINES: Record<Trigger, Line[]> = {
  inactivity: [{ title: 'Kip, softer side', body: 'How about a small, calm step toward what matters to you today?' }],
  streakAtRisk: [{ title: 'A gentle reminder', body: 'Your {streak}-day rhythm is still open for today, if you want it.' }],
  goalCheckIn: [{ title: 'Well done', body: 'You gave your attention to something you chose. That counts.' }],
  distraction: [{ title: 'Noticing, not judging', body: '{minutes} min in {app} today. Is this how you want to spend the next hour?' }],
  examSoon: [{ title: '{exam} in {days} days', body: 'Small, steady steps work. What is one thing you could do today?' }],
  sageLimit: [{ title: 'You reached your own limit', body: '{cardLine}' }],
  social: [{ title: 'Heads up', body: '{friend} is moving ahead. Your pace is yours.' }],
};

type Voice = { phrases: CustomPhrase[]; mix: number };

// Set by MainScreen from the personality settings (Pro), read synchronously by the nudge code.
let voice: Voice = { phrases: [], mix: 0 };

export function setVoice(next: Voice) {
  voice = next;
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function bobLine(
  trigger: Trigger,
  mode: string,
  vars: Record<string, string | number> = {},
  side: Side = 'kip'
): Line {
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
  const map = (line: Line) => ({ title: fill(line.title), body: fill(line.body) });

  if (side === 'sage') return map(pick(SAGE_LINES[trigger]));

  // The user's own lines (Pro) are mixed in at the chosen rate.
  const own = voice.phrases.filter(p => p.trigger === 'any' || p.trigger === trigger);
  if (own.length > 0 && Math.random() < voice.mix) return { title: 'Kip', body: fill(pick(own).text) };

  const tone = (['Chill', 'Firm', 'Brutal'].includes(mode) ? mode : 'Firm') as ReminderMode;
  const table = trigger === 'sageLimit' ? LINES.distraction : LINES[trigger];
  return map(pick(table[tone]));
}
