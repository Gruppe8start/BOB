import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op, so fall back to the browser's own dialog.
export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
