// Kip's desktop lines. {name} = user's name, {app} = distracting app/site, {time} = countdown left.
const LINES = {
  wander: {
    Chill: ['Just stretching my legs.', 'Nice focus. Carry on.', 'Hydrate, {name}.'],
    Firm: ['Still working? Good.', 'I’m watching. Casually.', 'Don’t mind me.'],
    Brutal: ['I see everything, {name}.', 'Walking past. Judging.', 'Your deadline says hi.'],
  },
  noticed: {
    Chill: ['{app}? A short break is fine. Back in {time}?', 'Little {app} break. {time} left.'],
    Firm: ['{app}. Really? Close it in {time}.', 'I saw that. {time} to close {app}.'],
    Brutal: ['{app}?! You have {time}. Then I get loud.', 'Oh, {app}. Bold. {time}.'],
  },
  alarm: {
    Chill: ['Hey. Time to close {app}.', 'Okay, {app} time is over.'],
    Firm: ['CLOSE {app}. NOW.', 'Time’s up. Close {app}.'],
    Brutal: ['I’M SITTING ON {app} UNTIL YOU CLOSE IT.', 'NOPE. NOT TODAY, {app}.'],
  },
  left: {
    Chill: ['Nice. Back to it.', 'Thank you, {name}.'],
    Firm: ['Good. Stay here.', 'That’s more like it.'],
    Brutal: ['Finally.', 'Took you long enough.'],
  },
  poke: {
    Chill: ['Hi!', 'You got this.'],
    Firm: ['Stop poking me. Work.', 'Yes, I’m real. Study.'],
    Brutal: ['Touch me again and I call your mom.', 'Don’t you have an exam?'],
  },
  paused: ['Zzz… (paused)', 'Taking a break too. For now.'],
};

function line(kind, mode, vars = {}) {
  const pool = kind === 'paused' ? LINES.paused : (LINES[kind][mode] || LINES[kind].Firm);
  const text = pool[Math.floor(Math.random() * pool.length)];
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== '' ? vars[k] : k === 'name' ? 'you' : ''));
}

module.exports = { line };
