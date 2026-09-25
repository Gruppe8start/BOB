import { Platform } from 'react-native';
import type { BobProfile } from '../App';
import BobNative, { type AlarmSupport } from '../modules/bob-native';
import { APP_GROUP } from './config';
import { KEYS, readJson, writeJson } from './storage';
import { getUsageAccess, resolveDistractingDomains, resolveDistractingPackages } from './usage';
import { callExtension } from './webBridge';

export type AlarmSettings = {
  enabled: boolean;
  countdownSeconds: number;
  cooldownMinutes: number;
};

const DEFAULTS: Record<string, AlarmSettings> = {
  Chill: { enabled: false, countdownSeconds: 300, cooldownMinutes: 5 },
  Firm: { enabled: false, countdownSeconds: 180, cooldownMinutes: 10 },
  Brutal: { enabled: false, countdownSeconds: 60, cooldownMinutes: 15 },
};

const ALARM_COPY: Record<string, { title: string; body: string }> = {
  Chill: { title: 'Hey. Time to close {app}.', body: 'Bob gave you a few minutes. Back to studying?' },
  Firm: { title: 'Close {app}. Now.', body: 'Countdown’s over. This alarm stops when you leave {app}.' },
  Brutal: { title: 'CLOSE {app}.', body: 'You had your chance. This stops when you do.' },
};

export function alarmSupport(): AlarmSupport | 'browser-extension' {
  if (Platform.OS === 'web') return 'browser-extension';
  return BobNative?.getAlarmSupport() ?? 'notification-only';
}

export async function loadAlarmSettings(mode: string): Promise<AlarmSettings> {
  return readJson(KEYS.alarmSettings, DEFAULTS[mode] ?? DEFAULTS.Firm);
}

export async function saveAlarmSettings(settings: AlarmSettings) {
  await writeJson(KEYS.alarmSettings, settings);
}

/**
 * Starts, updates or stops the platform watcher so it matches the profile and alarm settings.
 * Android: a foreground service that runs the countdown/cooldown and rings via full-screen intent.
 * iOS: Screen Time monitoring; the monitor extension fires the AlarmKit alarm (iOS 26+).
 */
export async function applyDistractionWatch(profile: BobProfile, settings: AlarmSettings) {
  const copy = ALARM_COPY[profile.reminderMode] ?? ALARM_COPY.Firm;
  const tracking = profile.usageTrackingEnabled && (await getUsageAccess()) === 'granted';

  if (Platform.OS === 'web') {
    // Browser extension: an empty domain list switches tracking off entirely.
    const labels = tracking ? resolveDistractingDomains(profile.distractingApps) : {};
    await callExtension('setConfig', {
      domains: Object.keys(labels),
      labels,
      countdownSeconds: settings.countdownSeconds,
      cooldownMinutes: settings.cooldownMinutes,
      alarmEnabled: tracking && settings.enabled,
      alarmTitle: copy.title,
      alarmBody: copy.body,
    });
    return;
  }

  if (!BobNative) return;

  if (Platform.OS === 'android') {
    if (!tracking || !settings.enabled) {
      if (BobNative.isDistractionWatchRunning()) await BobNative.stopDistractionWatch();
      return;
    }
    const labels = await resolveDistractingPackages(profile.distractingApps);
    await BobNative.startDistractionWatch({
      packages: Object.keys(labels),
      labels,
      countdownSeconds: settings.countdownSeconds,
      cooldownMinutes: settings.cooldownMinutes,
      alarmEnabled: settings.enabled,
      // The service substitutes {app} with the label of the app that is open.
      alarmTitle: copy.title.replace('{app}', 'it'),
      alarmBody: copy.body,
    });
    return;
  }

  if (Platform.OS === 'ios') {
    if (!tracking) {
      BobNative.stopMonitoring();
      return;
    }
    // Monitoring stays on for usage milestones even when the alarm is off.
    await BobNative.startMonitoring({
      appGroup: APP_GROUP,
      reminderMode: profile.reminderMode,
      countdownSeconds: settings.countdownSeconds,
      cooldownMinutes: settings.cooldownMinutes,
      alarmEnabled: settings.enabled,
      alarmTitle: copy.title.replace('{app}', 'it'),
      alarmBody: copy.body,
    });
  }
}

/** Rings the alarm right now (web: on the BOB tab; iOS: AlarmKit in 10 s). */
export async function testAlarm(): Promise<boolean> {
  if (Platform.OS === 'web') return (await callExtension<{ ok: boolean }>('testAlarm'))?.ok === true;
  return BobNative ? BobNative.scheduleTestAlarm(10, 'Bob test alarm. Close it.') : false;
}

/** Asks for whatever the alarm needs beyond usage access. Returns false if the user said no. */
export async function requestAlarmPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true; // covered by installing the extension
  if (!BobNative) return false;
  if (Platform.OS === 'ios') {
    return alarmSupport() === 'alarmkit' ? BobNative.requestAlarmAuthorization() : true;
  }
  if (!BobNative.canUseFullScreenIntent()) {
    BobNative.openFullScreenIntentSettings();
    return false;
  }
  return true;
}
