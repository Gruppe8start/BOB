import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BobProfile } from '../App';
import DataPanel from '../components/DataPanel';
import KipAvatar from '../components/KipAvatar';
import LookPanel from '../components/LookPanel';
import PersonalityPanel from '../components/PersonalityPanel';
import ProLock from '../components/ProLock';
import ReachPanel from '../components/ReachPanel';
import { showAlert } from '../lib/alert';
import { calendarSupported, connectCalendar, disconnectCalendar, isCalendarConnected } from '../lib/calendar';
import { useKip } from '../lib/kipContext';
import { PLANS } from '../lib/plan';
import type { StreakState } from '../lib/streak';
import { COLORS } from '../lib/theme';

type Props = {
  profile: BobProfile;
  streak: StreakState;
  onProfileChange: (profile: BobProfile) => void;
  onPermissionsChanged: () => void;
  onCalendarChanged: () => void;
  onDataDeleted: () => void;
};

export default function SettingsScreen({ profile, streak, onProfileChange, onPermissionsChanged, onCalendarChanged, onDataDeleted }: Props) {
  const { subscription, ent, openPlans } = useKip();
  const [calendarOn, setCalendarOn] = useState(false);

  useEffect(() => {
    isCalendarConnected().then(setCalendarOn).catch(() => setCalendarOn(false));
  }, [ent.pro]);

  async function toggleCalendar() {
    if (calendarOn) {
      await disconnectCalendar();
      setCalendarOn(false);
    } else {
      const granted = await connectCalendar();
      setCalendarOn(granted);
      if (!granted) showAlert('No calendar access', 'Allow calendar access for Kip in your phone settings to use this.');
    }
    onCalendarChanged();
  }

  const planName = PLANS.find(p => p.id === subscription.plan)?.name ?? 'Free';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.title}>You & Kip</Text>

        <View style={styles.profile}>
          <KipAvatar size={52} />
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>
              {[profile.studies, profile.studyLevel, `${profile.reminderMode} mode`].filter(Boolean).join(' · ')}
            </Text>
            {profile.distractingApps.length > 0 && (
              <Text style={styles.profileMeta}>Watching: {profile.distractingApps.join(', ')}</Text>
            )}
          </View>
        </View>

        <Pressable style={styles.planRow} onPress={openPlans}>
          <View style={styles.flex}>
            <Text style={styles.planLabel}>YOUR PLAN</Text>
            <Text style={styles.planName}>
              {planName}{ent.sage ? ' + Sage' : ''}{subscription.testMode ? ' (test unlock)' : ''}
            </Text>
          </View>
          <Text style={styles.planLink}>{ent.pro ? 'Manage' : 'Upgrade'} →</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Kip's look</Text>
        <LookPanel />

        <Text style={styles.sectionTitle}>Kip's personality</Text>
        <PersonalityPanel
          reminderMode={profile.reminderMode}
          onReminderModeChange={mode => onProfileChange({ ...profile, reminderMode: mode })}
        />

        <Text style={styles.sectionTitle}>Calendar</Text>
        {!ent.pro ? (
          <ProLock feature="Connect your calendar" detail="Kip spots exams in your calendar and shows when you have free time to study." />
        ) : !calendarSupported() ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Calendar access works in the phone app (iOS and Android), not in the browser.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{calendarOn ? 'Calendar connected' : 'Connect your calendar'}</Text>
                <Text style={styles.muted}>
                  Read-only. Kip looks for exams and free time; nothing is changed or uploaded.
                </Text>
              </View>
              <Pressable style={calendarOn ? styles.secondaryButton : styles.primaryButton} onPress={toggleCalendar}>
                <Text style={calendarOn ? styles.secondaryText : styles.primaryText}>{calendarOn ? 'Disconnect' : 'Connect'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Kip's reach</Text>
        <ReachPanel
          profile={profile}
          streak={streak}
          onProfileChange={onProfileChange}
          onPermissionsChanged={onPermissionsChanged}
        />

        <Text style={styles.sectionTitle}>Your data</Text>
        <DataPanel onDeleted={onDataDeleted} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 28, paddingBottom: 60 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { color: COLORS.accentSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 16 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12 },
  profileCopy: { flex: 1 },
  profileName: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  profileMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  planRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#3a3320' },
  planLabel: { color: '#E6B84A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  planName: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  planLink: { color: '#E6B84A', fontSize: 13, fontWeight: '800' },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  primaryButton: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  primaryText: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  secondaryButton: { borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 13 },
});
