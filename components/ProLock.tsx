import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKip } from '../lib/kipContext';
import { COLORS } from '../lib/theme';

type Props = {
  feature: string;
  tier?: 'Pro' | 'Premium' | 'Sage';
  detail?: string;
};

/** Stand-in for a feature the current plan doesn't include. */
export default function ProLock({ feature, tier = 'Pro', detail }: Props) {
  const { openPlans } = useKip();
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.badge}>{tier.toUpperCase()}</Text>
        <Text style={styles.title}>{feature}</Text>
      </View>
      {detail && <Text style={styles.detail}>{detail}</Text>}
      <Pressable style={styles.button} onPress={openPlans}>
        <Text style={styles.buttonText}>See plans</Text>
      </Pressable>
    </View>
  );
}

export function TierBadge({ tier }: { tier: 'Pro' | 'Premium' | 'Sage' }) {
  return <Text style={styles.badge}>{tier.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#3a3320' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { color: '#1a1400', backgroundColor: '#E6B84A', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  detail: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  button: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#E6B84A', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  buttonText: { color: '#1a1400', fontSize: 13, fontWeight: '800' },
});
