import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FreeSlot } from '../lib/calendar';
import { formatMinutes } from '../lib/sessions';
import { COLORS } from '../lib/theme';

type Props = {
  slots: FreeSlot[];
  /** Starts a session right now (only offered while a slot is open). */
  onStartNow: () => void;
  canStart: boolean;
};

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Free study time from the connected calendar (Pro). */
export default function FreeTimeCard({ slots, onStartNow, canStart }: Props) {
  const now = Date.now();
  const openNow = slots.find(s => s.start <= now + 60_000 && s.end > now);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Free time to study today</Text>
      {slots.length === 0 ? (
        <Text style={styles.muted}>Your calendar is full for the rest of today. Tomorrow, then.</Text>
      ) : (
        slots.slice(0, 4).map(s => (
          <View key={s.start} style={styles.slot}>
            <Text style={styles.slotTime}>{clock(s.start)} – {clock(s.end)}</Text>
            <Text style={styles.muted}>{formatMinutes(Math.round((s.end - s.start) / 60_000))} free</Text>
          </View>
        ))
      )}
      {openNow && canStart && (
        <Pressable style={styles.button} onPress={onStartNow}>
          <Text style={styles.buttonText}>You're free right now. Start a session</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  slot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#222' },
  slotTime: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  button: { marginTop: 10, backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  buttonText: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
});
