import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { showAlert } from '../lib/alert';
import { useKip } from '../lib/kipContext';
import { PLANS, SAGE_ADDON, type PlanId } from '../lib/plan';
import { referralCode, shareReferral } from '../lib/referral';
import { COLORS } from '../lib/theme';

type Props = { onClose: () => void };

const FEATURES: { label: string; tier: 'Free' | 'Premium' | 'Pro'; soon?: boolean }[] = [
  { label: 'Kip, your sessions, timer and streak', tier: 'Free' },
  { label: 'Today and 7-day stats', tier: 'Free' },
  { label: 'Dress up Kip: colours, backgrounds, outfits', tier: 'Premium' },
  { label: 'Compare against your own past weeks', tier: 'Premium' },
  { label: 'Invite friends with a referral code', tier: 'Premium' },
  { label: 'Friend leaderboard', tier: 'Premium', soon: true },
  { label: "Kip's custom personality: your own lines", tier: 'Pro' },
  { label: 'Exam countdowns that turn up the pressure', tier: 'Pro' },
  { label: 'Calendar: exams and free study time', tier: 'Pro' },
  { label: 'Distraction alarm (AlarmKit / full-screen alert)', tier: 'Pro' },
  { label: 'Detailed analytics: patterns, history, trends', tier: 'Pro' },
  { label: 'AI study plan that adapts to you', tier: 'Pro', soon: true },
  { label: 'AI summary of your analytics', tier: 'Pro', soon: true },
];

export default function PlansScreen({ onClose }: Props) {
  const { subscription, ent, setSubscription } = useKip();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (ent.premium) referralCode().then(setCode);
  }, [ent.premium]);

  function choose(plan: PlanId) {
    if (plan === subscription.plan) return;
    if (plan === 'free') {
      setSubscription({ plan: 'free', sage: false, testMode: false });
      return;
    }
    showAlert(
      'Payments are not live yet',
      'Buying needs App Store / Google Play billing, which comes with the store release. Turn on "Test unlock" below to try every feature for free in the meantime.'
    );
  }

  function toggleTest(on: boolean) {
    setSubscription(on ? { plan: 'pro', sage: true, testMode: true } : { plan: 'free', sage: false, testMode: false });
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Kip plans</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.lead}>
          You're on <Text style={styles.strong}>{PLANS.find(p => p.id === subscription.plan)?.name}</Text>
          {ent.sage ? ' + Sage' : ''}{subscription.testMode ? ' (test unlock)' : ''}.
        </Text>

        {PLANS.map(plan => {
          const current = plan.id === subscription.plan;
          return (
            <Pressable key={plan.id} style={[styles.plan, current && styles.planCurrent, plan.id === 'pro' && styles.planPro]} onPress={() => choose(plan.id)}>
              <View style={styles.planTop}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
              <Text style={styles.planNote}>{plan.note}</Text>
              {current && <Text style={styles.currentTag}>CURRENT PLAN</Text>}
            </Pressable>
          );
        })}

        <View style={[styles.plan, styles.sage]}>
          <View style={styles.planTop}>
            <Text style={styles.planName}>🌿 {SAGE_ADDON.name}</Text>
            <Text style={styles.planPrice}>{SAGE_ADDON.price}</Text>
          </View>
          <Text style={styles.planNote}>{SAGE_ADDON.note}. Kip's kind, motivational side helps you rebalance social media use with a one-week programme.</Text>
          {ent.sage && <Text style={styles.currentTag}>ACTIVE</Text>}
        </View>

        <Text style={styles.section}>What's included</Text>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.feature}>
            <Text style={[styles.tier, f.tier === 'Pro' ? styles.tierPro : f.tier === 'Premium' ? styles.tierPremium : styles.tierFree]}>{f.tier}</Text>
            <Text style={styles.featureText}>{f.label}{f.soon ? ' (coming soon)' : ''}</Text>
          </View>
        ))}

        {ent.premium && code && (
          <>
            <Text style={styles.section}>Invite friends</Text>
            <View style={styles.referral}>
              <Text style={styles.code} selectable>{code}</Text>
              <Text style={styles.planNote}>Friends get the annual plan for 15 CHF instead of 20. Code redemption goes live with the store release.</Text>
              <Pressable style={styles.shareButton} onPress={() => shareReferral(code)}>
                <Text style={styles.shareText}>Share code</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.testRow}>
          <View style={styles.flex}>
            <Text style={styles.testTitle}>Test unlock</Text>
            <Text style={styles.planNote}>Unlocks Pro + Sage without paying, for testing before the store release.</Text>
          </View>
          <Switch value={subscription.testMode} onValueChange={toggleTest} trackColor={{ false: COLORS.border, true: '#4a8f4d' }} thumbColor="#fff" />
        </View>
        <Text style={styles.fine}>Voice features are not part of any plan.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 28, paddingBottom: 60 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '800' },
  close: { color: COLORS.textMuted, fontSize: 34, fontWeight: '600' },
  lead: { color: COLORS.textMuted, fontSize: 14, marginTop: 6, marginBottom: 18 },
  strong: { color: COLORS.text, fontWeight: '800' },
  plan: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  planCurrent: { borderColor: COLORS.accent },
  planPro: { borderColor: '#E6B84A' },
  sage: { borderColor: '#2F5D57' },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  planName: { color: COLORS.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  planPrice: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  planNote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  currentTag: { color: COLORS.accentSoft, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  section: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  tier: { width: 64, textAlign: 'center', fontSize: 10, fontWeight: '900', letterSpacing: 0.6, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  tierFree: { color: COLORS.textSecondary, backgroundColor: '#262626' },
  tierPremium: { color: '#d6e8d7', backgroundColor: '#244d2b' },
  tierPro: { color: '#1a1400', backgroundColor: '#E6B84A' },
  featureText: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  referral: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16 },
  code: { color: COLORS.text, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  shareButton: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  shareText: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginTop: 22 },
  testTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  fine: { color: '#555', fontSize: 11, marginTop: 14 },
});
