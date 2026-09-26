// What counts as "distracting" on the laptop. Websites are matched by the browser window's
// title (e.g. "Funny cats - YouTube - Google Chrome"); desktop programs by their .exe name.
// Title matching only applies to browsers, so a Word file called "YouTube essay" doesn't count.

const BROWSERS = new Set([
  'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe', 'opera_gx.exe', 'vivaldi.exe', 'arc.exe',
]);

const PRESETS = [
  { id: 'youtube', label: 'YouTube', titles: ['youtube'] },
  { id: 'instagram', label: 'Instagram', titles: ['instagram'] },
  { id: 'tiktok', label: 'TikTok', titles: ['tiktok'] },
  { id: 'netflix', label: 'Netflix', titles: ['netflix'], exes: ['netflix.exe'] },
  { id: 'reddit', label: 'Reddit', titles: ['reddit'] },
  { id: 'twitter', label: 'Twitter/X', titles: ['twitter', ' / x'] },
  { id: 'twitch', label: 'Twitch', titles: ['twitch'] },
  { id: 'whatsapp', label: 'WhatsApp', titles: ['whatsapp'], exes: ['whatsapp.exe', 'whatsapp.root.exe'] },
  { id: 'discord', label: 'Discord', exes: ['discord.exe'] },
  { id: 'steam', label: 'Steam', exes: ['steam.exe', 'steamwebhelper.exe'] },
];

/** Rules active for these settings: chosen presets plus custom sites (title words) and programs (.exe). */
function activeRules(settings) {
  const rules = PRESETS.filter(p => settings.presets.includes(p.id));
  for (const site of settings.customSites) {
    const word = site.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[./]/)[0];
    if (word) rules.push({ id: `site:${word}`, label: site.trim(), titles: [word] });
  }
  for (const app of settings.customApps) {
    const exe = app.trim().toLowerCase();
    if (exe) rules.push({ id: `app:${exe}`, label: exe.replace(/\.exe$/, ''), exes: [exe.endsWith('.exe') ? exe : `${exe}.exe`] });
  }
  return rules;
}

/** The rule the foreground window matches, or null. */
function matchWindow(win, settings) {
  if (!win) return null;
  const title = win.title.toLowerCase();
  const isBrowser = BROWSERS.has(win.exe);
  for (const rule of activeRules(settings)) {
    if (rule.exes && rule.exes.includes(win.exe)) return rule;
    if (isBrowser && rule.titles && rule.titles.some(t => title.includes(t))) return rule;
  }
  return null;
}

module.exports = { PRESETS, BROWSERS, activeRules, matchWindow };
