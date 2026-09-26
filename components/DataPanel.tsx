import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '../lib/alert';
import { deleteAllData, exportAllData } from '../lib/dataControl';
import { COLORS } from '../lib/theme';

type Props = {
  /** Called after everything is wiped, so the app can go back to onboarding. */
  onDeleted: () => void;
};

/** "Your data": what Kip keeps, export it, delete it. */
export default function DataPanel({ onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    try {
      setBusy(true);
      await exportAllData();
    } catch (error) {
      showAlert('Export failed', String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await deleteAllData();
      onDeleted();
    } catch (error) {
      showAlert('Could not delete everything', String(error));
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        Everything Kip tracks stays on this device: your profile, sessions (60 days), daily minutes per chosen
        app (30 days), exams, Kip's look, and Sage's answers (encrypted). Nothing is sent to a server.
      </Text>

      <Pressable style={[styles.button, busy && styles.disabled]} onPress={handleExport} disabled={busy}>
        <Text style={styles.buttonText}>Export my data</Text>
      </Pressable>
      <Text style={styles.hint}>A readable JSON file with everything, including Sage's answers.</Text>

      <Pressable style={[styles.delete, confirming && styles.deleteConfirm, busy && styles.disabled]} onPress={handleDelete} disabled={busy}>
        <Text style={[styles.deleteText, confirming && styles.deleteTextConfirm]}>
          {confirming ? 'Tap again to delete everything' : 'Delete all my data'}
        </Text>
      </Pressable>
      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.hint}>This can't be undone. Kip starts over from the beginning.</Text>
          <Pressable onPress={() => setConfirming(false)} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Stops tracking and alarms, and removes everything Kip stored.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  text: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  button: { backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  hint: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6, marginBottom: 14, flexShrink: 1 },
  delete: { borderWidth: 1, borderColor: '#5a2a28', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  deleteConfirm: { backgroundColor: '#8a2f2a', borderColor: '#8a2f2a' },
  deleteText: { color: '#e57a73', fontWeight: '800', fontSize: 14 },
  deleteTextConfirm: { color: COLORS.text },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cancel: { color: COLORS.accentSoft, fontWeight: '800', fontSize: 12, marginTop: 6 },
  disabled: { opacity: 0.5 },
});
