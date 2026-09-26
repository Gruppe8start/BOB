import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import type { BobProfile } from '../App';
import { KEYS, readJson } from '../lib/storage';
import { loadStreak } from '../lib/streak';
import { buildWidgetProps } from '../lib/widget';
import { BobAndroidWidget } from './BobAndroidWidget';

// Runs headless when Android adds, resizes or periodically refreshes the widget.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const profile = await readJson<BobProfile | null>(KEYS.profile, null);
      const streak = await loadStreak();
      props.renderWidget(<BobAndroidWidget {...buildWidgetProps(profile, streak)} />);
      break;
    }
    default:
      break;
  }
}
