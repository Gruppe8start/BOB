import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PopupEvent } from '../lib/triggers';
import BobAvatar from './BobAvatar';

type Props = {
  event: PopupEvent | null;
  onAction: () => void;
  onDismiss: () => void;
};

/** Bob sliding into the bottom-right corner of the screen. In-app only, both platforms. */
export default function BobPopup({ event, onAction, onDismiss }: Props) {
  const slide = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: event ? 1 : 0,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [event, slide]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] });
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <Animated.View
      pointerEvents={event ? 'box-none' : 'none'}
      style={[styles.wrap, { opacity: slide, transform: [{ translateX }] }]}
    >
      {event && (
        <View style={styles.bubble}>
          <Pressable style={styles.close} onPress={onDismiss} hitSlop={10}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.body}>{event.body}</Text>
          <Pressable style={styles.action} onPress={onAction}>
            <Text style={styles.actionText}>{event.actionLabel}</Text>
          </Pressable>
        </View>
      )}
      <Animated.View style={[styles.face, { transform: [{ translateY }, { rotate }] }]}>
        <BobAvatar size={64} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, bottom: 28, maxWidth: 300, alignItems: 'flex-end' },
  bubble: {
    backgroundColor: '#18331d',
    borderColor: '#4caf50',
    borderWidth: 1,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 14,
    paddingRight: 30,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  close: { position: 'absolute', top: 6, right: 10 },
  closeText: { color: '#6abf6a', fontSize: 20, fontWeight: '700' },
  title: { color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  body: { color: '#a5c5a8', fontSize: 12, lineHeight: 17 },
  action: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#4caf50', borderRadius: 8 },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  face: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    borderRadius: 14,
  },
});
