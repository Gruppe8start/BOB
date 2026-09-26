import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BobProfile } from '../App';
import BobAvatar from '../components/BobAvatar';
import ReachPanel from '../components/ReachPanel';
import type { StreakState } from '../lib/streak';
import { COLORS } from '../lib/theme';

type Props = {
  profile: BobProfile;
  streak: StreakState;
  onProfileChange: (profile: BobProfile) => void;
  onPermissionsChanged: () => void;
};

export default function SettingsScreen({ profile, streak, onProfileChange, onPermissionsChanged }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.title}>You & Kip</Text>

        <View style={styles.profile}>
          <BobAvatar size={52} />
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

        <Text style={styles.sectionTitle}>Kip's reach</Text>
        <ReachPanel
          profile={profile}
          streak={streak}
          onProfileChange={onProfileChange}
          onPermissionsChanged={onPermissionsChanged}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 28, paddingBottom: 60 },
  eyebrow: { color: COLORS.accentSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 16 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 24 },
  profileCopy: { flex: 1 },
  profileName: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  profileMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
});
