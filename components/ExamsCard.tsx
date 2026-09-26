import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { examDay, type CalendarEvent } from '../lib/calendar';
import { daysUntil, upcomingExams, urgencyFor, type Exam } from '../lib/exams';
import { useKip } from '../lib/kipContext';
import { newId } from '../lib/sessions';
import { dayKey } from '../lib/storage';
import { COLORS } from '../lib/theme';

type Props = {
  /** Exam-looking events from the connected calendar that aren't added yet. */
  suggestions: CalendarEvent[];
};

const URGENCY_COLOR = { none: COLORS.textSecondary, soon: '#E6B84A', close: '#F08A4B', imminent: '#E5534B' };
const URGENCY_LABEL = { none: '', soon: 'Kip nudges a bit more', close: 'Kip nudges more often', imminent: 'Maximum pressure' };

function formatDate(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ExamsCard({ suggestions }: Props) {
  const { exams, setExams } = useKip();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [offset, setOffset] = useState(14);

  const upcoming = upcomingExams(exams);
  const pendingSuggestions = suggestions.filter(s => !exams.some(e => e.calendarEventId === s.id));

  function dateFromOffset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dayKey(d);
  }

  function add(exam: Omit<Exam, 'id'>) {
    setExams([...exams, { ...exam, id: newId() }]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Exams</Text>
        {!adding && (
          <Pressable onPress={() => setAdding(true)}>
            <Text style={styles.link}>+ Add exam</Text>
          </Pressable>
        )}
      </View>

      {upcoming.length === 0 && !adding && pendingSuggestions.length === 0 && (
        <Text style={styles.muted}>Add an exam and Kip counts down, nudging harder as it gets close.</Text>
      )}

      {upcoming.map(exam => {
        const days = daysUntil(exam);
        const urgency = urgencyFor(days);
        return (
          <View key={exam.id} style={styles.examRow}>
            <View style={[styles.countdown, { borderColor: URGENCY_COLOR[urgency] }]}>
              <Text style={[styles.days, { color: URGENCY_COLOR[urgency] }]}>{days}</Text>
              <Text style={styles.daysLabel}>{days === 1 ? 'day' : 'days'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.examName}>{exam.name}</Text>
              <Text style={styles.muted}>
                {days === 0 ? 'Today. Good luck.' : formatDate(exam.date)}
                {URGENCY_LABEL[urgency] ? ` · ${URGENCY_LABEL[urgency]}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setExams(exams.filter(e => e.id !== exam.id))} hitSlop={8} accessibilityLabel={`Remove ${exam.name}`}>
              <Text style={styles.delete}>×</Text>
            </Pressable>
          </View>
        );
      })}

      {pendingSuggestions.map(event => (
        <View key={event.id} style={styles.suggestion}>
          <Text style={styles.suggestionText} numberOfLines={2}>
            📅 “{event.title}” on {formatDate(examDay(event))}
          </Text>
          <Pressable style={styles.smallButton} onPress={() => add({ name: event.title, date: examDay(event), calendarEventId: event.id })}>
            <Text style={styles.smallButtonText}>Add</Text>
          </Pressable>
        </View>
      ))}

      {adding && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Exam name, e.g. Statistics I"
            placeholderTextColor="#555"
            maxLength={40}
          />
          <Text style={styles.label}>Date</Text>
          <View style={styles.dateRow}>
            {[-7, -1].map(step => (
              <Pressable key={step} style={styles.stepper} onPress={() => setOffset(o => Math.max(0, o + step))}>
                <Text style={styles.stepperText}>{step}</Text>
              </Pressable>
            ))}
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{formatDate(dateFromOffset(offset))}</Text>
              <Text style={styles.muted}>in {offset} {offset === 1 ? 'day' : 'days'}</Text>
            </View>
            {[1, 7].map(step => (
              <Pressable key={step} style={styles.stepper} onPress={() => setOffset(o => Math.min(365, o + step))}>
                <Text style={styles.stepperText}>+{step}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.formButtons}>
            <Pressable
              style={[styles.saveButton, !name.trim() && styles.disabled]}
              disabled={!name.trim()}
              onPress={() => {
                add({ name: name.trim(), date: dateFromOffset(offset) });
                setAdding(false);
                setName('');
                setOffset(14);
              }}
            >
              <Text style={styles.saveText}>Save exam</Text>
            </Pressable>
            <Pressable onPress={() => setAdding(false)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  link: { color: COLORS.accentSoft, fontSize: 13, fontWeight: '800' },
  muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  countdown: { width: 54, height: 54, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  days: { fontSize: 20, fontWeight: '900' },
  daysLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800' },
  examName: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  delete: { color: COLORS.textMuted, fontSize: 22, fontWeight: '700' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardRaised, borderRadius: 10, padding: 10, marginTop: 8 },
  suggestionText: { flex: 1, color: COLORS.textSecondary, fontSize: 12 },
  smallButton: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  smallButtonText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  form: { marginTop: 8 },
  input: { backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepper: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 10, backgroundColor: COLORS.cardRaised },
  stepperText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
  dateBox: { flex: 1, alignItems: 'center' },
  dateText: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  formButtons: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  saveButton: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  saveText: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.4 },
});
