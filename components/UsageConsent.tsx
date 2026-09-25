import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BobAvatar from './BobAvatar';

type Props = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

const isWeb = Platform.OS === 'web';
const SEES = isWeb
  ? ['Which of the sites you chose is in the active tab, and for how long', 'Nothing else: no other sites, no history']
  : ['Which of the apps you chose are open, and for how long', 'Nothing else: no other apps, no browsing history'];
const NEVER = [
  'What you type or search, anywhere (no platform allows this)',
  isWeb ? 'Page content, messages or anything inside those sites' : 'Messages, posts, photos or anything inside those apps',
  isWeb ? 'Anything leaving your computer: usage stays in your browser' : 'Anything leaving your phone: usage stays on this device',
];

/** Explicit opt-in shown before any OS usage-tracking permission is requested. */
export default function UsageConsent({ visible, onAccept, onDecline }: Props) {
  const nextStep = isWeb
    ? "Next, you'll install the BOB browser extension. Your browser shows exactly what it can access before you confirm."
    : `Next, your phone will ask for ${Platform.OS === 'ios' ? 'Screen Time' : 'Usage Access'} permission. That prompt comes from the system and can't be skipped.`;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView>
            <BobAvatar size={80} style={styles.face} />
            <Text style={styles.title}>Let Bob check on you?</Text>
            <Text style={styles.lead}>
              This is you keeping an eye on yourself. Nobody else sees it. You can turn it off any time,
              here or in system settings.
            </Text>

            <Text style={styles.heading}>BOB WILL SEE</Text>
            {SEES.map(line => <Text key={line} style={styles.item}>✓  {line}</Text>)}

            <Text style={styles.heading}>BOB WILL NEVER SEE</Text>
            {NEVER.map(line => <Text key={line} style={styles.item}>✕  {line}</Text>)}

            <Text style={styles.note}>{nextStep}</Text>
          </ScrollView>
          <Pressable style={styles.accept} onPress={onAccept}>
            <Text style={styles.acceptText}>I'm in. Watch me.</Text>
          </Pressable>
          <Pressable style={styles.decline} onPress={onDecline}>
            <Text style={styles.declineText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 36, maxHeight: '88%' },
  face: { alignSelf: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  lead: { color: '#999', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  heading: { color: '#6abf6a', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  item: { color: '#ddd', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  note: { color: '#777', fontSize: 12, lineHeight: 17, marginTop: 16 },
  accept: { backgroundColor: '#4caf50', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  acceptText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  decline: { paddingVertical: 14, alignItems: 'center' },
  declineText: { color: '#888', fontSize: 14, fontWeight: '600' },
});
