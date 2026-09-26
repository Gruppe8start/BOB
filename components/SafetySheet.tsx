import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { helpLines } from '../lib/sage/safety';
import { COLORS } from '../lib/theme';

type Props = { visible: boolean; onClose: () => void };

/** Shown instead of continuing the programme when an answer suggests serious distress. */
export default function SafetySheet({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView>
            <Text style={styles.title}>Thank you for telling me</Text>
            <Text style={styles.body}>
              It sounds like things are really heavy right now. You don't have to handle this alone, and
              talking to someone can help. These people are there for exactly this, any time, for free:
            </Text>
            {helpLines().map(line => (
              <Pressable
                key={line.name + (line.phone ?? line.url)}
                style={styles.line}
                onPress={() => Linking.openURL(line.phone ? `tel:${line.phone.replace(/\s/g, '')}` : line.url!)}
              >
                <Text style={styles.lineName}>{line.name}</Text>
                <Text style={styles.lineContact}>{line.phone ?? line.url}</Text>
                <Text style={styles.lineNote}>{line.note}</Text>
              </Pressable>
            ))}
            <Text style={styles.body}>
              If you are in immediate danger, call your local emergency number (112 in Europe).
            </Text>
            <Text style={styles.fine}>
              Sage is a digital wellbeing coach for everyday habits, not a medical or psychological service.
              Your programme is paused for now; your answer was not saved.
            </Text>
          </ScrollView>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
  body: { color: '#ccc', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  line: { backgroundColor: '#1f2b29', borderRadius: 12, padding: 14, marginBottom: 10 },
  lineName: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  lineContact: { color: '#8fd3c4', fontSize: 18, fontWeight: '800', marginTop: 4 },
  lineNote: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  fine: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  close: { backgroundColor: '#2F5D57', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  closeText: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
});
