import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Sensitive Sage data (reflection answers, card, diary, self-check) lives in the OS keychain /
// keystore via expo-secure-store, one small item per key. Browsers have no equivalent, so the
// web build falls back to local storage and says so in the UI.
type SecureStoreModule = typeof import('expo-secure-store');

function secure(): SecureStoreModule | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-secure-store');
  } catch {
    return null;
  }
}

const PREFIX = 'kip.sage.';
const INDEX_KEY = 'kip_sage_secure_index';

export const encryptedAtRest = () => secure() !== null;

async function index(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function secureGet<T>(key: string): Promise<T | null> {
  const store = secure();
  const raw = store ? await store.getItemAsync(PREFIX + key) : await AsyncStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: unknown) {
  const store = secure();
  const raw = JSON.stringify(value);
  if (store) await store.setItemAsync(PREFIX + key, raw);
  else await AsyncStorage.setItem(PREFIX + key, raw);
  const keys = await index();
  if (!keys.includes(key)) await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...keys, key]));
}

/** Deletes every sensitive Sage item (user-initiated deletion, GDPR / Swiss nDSG). */
export async function secureWipe() {
  const store = secure();
  for (const key of await index()) {
    if (store) await store.deleteItemAsync(PREFIX + key);
    else await AsyncStorage.removeItem(PREFIX + key);
  }
  await AsyncStorage.removeItem(INDEX_KEY);
}
