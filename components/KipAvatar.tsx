import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVisibleLook } from '../lib/kipContext';
import { GLASSES, HATS, NECKWEAR, skinSource, type KipLook } from '../lib/kipLook';

type Props = {
  size: number;
  /** Draw this look instead of the user's (used for previews in the wardrobe). */
  look?: KipLook;
  /** Small leaf badge when Kip speaks from his Sage side. */
  sage?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Kip: his artwork in the chosen colour on a tile, with outfit pieces layered on top. */
export default function KipAvatar({ size, look: override, sage, style }: Props) {
  const saved = useVisibleLook();
  const look = override ?? saved;
  const hat = HATS.find(h => h.id === look.hat)?.emoji;
  const glasses = GLASSES.find(g => g.id === look.glasses)?.emoji;
  const neck = NECKWEAR.find(n => n.id === look.neck)?.emoji;

  // Positions are fractions of the tile, measured on the artwork (eyes ~31% down, chin ~52%).
  const overlay = (emoji: string, centerY: number, scale: number, centerX = 0.5) => {
    const fontSize = size * scale;
    const lineHeight = fontSize * 1.2;
    return (
      <View pointerEvents="none" style={[styles.overlay, { top: size * centerY - lineHeight / 2, left: size * (centerX - 0.5), width: size }]}>
        <Text style={{ fontSize, lineHeight }}>{emoji}</Text>
      </View>
    );
  };

  return (
    <View style={[{ width: size, height: size }, style]} accessibilityLabel="Kip the frog">
      <View style={[styles.tile, { borderRadius: size * 0.22, backgroundColor: look.background }]}>
        <Image source={skinSource(look.skin)} style={{ width: size, height: size }} />
      </View>
      {neck ? overlay(neck, 0.56, 0.2) : null}
      {glasses ? overlay(glasses, 0.31, 0.36, 0.52) : null}
      {hat ? overlay(hat, 0.04, 0.34, 0.5) : null}
      {sage ? (
        <View style={[styles.badge, { width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17, right: -size * 0.06, bottom: -size * 0.06 }]}>
          <Text style={{ fontSize: size * 0.2 }}>🌿</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: '100%', height: '100%', overflow: 'hidden' },
  overlay: { position: 'absolute', alignItems: 'center' },
  badge: { position: 'absolute', backgroundColor: '#2F5D57', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0d0d0d' },
});
