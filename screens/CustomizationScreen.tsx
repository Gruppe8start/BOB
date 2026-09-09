import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const STUDY_LEVELS = ['High School', 'University', 'Self-taught', 'Other'];
const REMINDER_MODES = [
  { label: 'Chill', sub: 'gentle nudges' },
  { label: 'Firm', sub: 'regular check-ins' },
  { label: 'Brutal', sub: "Bob doesn't hold back" },
];
const DISTRACTING_APPS = ['Instagram', 'TikTok', 'YouTube', 'Twitter/X', 'Snapchat', 'WhatsApp', 'Reddit', 'Netflix'];

type Props = {
  onSave: () => void;
};

export default function CustomizationScreen({ onSave }: Props) {
  const [name, setName] = useState('');
  const [studies, setStudies] = useState('');
  const [studyLevel, setStudyLevel] = useState('');
  const [reminderMode, setReminderMode] = useState('');
  const [distractingApps, setDistractingApps] = useState<string[]>([]);

  function toggleApp(app: string) {
    setDistractingApps(prev =>
      prev.includes(app) ? prev.filter(a => a !== app) : [...prev, app]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Nice try.", "Bob needs to know your name. Fill it in.");
      return;
    }
    if (!studyLevel) {
      Alert.alert("Really?", "Pick a study level. It takes two seconds.");
      return;
    }
    if (!reminderMode) {
      Alert.alert("Come on.", "Choose how hard Bob should push you.");
      return;
    }

    await AsyncStorage.setItem('bob_profile', JSON.stringify({
      name: name.trim(),
      studies: studies.trim(),
      studyLevel,
      reminderMode,
      distractingApps,
    }));

    onSave();
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.bobEmoji}>🐸</Text>
          <Text style={styles.title}>Meet Bob.</Text>
          <Text style={styles.subtitle}>
            Your brutally honest, passive-aggressive study companion.{'\n'}Let's get you set up.
          </Text>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>What's your name?</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name..."
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Studies */}
        <View style={styles.section}>
          <Text style={styles.label}>What are you studying?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Computer Science, Law, Medicine..."
            placeholderTextColor="#555"
            value={studies}
            onChangeText={setStudies}
          />
        </View>

        {/* Study Level */}
        <View style={styles.section}>
          <Text style={styles.label}>Study level</Text>
          <View style={styles.chipRow}>
            {STUDY_LEVELS.map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.chip, studyLevel === level && styles.chipSelected]}
                onPress={() => setStudyLevel(level)}
              >
                <Text style={[styles.chipText, studyLevel === level && styles.chipTextSelected]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reminder Mode */}
        <View style={styles.section}>
          <Text style={styles.label}>How hard should Bob push you?</Text>
          <View style={styles.cardRow}>
            {REMINDER_MODES.map(mode => (
              <TouchableOpacity
                key={mode.label}
                style={[styles.modeCard, reminderMode === mode.label && styles.modeCardSelected]}
                onPress={() => setReminderMode(mode.label)}
              >
                <Text style={[styles.modeLabel, reminderMode === mode.label && styles.modeLabelSelected]}>
                  {mode.label}
                </Text>
                <Text style={[styles.modeSub, reminderMode === mode.label && styles.modeSubSelected]}>
                  {mode.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Distracting Apps */}
        <View style={styles.section}>
          <Text style={styles.label}>Which apps distract you?</Text>
          <Text style={styles.hint}>Bob will keep an eye on these.</Text>
          <View style={styles.chipRow}>
            {DISTRACTING_APPS.map(app => (
              <TouchableOpacity
                key={app}
                style={[styles.chip, distractingApps.includes(app) && styles.chipSelected]}
                onPress={() => toggleApp(app)}
              >
                <Text style={[styles.chipText, distractingApps.includes(app) && styles.chipTextSelected]}>
                  {app}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Let's go →</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          "The cost of procrastination is the life you could have lived."
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#4CAF50';
const BG = '#0d0d0d';
const CARD = '#1a1a1a';
const BORDER = '#2a2a2a';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  bobEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
    marginTop: -6,
  },
  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  chipSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  chipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modeCardSelected: {
    borderColor: GREEN,
    backgroundColor: '#1a2e1a',
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    marginBottom: 4,
  },
  modeLabelSelected: {
    color: GREEN,
  },
  modeSub: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
  },
  modeSubSelected: {
    color: '#6abf6a',
  },
  saveButton: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    color: '#333',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
