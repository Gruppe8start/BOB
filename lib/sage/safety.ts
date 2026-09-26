import { KEYS, readJson, writeJson } from '../storage';

// Automatic distress check on every free-text answer, before Sage continues (no human in the loop).
// Keyword-based until the LLM classifier exists; errs on the side of showing help.
const DISTRESS_PATTERNS: RegExp[] = [
  /suicid/i,
  /kill (myself|me)/i,
  /end (my|it all)|end my life/i,
  /(want|wish) (to|i could) (die|disappear)/i,
  /don'?t want to (live|be alive|exist)/i,
  /no (point|reason) (in )?(living|to live|going on)/i,
  /self[- ]?harm|hurt(ing)? myself|cut(ting)? myself/i,
  /hopeless|can'?t go on|worthless/i,
  // German
  /selbstmord|suizid|umbringen/i,
  /nicht mehr leben|sterben wollen|will sterben|tot sein/i,
  /selbstverletz|ritzen|mir weh tun/i,
  /hoffnungslos|keinen sinn mehr|halte es nicht mehr aus/i,
];

export function showsDistress(text: string) {
  return DISTRESS_PATTERNS.some(p => p.test(text));
}

export type HelpLine = { name: string; phone?: string; url?: string; note: string };

const HELP: Record<string, HelpLine[]> = {
  CH: [
    { name: 'Die Dargebotene Hand', phone: '143', note: 'Free, anonymous, 24/7' },
    { name: 'Pro Juventute (under 25)', phone: '147', note: 'Free, 24/7, also chat and SMS' },
  ],
  DE: [
    { name: 'TelefonSeelsorge', phone: '0800 111 0 111', note: 'Free, anonymous, 24/7' },
    { name: 'TelefonSeelsorge', phone: '0800 111 0 222', note: 'Alternative number' },
  ],
  AT: [{ name: 'TelefonSeelsorge', phone: '142', note: 'Free, anonymous, 24/7' }],
};

const INTERNATIONAL: HelpLine = {
  name: 'Find a helpline',
  url: 'https://findahelpline.com',
  note: 'Free, confidential helplines in your country',
};

export function regionCode() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.split('-')[1]?.toUpperCase() ?? '';
  } catch {
    return '';
  }
}

/** Local lines first (fallback: CH, DE, AT), then an international directory. */
export function helpLines(region = regionCode()): HelpLine[] {
  const local = HELP[region];
  return local ? [...local, INTERNATIONAL] : [...HELP.CH, ...HELP.DE, ...HELP.AT, INTERNATIONAL];
}

/** Logs that a safety response happened. Timestamp only, never the content. */
export async function logSafetyEvent() {
  const log = await readJson<{ events: number[] }>(KEYS.sageSafety, { events: [] });
  log.events.push(Date.now());
  await writeJson(KEYS.sageSafety, log);
}
