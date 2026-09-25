import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type BobWidgetProps = {
  streak: number;
  nudge: string;
  atRisk: boolean;
};

// iOS home/lock screen widget (WidgetKit). Runs in an isolated runtime: no hooks,
// no imports from app code, no module-scope values.
const BobWidget = (props: BobWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const accent = props.atRisk ? '#FF7043' : '#4CAF50';

  if (environment.widgetFamily === 'accessoryInline') {
    return <Text>🐸 {props.streak}-day streak</Text>;
  }

  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <VStack>
        <Text modifiers={[font({ size: 18 })]}>🐸</Text>
        <Text modifiers={[font({ weight: 'bold', size: 14 })]}>{props.streak}</Text>
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" modifiers={[padding({ all: 4 })]}>
      <HStack>
        <Text modifiers={[font({ size: 34 })]}>🐸</Text>
        <Spacer />
        <VStack alignment="trailing">
          <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle(accent)]}>
            {props.streak}
          </Text>
          <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#888888')]}>
            DAY STREAK
          </Text>
        </VStack>
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{props.nudge}</Text>
    </VStack>
  );
};

export default createWidget('BobWidget', BobWidget);
