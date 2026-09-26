import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKip } from '../lib/kipContext';
import { BACKGROUNDS, DEFAULT_LOOK, GLASSES, HATS, NECKWEAR, SKINS, type KipLook } from '../lib/kipLook';
import { COLORS } from '../lib/theme';
import KipAvatar from './KipAvatar';
import ProLock from './ProLock';

/** Premium: Kip's wardrobe. Colour, tile and outfit pieces, with a live preview. */
export default function LookPanel() {
  const { ent, kipLook, setKipLook } = useKip();

  if (!ent.premium) {
    return (
      <>
        <View style={styles.teaser}>
          {[
            { ...DEFAULT_LOOK, skin: 'blue', hat: 'gradCap' },
            { ...DEFAULT_LOOK, skin: 'gold', hat: 'crown', background: '#5E4A1E' },
            { ...DEFAULT_LOOK, skin: 'pink', glasses: 'sunglasses', background: '#4A2C5E' },
          ].map((look, i) => <KipAvatar key={i} size={72} look={look as KipLook} />)}
        </View>
        <ProLock tier="Premium" feature="Dress up Kip" detail="Give Kip a new colour, a background and outfits like a grad cap, crown, shades or a bow tie." />
      </>
    );
  }

  const set = (patch: Partial<KipLook>) => setKipLook({ ...kipLook, ...patch });

  return (
    <View style={styles.card}>
      <View style={styles.preview}>
        <KipAvatar size={140} look={kipLook} />
      </View>

      <Text style={styles.label}>Colour</Text>
      <View style={styles.row}>
        {SKINS.map(s => (
          <Pressable key={s.id} onPress={() => set({ skin: s.id })} style={[styles.swatchWrap, kipLook.skin === s.id && styles.swatchSelected]} accessibilityLabel={s.label}>
            <View style={[styles.swatch, { backgroundColor: s.swatch }]} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Background</Text>
      <View style={styles.row}>
        {BACKGROUNDS.map(c => (
          <Pressable key={c} onPress={() => set({ background: c })} style={[styles.swatchWrap, kipLook.background === c && styles.swatchSelected]} accessibilityLabel={`Background ${c}`}>
            <View style={[styles.swatch, { backgroundColor: c }]} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Hat</Text>
      <Options items={HATS} value={kipLook.hat} onChange={hat => set({ hat })} />
      <Text style={styles.label}>Glasses</Text>
      <Options items={GLASSES} value={kipLook.glasses} onChange={glasses => set({ glasses })} />
      <Text style={styles.label}>Neck</Text>
      <Options items={NECKWEAR} value={kipLook.neck} onChange={neck => set({ neck })} />

      <Pressable onPress={() => setKipLook(DEFAULT_LOOK)} style={styles.reset}>
        <Text style={styles.resetText}>Back to classic Kip</Text>
      </Pressable>
    </View>
  );
}

function Options<T extends string>({ items, value, onChange }: { items: { id: T; label: string; emoji: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.row}>
      {items.map(item => {
        const selected = item.id === value;
        return (
          <Pressable key={item.id} style={[styles.chip, selected && styles.chipSelected]} onPress={() => onChange(item.id)}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.emoji ? `${item.emoji} ` : ''}{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  teaser: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12, paddingTop: 18 },
  preview: { alignItems: 'center', paddingTop: 34, paddingBottom: 12 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchWrap: { padding: 3, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: COLORS.text },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#00000055' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardRaised },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: COLORS.text, fontWeight: '800' },
  reset: { marginTop: 16, alignSelf: 'flex-start' },
  resetText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
});
