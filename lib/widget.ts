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

function nudgeFor(profile: BobProfile | null, streak: StreakState, atRisk: boolean, cardLine: string | null) {
  if (studiedToday(streak)) return 'Studied today. Kip is quietly impressed.';
  if (atRisk && streak.count > 0) {
    return profile?.reminderMode === 'Brutal'
      ? `${streak.count} days. Gone at midnight.`
      : `Your ${streak.count}-day streak ends at midnight.`;
  }
  // Sage add-on: a line from the user's own reminder card.
  if (cardLine) return cardLine;
  return profile?.name ? `No study yet, ${profile.name}. Kip is watching.` : 'No study yet. Kip is watching.';
}

export function buildWidgetProps(profile: BobProfile | null, streak: StreakState, at = new Date(), cardLine: string | null = null): BobWidgetProps {
  const atRisk = !studiedToday(streak) && at.getHours() >= AT_RISK_HOUR;
  return { streak: streak.count, nudge: nudgeFor(profile, streak, atRisk, cardLine), atRisk };
}

/**
 * Pushes fresh data to the home screen widget. iOS widget refreshes are budgeted by the
 * system, so we hand WidgetKit a timeline that already contains the evening "at risk" state
 * instead of relying on a wake-up at 20:00.
 */
export async function updateWidgets(profile: BobProfile | null, streak: StreakState, cardLine: string | null = null) {
  try {
    if (Platform.OS === 'ios') {
      // Lazy: expo-widgets has no Android/web implementation.
      const BobWidget = require('../widgets/BobWidget').default;
      const now = new Date();
      const entries = [{ date: now, props: buildWidgetProps(profile, streak, now, cardLine) }];
      const evening = new Date(now);
      evening.setHours(AT_RISK_HOUR, 0, 0, 0);
      if (evening > now && !studiedToday(streak)) {
        entries.push({ date: evening, props: buildWidgetProps(profile, streak, evening, cardLine) });
      }
      BobWidget.updateTimeline(entries);
    } else if (Platform.OS === 'android') {
      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { BobAndroidWidget } = require('../widgets/BobAndroidWidget');
      await requestWidgetUpdate({
        widgetName: 'Kip',
        renderWidget: () => createElement(BobAndroidWidget, buildWidgetProps(profile, streak, new Date(), cardLine)),
        widgetNotFound: () => {},
      });
    }
  } catch (error) {
    // Expo Go has neither widget runtime; widgets need a development build.
    if (__DEV__) console.warn('Widget update skipped:', error);
  }
}
