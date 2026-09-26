import { Share } from 'react-native';
import { KEYS, readJson, writeJson } from './storage';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export async function referralCode() {
  const stored = await readJson<{ code: string | null }>(KEYS.referral, { code: null });
  if (stored.code) return stored.code;
  let code = 'KIP-';
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  await writeJson(KEYS.referral, { code });
  return code;
}

/**
 * Opens the system share sheet. Redeeming the code for the 15 CHF/year price needs the
 * store/billing backend, which isn't live yet.
 */
export async function shareReferral(code: string) {
  await Share.share({
    message: `I'm studying with Kip, a passive-aggressive study frog. Use my code ${code} to get Kip Premium for 15 CHF/year instead of 20.`,
  });
}
