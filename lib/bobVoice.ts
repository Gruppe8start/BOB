export type ReminderMode = 'Chill' | 'Firm' | 'Brutal';

export type Trigger =
  | 'inactivity'
  | 'streakAtRisk'
  | 'goalCheckIn'
  | 'distraction'
  | 'social';

type Line = { title: string; body: string };

const LINES: Record<Trigger, Record<ReminderMode, Line[]>> = {
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
  social: {
    Chill: [{ title: 'Heads up', body: '{friend} just passed you on the leaderboard.' }],
    Firm: [{ title: '{friend} overtook you.', body: 'Are you going to let that stand?' }],
    Brutal: [{ title: '{friend} is beating you.', body: '{friend}. Of all people.' }],
  },
};

export function bobLine(
  trigger: Trigger,
  mode: string,
  vars: Record<string, string | number> = {}
): Line {
  const safeMode = (['Chill', 'Firm', 'Brutal'].includes(mode) ? mode : 'Firm') as ReminderMode;
  const options = LINES[trigger][safeMode];
  const line = options[Math.floor(Math.random() * options.length)];
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
  return { title: fill(line.title), body: fill(line.body) };
}
