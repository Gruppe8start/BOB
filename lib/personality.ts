import type { Trigger } from './bobVoice';
import { KEYS, readJson, writeJson } from './storage';

// Pro: Kip's custom personality. His tone is the reminder mode (Chill/Firm/Brutal); on top of
// that the user can write their own lines, mixed into nudges and popups at the chosen rate.

export type PhraseTrigger = Trigger | 'any';

export type CustomPhrase = {
  id: string;
  trigger: PhraseTrigger;
  text: string;
};

export type Personality = {
  phrases: CustomPhrase[];
  /** Share of nudges that use the user's own phrases, 0-1. */
  phraseMix: number;
};

export const DEFAULT_PERSONALITY: Personality = { phrases: [], phraseMix: 0.25 };

export function loadPersonality() {
  return readJson<Personality>(KEYS.personality, DEFAULT_PERSONALITY);
}

export function savePersonality(personality: Personality) {
  return writeJson(KEYS.personality, personality);
}
