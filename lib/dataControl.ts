import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform, Share } from 'react-native';
import BobNative from '../modules/bob-native';
import { secureExportAll, secureWipe } from './sage/secureStore';
import { callExtension } from './webBridge';

// The user's own data rights (GDPR / Swiss nDSG): see everything Kip stored, or wipe it.
// Everything lives on the device, so both work offline.

const SECURE_INDEX_KEY = 'kip_sage_secure_index';

function parse(raw: string | null) {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Everything Kip stored on this device, as one readable object. */
export async function collectAllData() {
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k !== SECURE_INDEX_KEY && !k.startsWith('kip.sage.'));
  const pairs = await AsyncStorage.multiGet(keys);
  const appData: Record<string, unknown> = {};
  for (const [key, value] of pairs) appData[key] = parse(value);

  return {
    app: 'Kip',
    exportedAt: new Date().toISOString(),
    note: 'Everything Kip stored on this device. Nothing is stored on a server.',
    appData,
    sageEncryptedData: await secureExportAll(),
    browserExtensionUsage: Platform.OS === 'web' ? await callExtension('getUsage') : undefined,
  };
}

/** Hands the export to the user: a download in the browser, the share sheet on the phone. */
export async function exportAllData() {
  const json = JSON.stringify(await collectAllData(), null, 2);
  const fileName = `kip-data-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  // Text share works without extra native modules: save it to Files/Drive, mail it, etc.
  await Share.share({ title: fileName, message: json });
}

/** Stops everything running in the background and deletes all of Kip's data on this device. */
export async function deleteAllData() {
  if (Platform.OS !== 'web') {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }
  if (BobNative && Platform.OS === 'android') {
    await BobNative.stopDistractionWatch().catch(() => {});
  }
  if (BobNative && Platform.OS === 'ios') {
    try {
      BobNative.stopMonitoring();
    } catch {
      // Monitoring was not running.
    }
  }
  if (Platform.OS === 'web') {
    await callExtension('clearData');
  }
  await secureWipe();
  await AsyncStorage.clear();
}
