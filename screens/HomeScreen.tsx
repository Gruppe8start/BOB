import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BobProfile } from '../App';
import BobAvatar from '../components/BobAvatar';
import BobPopup from '../components/BobPopup';
import ReachPanel from '../components/ReachPanel';
import type { Trigger } from '../lib/bobVoice';
import { applyDistractionWatch, loadAlarmSettings } from '../lib/distractionAlarm';
import { replanNudges } from '../lib/notifications';
import { loadStreak, recordStudyToday, type StreakState } from '../lib/streak';
import { evaluateTriggers, goalCheckIn, type PopupEvent } from '../lib/triggers';
import { getTodayUsage, type UsageSummary } from '../lib/usage';
import { updateWidgets } from '../lib/widget';

type Props = {
  profile: BobProfile;
  onProfileChange: (profile: BobProfile) => void;
};

const FOCUS_SECONDS = 25 * 60;
const TRIGGER_CHECK_MS = 15_000;

export default function HomeScreen({ profile, onProfileChange }: Props) {
  const [streak, setStreak] = useState<StreakState>({ count: 0, lastStudyDay: null });
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [popup, setPopup] = useState<PopupEvent | null>(null);

  const lastInteraction = useRef(Date.now());
  const shownTriggers = useRef(new Set<Trigger>());
  const isFocusing = endsAt !== null;

  // Re-syncs everything that lives outside this screen: notifications, widget, watchers.
  const syncOutside = useCallback(async (currentStreak?: StreakState) => {
    const s = currentStreak ?? (await loadStreak());
    setStreak(s);
    setUsage(await getTodayUsage(profile.distractingApps));
    await Promise.allSettled([
      replanNudges(profile, s),
      updateWidgets(profile, s),
      loadAlarmSettings(profile.reminderMode).then(settings => applyDistractionWatch(profile, settings)),
    ]);
  }, [profile]);

  useEffect(() => {
    syncOutside();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        lastInteraction.current = Date.now();
        syncOutside();
      }
    });
    return () => sub.remove();
  }, [syncOutside]);

  const completeBlock = useCallback(async () => {
    const next = await recordStudyToday();
    setPopup(goalCheckIn(profile, next));
    await syncOutside(next);
  }, [profile, syncOutside]);

  const completeRef = useRef(completeBlock);
  completeRef.current = completeBlock;

  // Timer is based on an end timestamp so it stays correct if the app is backgrounded.
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setEndsAt(null);
        setSecondsLeft(FOCUS_SECONDS);
        completeRef.current();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  // In-app corner popup triggers.
  useEffect(() => {
    const timer = setInterval(() => {
      if (popup) return;
      const event = evaluateTriggers({
        profile,
        streak,
        usage,
        isFocusing,
        idleMs: Date.now() - lastInteraction.current,
        shown: shownTriggers.current,
      });
      if (!event) return;
      shownTriggers.current.add(event.trigger);
      if (event.trigger === 'inactivity') lastInteraction.current = Date.now();
      setPopup(event);
    }, TRIGGER_CHECK_MS);
    return () => clearInterval(timer);
  }, [popup, profile, streak, usage, isFocusing]);

  function toggleFocus() {
    if (endsAt !== null) {
      setEndsAt(null);
    } else {
      setEndsAt(Date.now() + secondsLeft * 1000);
    }
  }

  function handlePopupAction() {
    const trigger = popup?.trigger;
    setPopup(null);
    if (trigger && trigger !== 'goalCheckIn' && !isFocusing) toggleFocus();
  }

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <SafeAreaView style={styles.root} onTouchStart={() => (lastInteraction.current = Date.now())}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topline}>
          <View>
            <Text style={styles.eyebrow}>STUDY FOCUS / TODAY</Text>
            <Text style={styles.greeting}>Hey, {profile.name}.</Text>
          </View>
          <BobAvatar size={56} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.cardKicker}>CURRENT MISSION</Text>
          <Text style={styles.mission}>{profile.studies || 'Make meaningful progress'}</Text>
          <Text style={styles.missionSub}>{profile.reminderMode} mode · one block at a time</Text>
          <Text style={styles.timer}>{minutes}:{seconds}</Text>
          <Pressable style={styles.primaryButton} onPress={toggleFocus}>
            <Text style={styles.primaryButtonText}>{isFocusing ? 'Pause focus' : 'Start focus block'}</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak.count}</Text>
            <Text style={styles.statLabel}>DAY STREAK</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{usage ? `${usage.totalMinutes}m` : '–'}</Text>
            <Text style={styles.statLabel}>DISTRACTED TODAY</Text>
          </View>
          <View style={[styles.stat, styles.statLast]}>
            <Text style={styles.statValue}>{profile.distractingApps.length}</Text>
            <Text style={styles.statLabel}>WATCHED APPS</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Bob's reach</Text>
        <ReachPanel
          profile={profile}
          streak={streak}
          onProfileChange={onProfileChange}
          onPermissionsChanged={syncOutside}
        />
      </ScrollView>

      <BobPopup event={popup} onAction={handlePopupAction} onDismiss={() => setPopup(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 24, paddingTop: 28, paddingBottom: 140 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  eyebrow: { color: '#6abf6a', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  greeting: { color: '#fff', fontSize: 30, fontWeight: '800' },
  heroCard: { backgroundColor: '#1a1a1a', borderRadius: 18, borderWidth: 1, borderColor: '#2a2a2a', padding: 22, marginBottom: 14 },
  cardKicker: { color: '#777', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  mission: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 10 },
  missionSub: { color: '#777', fontSize: 13, marginTop: 6 },
  timer: { color: '#fff', fontSize: 62, fontWeight: '300', letterSpacing: 1, marginTop: 26, marginBottom: 18 },
  primaryButton: { backgroundColor: '#4caf50', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statsRow: { flexDirection: 'row', backgroundColor: '#141414', borderRadius: 14, paddingVertical: 17, marginBottom: 30 },
  stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#292929' },
  statLast: { borderRightWidth: 0 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 5 },
  statLabel: { color: '#666', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
});
