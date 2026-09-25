import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ensureNotificationPermission, listenForNudgeTaps, setupNotificationChannels } from './lib/notifications';
import { KEYS } from './lib/storage';
import CustomizationScreen from './screens/CustomizationScreen';
import HomeScreen from './screens/HomeScreen';

export type BobProfile = {
  name: string;
  studies: string;
  studyLevel: string;
  reminderMode: string;
  distractingApps: string[];
  notificationsEnabled: boolean;
  usageTrackingEnabled: boolean;
};

export default function App() {
  const [profile, setProfile] = useState<BobProfile | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEYS.profile).then(value => {
      if (value) {
        setProfile(JSON.parse(value));
      }
    });
    if (Platform.OS === 'web') return;
    setupNotificationChannels();
    const sub = listenForNudgeTaps();
    return () => sub.remove();
  }, []);

  async function handleProfileSaved(savedProfile: BobProfile) {
    // Ask right after onboarding, while "Nudges and check-ins" is fresh in their mind.
    if (savedProfile.notificationsEnabled && Platform.OS !== 'web') {
      await ensureNotificationPermission();
    }
    setProfile(savedProfile);
  }

  async function handleProfileChange(nextProfile: BobProfile) {
    setProfile(nextProfile);
    await AsyncStorage.setItem(KEYS.profile, JSON.stringify(nextProfile));
  }

  return (
    <>
      <StatusBar style="light" />
      {profile ? (
        <HomeScreen profile={profile} onProfileChange={handleProfileChange} />
      ) : (
        <CustomizationScreen onSave={handleProfileSaved} />
      )}
    </>
  );
}
