import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ReminderMode } from '../lib/bobVoice';
import { useKip } from '../lib/kipContext';
import type { PhraseTrigger } from '../lib/personality';
import { newId } from '../lib/sessions';
import { COLORS } from '../lib/theme';
import ProLock from './ProLock';

const TONES: { id: ReminderMode; hint: string }[] = [
  { id: 'Chill', hint: 'gentle nudges' },
  { id: 'Firm', hint: 'regular check-ins' },
  { id: 'Brutal', hint: "doesn't hold back" },
];
const MIXES = [
  { label: 'Never', value: 0 },
  { label: 'Sometimes', value: 0.25 },
  { label: 'Often', value: 0.5 },
];
const TRIGGERS: { id: PhraseTrigger; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: 'inactivity', label: 'When idle' },
  { id: 'streakAtRisk', label: 'Streak at risk' },
  { id: 'goalCheckIn', label: 'Session done' },
  { id: 'distraction', label: 'Distracted' },
  { id: 'examSoon', label: 'Exam coming' },
];

type Props = {
  reminderMode: string;
  onReminderModeChange: (mode: ReminderMode) => void;
};

/** Kip's tone for everyone; his custom phrases are Pro. */
export default function PersonalityPanel({ reminderMode, onReminderModeChange }: Props) {
  const { ent, personality, setPersonality } = useKip();
  const [text, setText] = useState('');
  const [trigger, setTrigger] = useState<PhraseTrigger>('any');

  function addPhrase() {
    const clean = text.trim();
    if (!clean) return;
    setPersonality({ ...personality, phrases: [...personality.phrases, { id: newId(), trigger, text: clean }] });
    setText('');
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.label}>How hard Kip pushes you</Text>
        <View style={styles.row}>
          {TONES.map(t => (
            <Chip key={t.id} label={`${t.id} · ${t.hint}`} selected={reminderMode === t.id} onPress={() => onReminderModeChange(t.id)} />
          ))}
        </View>
      </View>

      {!ent.pro ? (
        <ProLock feature="Kip's custom personality" detail="Write your own lines for Kip and choose how often he uses them in popups and notifications." />
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>How often Kip uses your own lines</Text>
          <View style={styles.row}>
            {MIXES.map(m => (
              <Chip key={m.label} label={m.label} selected={personality.phraseMix === m.value} onPress={() => setPersonality({ ...personality, phraseMix: m.value })} />
            ))}
          </View>

          <Text style={styles.label}>Your lines for Kip</Text>
          {personality.phrases.length === 0 && <Text style={styles.hint}>None yet. Use {'{name}'} for your name.</Text>}
          {personality.phrases.map(p => (
            <View key={p.id} style={styles.phraseRow}>
              <View style={styles.flex}>
                <Text style={styles.phraseText}>“{p.text}”</Text>
                <Text style={styles.phraseMeta}>{TRIGGERS.find(t => t.id === p.trigger)?.label}</Text>
              </View>
              <Pressable onPress={() => setPersonality({ ...personality, phrases: personality.phrases.filter(x => x.id !== p.id) })} hitSlop={8} accessibilityLabel="Delete line">
                <Text style={styles.delete}>×</Text>
              </Pressable>
            </View>
          ))}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={'e.g. "The library misses you, {name}."'}
            placeholderTextColor="#555"
            maxLength={120}
          />
          <View style={styles.row}>
            {TRIGGERS.map(t => <Chip key={t.id} label={t.label} selected={trigger === t.id} onPress={() => setTrigger(t.id)} />)}
          </View>
          <Pressable style={[styles.addButton, !text.trim() && styles.disabled]} onPress={addPhrase} disabled={!text.trim()}>
            <Text style={styles.addText}>Add line</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  hint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardRaised },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: COLORS.text, fontWeight: '800' },
  phraseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardRaised, borderRadius: 10, padding: 10, marginBottom: 8 },
  phraseText: { color: COLORS.text, fontSize: 13 },
  phraseMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  delete: { color: COLORS.textMuted, fontSize: 22, fontWeight: '700', marginLeft: 10 },
  input: { backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text, marginTop: 8, marginBottom: 10 },
  addButton: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  addText: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.4 },
});
