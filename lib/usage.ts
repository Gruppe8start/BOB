import { Platform } from 'react-native';
import BobNative from '../modules/bob-native';
import { APP_GROUP } from './config';
import { callExtension, extensionInstalled } from './webBridge';

// Android package names for the preset chips in onboarding.
const KNOWN_PACKAGES: Record<string, string[]> = {
  Instagram: ['com.instagram.android'],
  TikTok: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
  YouTube: ['com.google.android.youtube'],
  'Twitter/X': ['com.twitter.android'],
  Snapchat: ['com.snapchat.android'],
  WhatsApp: ['com.whatsapp'],
  Reddit: ['com.reddit.frontpage'],
  Netflix: ['com.netflix.mediaclient'],
};

// Websites for the same apps, used by the browser extension.
const KNOWN_DOMAINS: Record<string, string[]> = {
  Instagram: ['instagram.com'],
  TikTok: ['tiktok.com'],
  YouTube: ['youtube.com'],
  'Twitter/X': ['twitter.com', 'x.com'],
  Snapchat: ['snapchat.com'],
  WhatsApp: ['web.whatsapp.com'],
  Reddit: ['reddit.com'],
  Netflix: ['netflix.com'],
};

export type UsageAccess = 'granted' | 'needs-permission' | 'needs-app-selection' | 'unavailable';

export type UsageSummary = {
  totalMinutes: number;
  /** Android and web only: iOS reports usage for the whole selection, never per app. */
  topApp?: { label: string; minutes: number };
  /** Minutes per app label, same platforms as topApp. */
  perApp?: Record<string, number>;
};

export function usageTrackingSupported() {
  return Platform.OS === 'web' || (BobNative !== null && (Platform.OS === 'android' || Platform.OS === 'ios'));
}

export async function getUsageAccess(): Promise<UsageAccess> {
  if (Platform.OS === 'web') return (await extensionInstalled()) ? 'granted' : 'needs-permission';
  if (!BobNative || !usageTrackingSupported()) return 'unavailable';
  if (Platform.OS === 'android') {
    return BobNative.hasUsageAccess() ? 'granted' : 'needs-permission';
  }
  if (BobNative.getScreenTimeStatus() !== 'approved') return 'needs-permission';
  return BobNative.getSelectedAppCount(APP_GROUP) > 0 ? 'granted' : 'needs-app-selection';
}

/**
 * Walks the user through the OS permission for their platform. Android sends them to the
 * Usage Access settings page (no in-app prompt exists); iOS shows the Screen Time prompt and
 * then the system app picker, since iOS will not let us look apps up by name. On web the
 * "permission" is installing the BOB browser extension, which the caller explains.
 */
export async function requestUsageAccess(): Promise<UsageAccess> {
  if (Platform.OS === 'web') return getUsageAccess();
  if (!BobNative) return 'unavailable';
  if (Platform.OS === 'android') {
    BobNative.openUsageAccessSettings();
    return getUsageAccess();
  }
  const status = await BobNative.requestScreenTimeAuthorization();
  if (status !== 'approved') return 'needs-permission';
  await BobNative.pickDistractingApps(APP_GROUP);
  return getUsageAccess();
}

export async function pickDistractingAppsIos() {
  if (!BobNative || Platform.OS !== 'ios') return 0;
  return BobNative.pickDistractingApps(APP_GROUP);
}

/** Android: package name -> label for the user's distracting apps, including "Other" entries. */
export async function resolveDistractingPackages(apps: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unknown: string[] = [];
  for (const app of apps) {
    const known = KNOWN_PACKAGES[app];
    if (known) known.forEach(pkg => (result[pkg] = app));
    else unknown.push(app);
  }
  if (unknown.length > 0 && BobNative && Platform.OS === 'android') {
    const resolved = await BobNative.resolvePackagesByLabel(unknown);
    for (const [label, pkg] of Object.entries(resolved)) result[pkg] = label;
  }
  return result;
}

/** Web: domain -> label. "Other" entries are used as a domain if they look like one, else "<name>.com". */
export function resolveDistractingDomains(apps: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const app of apps) {
    const known = KNOWN_DOMAINS[app];
    if (known) {
      known.forEach(domain => (result[domain] = app));
      continue;
    }
    const cleaned = app.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!cleaned) continue;
    result[cleaned.includes('.') ? cleaned : `${cleaned.replace(/\s+/g, '')}.com`] = app;
  }
  return result;
}

function summarize(minutesByKey: Record<string, number>, labels: Record<string, string>): UsageSummary {
  const perLabel: Record<string, number> = {};
  for (const [key, minutes] of Object.entries(minutesByKey)) {
    const label = labels[key] ?? key;
    perLabel[label] = (perLabel[label] ?? 0) + minutes;
  }
  const entries = Object.entries(perLabel).sort((a, b) => b[1] - a[1]);
  const totalMinutes = Math.round(entries.reduce((sum, [, m]) => sum + m, 0));
  const top = entries[0];
  return {
    totalMinutes,
    topApp: top && top[1] >= 1 ? { label: top[0], minutes: Math.round(top[1]) } : undefined,
    perApp: Object.fromEntries(entries.map(([label, m]) => [label, Math.round(m)])),
  };
}

export async function getTodayUsage(apps: string[]): Promise<UsageSummary | null> {
  if ((await getUsageAccess()) !== 'granted') return null;

  if (Platform.OS === 'web') {
    const perDomain = await callExtension<Record<string, number>>('getUsage');
    return perDomain ? summarize(perDomain, resolveDistractingDomains(apps)) : null;
  }
  if (!BobNative) return null;

  if (Platform.OS === 'ios') {
    // Screen Time only tells us which thresholds were crossed, so this is a lower bound.
    return { totalMinutes: BobNative.getUsageMinutesToday(APP_GROUP) };
  }

  const packages = await resolveDistractingPackages(apps);
  return summarize(await BobNative.getTodayUsageMinutes(Object.keys(packages)), packages);
}
