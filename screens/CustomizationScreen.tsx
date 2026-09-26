import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BobAvatar from '../components/BobAvatar';
import UsageConsent from '../components/UsageConsent';
import { showAlert } from '../lib/alert';

const STUDY_LEVELS = ['High School', 'University', 'Self-taught', 'Other'];
const REMINDER_MODES = [
  { label: 'Chill', sub: 'gentle nudges' },
  { label: 'Firm', sub: 'regular check-ins' },
  { label: 'Brutal', sub: "Kip doesn't hold back" },
];
const DISTRACTING_APPS = ['Instagram', 'TikTok', 'YouTube', 'Twitter/X', 'Snapchat', 'WhatsApp', 'Reddit', 'Netflix', 'Other'];

type Props = {
  onSave: (profile: {
    name: string;
    studies: string;
    studyLevel: string;
    reminderMode: string;
    distractingApps: string[];
    notificationsEnabled: boolean;
    usageTrackingEnabled: boolean;
  }) => void;
};

export default function CustomizationScreen({ onSave }: Props) {
  const [name, setName] = useState('');
  const [studies, setStudies] = useState('');
  const [studyLevel, setStudyLevel] = useState('');
  const [reminderMode, setReminderMode] = useState('');
  const [distractingApps, setDistractingApps] = useState<string[]>([]);
  const [otherApp, setOtherApp] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [usageTrackingEnabled, setUsageTrackingEnabled] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);

  function toggleApp(app: string) {
    setDistractingApps(prev =>
      prev.includes(app) ? prev.filter(a => a !== app) : [...prev, app]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      showAlert("Nice try.", "Kip needs to know your name. Fill it in.");
      return;
    }
    if (!studyLevel) {
      showAlert("Really?", "Pick a study level. It takes two seconds.");
      return;
    }
    if (!reminderMode) {
      showAlert("Come on.", "Choose how hard Kip should push you.");
      return;
    }

    const finalApps = distractingApps
      .map(app => (app === 'Other' ? otherApp.trim() : app))
      .filter(app => app.length > 0);

    const profile = {
      name: name.trim(),
      studies: studies.trim(),
      studyLevel,
      reminderMode,
      distractingApps: finalApps,
      notificationsEnabled,
      usageTrackingEnabled,
    };
    await AsyncStorage.setItem('bob_profile', JSON.stringify(profile));

    onSave(profile);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <BobAvatar size={112} style={styles.bobAvatar} />
          <Text style={styles.title}>Meet Kip.</Text>
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

        <View style={styles.section}>
          <Text style={styles.label}>How should Kip reach you?</Text>
          <View style={styles.permissionRow}>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>Nudges and check-ins</Text>
              <Text style={styles.permissionHint}>You can change this later in system settings.</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: BORDER, true: '#4a8f4d' }} thumbColor="#fff" />
          </View>
          <View style={styles.permissionRow}>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>Opt in to app-usage tracking</Text>
              <Text style={styles.permissionHint}>Kip sees duration, never search terms or private content.</Text>
            </View>
            <Switch
              value={usageTrackingEnabled}
              onValueChange={on => (on ? setConsentVisible(true) : setUsageTrackingEnabled(false))}
              trackColor={{ false: BORDER, true: '#4a8f4d' }}
              thumbColor="#fff"
            />
          </View>
          <UsageConsent
            visible={consentVisible}
            onAccept={() => {
              setUsageTrackingEnabled(true);
              setConsentVisible(false);
            }}
            onDecline={() => setConsentVisible(false)}
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
          <Text style={styles.label}>How hard should Kip push you?</Text>
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
          <Text style={styles.hint}>Kip will keep an eye on these.</Text>
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
          {distractingApps.includes('Other') && (
            <TextInput
              style={[styles.input, styles.otherInput]}
              placeholder="Which app?"
              placeholderTextColor="#555"
              value={otherApp}
              onChangeText={setOtherApp}
            />
          )}
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
  bobAvatar: {
    marginBottom: 14,
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
  otherInput: {
    marginTop: 10,
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
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  permissionCopy: { flex: 1, paddingRight: 12 },
  permissionTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  permissionHint: { color: '#666', fontSize: 11, lineHeight: 16 },
});
