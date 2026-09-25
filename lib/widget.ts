import { createElement } from 'react';
import { Platform } from 'react-native';
import type { BobProfile } from '../App';
import { studiedToday, type StreakState } from './streak';

export type BobWidgetProps = {
  streak: number;
  nudge: string;
  atRisk: boolean;
};

const AT_RISK_HOUR = 20;

function nudgeFor(profile: BobProfile | null, streak: StreakState, atRisk: boolean) {
  if (studiedToday(streak)) return 'Studied today. Bob is quietly impressed.';
  if (atRisk && streak.count > 0) {
    return profile?.reminderMode === 'Brutal'
      ? `${streak.count} days. Gone at midnight.`
      : `Your ${streak.count}-day streak ends at midnight.`;
  }
  return profile?.name ? `No study yet, ${profile.name}. Bob is watching.` : 'No study yet. Bob is watching.';
}

export function buildWidgetProps(profile: BobProfile | null, streak: StreakState, at = new Date()): BobWidgetProps {
  const atRisk = !studiedToday(streak) && at.getHours() >= AT_RISK_HOUR;
  return { streak: streak.count, nudge: nudgeFor(profile, streak, atRisk), atRisk };
}

/**
 * Pushes fresh data to the home screen widget. iOS widget refreshes are budgeted by the
 * system, so we hand WidgetKit a timeline that already contains the evening "at risk" state
 * instead of relying on a wake-up at 20:00.
 */
export async function updateWidgets(profile: BobProfile | null, streak: StreakState) {
  try {
    if (Platform.OS === 'ios') {
      // Lazy: expo-widgets has no Android/web implementation.
      const BobWidget = require('../widgets/BobWidget').default;
      const now = new Date();
      const entries = [{ date: now, props: buildWidgetProps(profile, streak, now) }];
      const evening = new Date(now);
      evening.setHours(AT_RISK_HOUR, 0, 0, 0);
      if (evening > now && !studiedToday(streak)) {
        entries.push({ date: evening, props: buildWidgetProps(profile, streak, evening) });
      }
      BobWidget.updateTimeline(entries);
    } else if (Platform.OS === 'android') {
      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { BobAndroidWidget } = require('../widgets/BobAndroidWidget');
      await requestWidgetUpdate({
        widgetName: 'Bob',
        renderWidget: () => createElement(BobAndroidWidget, buildWidgetProps(profile, streak)),
        widgetNotFound: () => {},
      });
    }
  } catch (error) {
    // Expo Go has neither widget runtime; widgets need a development build.
    if (__DEV__) console.warn('Widget update skipped:', error);
  }
}
