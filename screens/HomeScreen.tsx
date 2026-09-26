import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BobProfile } from '../App';
import BobAvatar from '../components/BobAvatar';
import BobPopup from '../components/BobPopup';
import type { Trigger } from '../lib/bobVoice';
import {
  focusMinutes,
  formatMinutes,
  loadTemplates,
  logsForDay,
  newId,
  saveTemplates,
  type SessionLog,
  type SessionTemplate,
} from '../lib/sessions';
import type { StreakState } from '../lib/streak';
import { COLORS } from '../lib/theme';
import { evaluateTriggers, goalCheckIn, type PopupEvent } from '../lib/triggers';
import type { UsageSummary } from '../lib/usage';

type Props = {
  profile: BobProfile;
  streak: StreakState;
  usage: UsageSummary | null;
  logs: SessionLog[];
  /** Only the visible tab evaluates popup triggers. */
  active: boolean;
  onSessionFinished: (log: SessionLog) => Promise<StreakState>;
};

type Run = {
  name: string;
  plannedMinutes: number;
  startedAt: number;
  /** Null while paused. */
  endsAt: number | null;
  remainingSec: number;
};

const TRIGGER_CHECK_MS = 15_000;
const DURATION_PRESETS = [15, 25, 45, 60, 90];
const MAX_MINUTES = 240;

function formatClock(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function HomeScreen({ profile, streak, usage, logs, active, onSessionFinished }: Props) {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [popup, setPopup] = useState<PopupEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMinutes, setFormMinutes] = useState('25');

  const lastInteraction = useRef(Date.now());
  const shownTriggers = useRef(new Set<Trigger>());

  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, []);

  const todayLogs = logsForDay(logs);
  const todayFocus = focusMinutes(todayLogs);
  const todayDone = todayLogs.filter(l => l.completed).length;

  const finish = useCallback(async (current: Run, completed: boolean) => {
    setRun(null);
    const focusedSec = completed ? current.plannedMinutes * 60 : current.plannedMinutes * 60 - current.remainingSec;
    if (!completed && focusedSec < 60) return; // barely started: not worth a log entry
    const next = await onSessionFinished({
      id: newId(),
      name: current.name,
      plannedMinutes: current.plannedMinutes,
      focusedMinutes: Math.round(focusedSec / 60),
      completed,
      startedAt: current.startedAt,
      endedAt: Date.now(),
    });
    if (completed) setPopup(goalCheckIn(profile, next));
  }, [onSessionFinished, profile]);

  const finishRef = useRef(finish);
  finishRef.current = finish;
  const runRef = useRef(run);
  runRef.current = run;

  // Timer runs off an end timestamp so it stays correct if the app is backgrounded.
  useEffect(() => {
    if (!run || run.endsAt === null) return;
    const timer = setInterval(() => {
      const current = runRef.current;
      if (!current || current.endsAt === null) return;
      const remainingSec = Math.max(0, Math.round((current.endsAt - Date.now()) / 1000));
      if (remainingSec === 0) {
        runRef.current = null;
        finishRef.current({ ...current, remainingSec: 0 }, true);
      } else {
        setRun({ ...current, remainingSec });
      }
    }, 500);
    return () => clearInterval(timer);
  }, [run?.endsAt]);

  // In-app corner popup triggers.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (popup) return;
      const event = evaluateTriggers({
        profile,
        streak,
        usage,
        isFocusing: run?.endsAt != null,
        idleMs: Date.now() - lastInteraction.current,
        shown: shownTriggers.current,
      });
      if (!event) return;
      shownTriggers.current.add(event.trigger);
      if (event.trigger === 'inactivity') lastInteraction.current = Date.now();
      setPopup(event);
    }, TRIGGER_CHECK_MS);
    return () => clearInterval(timer);
  }, [active, popup, profile, streak, usage, run?.endsAt]);

  function startSession(template: SessionTemplate) {
    const now = Date.now();
    setRun({
      name: template.name,
      plannedMinutes: template.minutes,
      startedAt: now,
      endsAt: now + template.minutes * 60_000,
      remainingSec: template.minutes * 60,
    });
  }

  function togglePause() {
    setRun(current => {
      if (!current) return current;
      return current.endsAt === null
        ? { ...current, endsAt: Date.now() + current.remainingSec * 1000 }
        : { ...current, endsAt: null };
    });
  }

  async function addTemplate() {
    const minutes = Math.round(Number(formMinutes));
    if (!Number.isFinite(minutes) || minutes < 1) return;
    const template = {
      id: newId(),
      name: formName.trim() || 'Study session',
      minutes: Math.min(minutes, MAX_MINUTES),
    };
    const next = [...templates, template];
    setTemplates(next);
    await saveTemplates(next);
    setFormOpen(false);
    setFormName('');
    setFormMinutes('25');
  }

  async function removeTemplate(id: string) {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    await saveTemplates(next);
  }

  function handlePopupAction() {
    const trigger = popup?.trigger;
    setPopup(null);
    if (trigger && trigger !== 'goalCheckIn' && !run && templates[0]) startSession(templates[0]);
  }

  const minutesValid = Number(formMinutes) >= 1;
  const progress = run ? 1 - run.remainingSec / (run.plannedMinutes * 60) : 0;

  return (
    <SafeAreaView style={styles.root} onTouchStart={() => (lastInteraction.current = Date.now())}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topline}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>STUDY FOCUS / TODAY</Text>
            <Text style={styles.greeting}>Hey, {profile.name}.</Text>
          </View>
          <BobAvatar size={56} />
        </View>

        <View style={styles.todayRow}>
          <Text style={styles.todayText}>
            <Text style={styles.todayValue}>{formatMinutes(todayFocus)}</Text> focused ·{' '}
            <Text style={styles.todayValue}>{todayDone}</Text> {todayDone === 1 ? 'session' : 'sessions'} ·{' '}
            <Text style={styles.todayValue}>{streak.count}</Text>-day streak
          </Text>
        </View>

        <View style={styles.heroCard}>
          {run ? (
            <>
              <Text style={styles.cardKicker}>{run.endsAt === null ? 'PAUSED' : 'IN SESSION'}</Text>
              <Text style={styles.mission}>{run.name}</Text>
              <Text style={styles.missionSub}>{formatMinutes(run.plannedMinutes)} · {profile.reminderMode} mode</Text>
              <Text style={styles.timer}>{formatClock(run.remainingSec)}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <View style={styles.runButtons}>
                <Pressable style={[styles.primaryButton, styles.flex]} onPress={togglePause}>
                  <Text style={styles.primaryButtonText}>{run.endsAt === null ? 'Resume' : 'Pause'}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => finish(run, false)}>
                  <Text style={styles.secondaryButtonText}>End</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardKicker}>CURRENT MISSION</Text>
              <Text style={styles.mission}>{profile.studies || 'Make meaningful progress'}</Text>
              <Text style={styles.missionSub}>Pick a session below, or make your own.</Text>
              {templates[0] && (
                <Pressable style={[styles.primaryButton, styles.heroStart]} onPress={() => startSession(templates[0])}>
                  <Text style={styles.primaryButtonText}>
                    Start {templates[0].name} · {formatMinutes(templates[0].minutes)}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My sessions</Text>
          {!formOpen && (
            <Pressable style={styles.newButton} onPress={() => setFormOpen(true)}>
              <Text style={styles.newButtonText}>+ New session</Text>
            </Pressable>
          )}
        </View>

        {formOpen && (
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Anatomy flashcards"
              placeholderTextColor="#555"
              value={formName}
              onChangeText={setFormName}
              maxLength={40}
            />
            <Text style={styles.formLabel}>How long?</Text>
            <View style={styles.chipRow}>
              {DURATION_PRESETS.map(m => {
                const selected = formMinutes === String(m);
                return (
                  <Pressable key={m} style={[styles.chip, selected && styles.chipSelected]} onPress={() => setFormMinutes(String(m))}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{formatMinutes(m)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <TextInput
                style={[styles.input, styles.minutesInput]}
                value={formMinutes}
                onChangeText={text => setFormMinutes(text.replace(/[^0-9]/g, '').slice(0, 3))}
                keyboardType="number-pad"
                accessibilityLabel="Duration in minutes"
              />
              <Text style={styles.customUnit}>minutes (max {MAX_MINUTES})</Text>
            </View>
            <View style={styles.runButtons}>
              <Pressable style={[styles.primaryButton, styles.flex, !minutesValid && styles.disabled]} onPress={addTemplate} disabled={!minutesValid}>
                <Text style={styles.primaryButtonText}>Save session</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setFormOpen(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {templates.length === 0 && !formOpen && (
          <Text style={styles.empty}>No sessions yet. Make one with “+ New session”.</Text>
        )}

        {templates.map(t => (
          <View key={t.id} style={styles.sessionRow}>
            <View style={styles.flex}>
              <Text style={styles.sessionName}>{t.name}</Text>
              <Text style={styles.sessionMeta}>{formatMinutes(t.minutes)}</Text>
            </View>
            <Pressable
              style={[styles.startButton, run !== null && styles.disabled]}
              onPress={() => startSession(t)}
              disabled={run !== null}
            >
              <Text style={styles.startButtonText}>Start</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => removeTemplate(t.id)} hitSlop={8} accessibilityLabel={`Delete ${t.name}`}>
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <BobPopup event={popup} onAction={handlePopupAction} onDismiss={() => setPopup(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 28, paddingBottom: 140 },
  flex: { flex: 1 },
  topline: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  eyebrow: { color: COLORS.accentSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  greeting: { color: COLORS.text, fontSize: 30, fontWeight: '800' },
  todayRow: { marginBottom: 18 },
  todayText: { color: COLORS.textMuted, fontSize: 13 },
  todayValue: { color: COLORS.text, fontWeight: '800' },
  heroCard: { backgroundColor: '#1a1a1a', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 22, marginBottom: 28 },
  cardKicker: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  mission: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 10 },
  missionSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 6 },
  timer: { color: COLORS.text, fontSize: 62, fontWeight: '300', letterSpacing: 1, marginTop: 22, marginBottom: 14 },
  progressTrack: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: 6, backgroundColor: COLORS.accent, borderRadius: 3 },
  runButtons: { flexDirection: 'row', gap: 10 },
  heroStart: { marginTop: 20 },
  primaryButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center' },
  primaryButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  secondaryButton: { borderRadius: 12, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#3a3a3a' },
  secondaryButtonText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  newButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.accent },
  newButtonText: { color: COLORS.accentSoft, fontSize: 13, fontWeight: '800' },
  formCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  formLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardRaised },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: COLORS.text, fontWeight: '800' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  minutesInput: { width: 80, textAlign: 'center', marginBottom: 0 },
  customUnit: { color: COLORS.textMuted, fontSize: 13 },
  empty: { color: COLORS.textMuted, fontSize: 13, marginBottom: 12 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  sessionName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  sessionMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },
  startButton: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  startButtonText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  deleteButton: { marginLeft: 12, paddingHorizontal: 4 },
  deleteText: { color: COLORS.textMuted, fontSize: 22, fontWeight: '700' },
});
