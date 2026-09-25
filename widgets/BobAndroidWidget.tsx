import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';
import type { BobWidgetProps } from '../lib/widget';

// Android home screen widget (App Widgets). Tapping it opens the app.
export function BobAndroidWidget({ streak, nudge, atRisk }: BobWidgetProps) {
  const accent = atRisk ? '#FF7043' : '#4CAF50';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0d0d0d',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <ImageWidget
          image={require('../assets/bob.png')}
          imageWidth={44}
          imageHeight={44}
          radius={10}
        />
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
          <TextWidget text={String(streak)} style={{ fontSize: 24, fontWeight: '800', color: accent }} />
          <TextWidget text="DAY STREAK" style={{ fontSize: 9, fontWeight: '800', color: '#777777' }} />
        </FlexWidget>
      </FlexWidget>
      <TextWidget text={nudge} maxLines={3} style={{ fontSize: 13, color: '#ffffff' }} />
    </FlexWidget>
  );
}
