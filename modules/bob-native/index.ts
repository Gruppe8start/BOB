import { requireOptionalNativeModule } from 'expo-modules-core';

export type AlarmSupport = 'alarmkit' | 'alarmmanager' | 'notification-only';
export type ScreenTimeStatus = 'approved' | 'denied' | 'notDetermined';

export type WatchConfig = {
  /** Android package names of the distracting apps, e.g. "com.instagram.android". */
  packages: string[];
  /** Package name -> human label, used in Bob's alarm text. */
  labels: Record<string, string>;
  countdownSeconds: number;
  cooldownMinutes: number;
  alarmEnabled: boolean;
  alarmTitle: string;
  alarmBody: string;
};

export type MonitorConfig = {
  appGroup: string;
  reminderMode: string;
  countdownSeconds: number;
  cooldownMinutes: number;
  alarmEnabled: boolean;
  alarmTitle: string;
  alarmBody: string;
};

type BobNativeModule = {
  getAlarmSupport(): AlarmSupport;

  // Android: UsageStatsManager + foreground watcher + full-screen intent alarm
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getTodayUsageMinutes(packages: string[]): Promise<Record<string, number>>;
  resolvePackagesByLabel(labels: string[]): Promise<Record<string, string>>;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): void;
  /** Resolves false on Android < 8, where the watcher is unsupported. */
  startDistractionWatch(config: WatchConfig): Promise<boolean>;
  stopDistractionWatch(): Promise<void>;
  isDistractionWatchRunning(): boolean;

  // iOS: Screen Time (FamilyControls / DeviceActivity) + AlarmKit
  getScreenTimeStatus(): ScreenTimeStatus;
  requestScreenTimeAuthorization(): Promise<ScreenTimeStatus>;
  pickDistractingApps(appGroup: string): Promise<number>;
  getSelectedAppCount(appGroup: string): number;
  requestAlarmAuthorization(): Promise<boolean>;
  startMonitoring(config: MonitorConfig): Promise<void>;
  stopMonitoring(): void;
  getUsageMinutesToday(appGroup: string): number;
  scheduleTestAlarm(seconds: number, title: string): Promise<boolean>;
};

// Null in Expo Go and on web: every caller must handle the module being absent.
export default requireOptionalNativeModule<BobNativeModule>('BobNative');
