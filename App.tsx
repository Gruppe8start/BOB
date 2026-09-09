import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import CustomizationScreen from './screens/CustomizationScreen';

export default function App() {
  function handleProfileSaved() {
    // TODO: navigate to home screen after onboarding
    console.log('Profile saved!');
  }

  return (
    <>
      <StatusBar style="light" />
      <CustomizationScreen onSave={handleProfileSaved} />
    </>
  );
}

const styles = StyleSheet.create({});
