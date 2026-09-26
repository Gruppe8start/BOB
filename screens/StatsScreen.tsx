import { useState, type ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BobProfile } from '../App';
import BobAvatar from '../components/BobAvatar';
import { focusMinutes, formatMinutes, lastDays, logsForDay, type SessionLog } from '../lib/sessions';
import { dayKey } from '../lib/storage';
import type { StreakState } from '../lib/streak';
import { COLORS } from '../lib/theme';
import type { UsageSummary } from '../lib/usage';
import type { DayUsage } from '../lib/usageHistory';

type Props = {
  profile: BobProfile;
  streak: StreakState;
  usage: UsageSummary | null;
  usageHistory: Record<string, DayUsage>;
  logs: SessionLog[];
  onOpenSettings: () => void;
};

const CHART_HEIGHT = 140;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(day: string) {
  return WEEKDAY[new Date(`${day}T00:00:00`).getDay()];
}

function longDay(day: string) {
  if (day === dayKey()) return 'Today';
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function timeOfDay(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function kipVerdict(focus: number, distracted: number | null, mode: string) {
  if (focus === 0 && !distracted) return 'Nothing to judge yet. Suspicious.';
  if (distracted !== null && distracted > focus) {
    return mode === 'Chill'
      ? `${distracted} min distracted vs ${focus} min focused. Tomorrow is a new day.`
      : `You scrolled ${distracted} min and studied ${focus}. I'm not mad. I'm writing it down.`;
  }
  return mode === 'Brutal'
    ? `${focus} min of focus. Fine. I'll stop frowning for a second.`
    : `${focus} min of focus today. Keep it going.`;
}

export default function StatsScreen({ profile, streak, usage, usageHistory, logs, onOpenSettings }: Props) {
  const days = lastDays(7);
  const [selectedDay, setSelectedDay] = useState(days[days.length - 1]);

  const todayLogs = logsForDay(logs);
  const todayFocus = focusMinutes(todayLogs);
  const completed = todayLogs.filter(l => l.completed).length;
  const distracted = usage ? usage.totalMinutes : null;
  const total = todayFocus + (distracted ?? 0);
  const focusShare = total > 0 ? Math.round((todayFocus / total) * 100) : null;

  const week = days.map(day => ({
    day,
    focus: focusMinutes(logsForDay(logs, day)),
    sessions: logsForDay(logs, day).length,
    distracted: usageHistory[day]?.totalMinutes ?? null,
  }));
  const weekMax = Math.max(1, ...week.map(d => Math.max(d.focus, d.distracted ?? 0)));
  const selected = week.find(d => d.day === selectedDay) ?? week[week.length - 1];
  const hasUsage = week.some(d => d.distracted !== null);

  const perApp = Object.entries(usage?.perApp ?? {})
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);
  const appMax = Math.max(1, ...perApp.map(([, m]) => m));

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>STATISTICS</Text>
        <Text style={styles.title}>Your day</Text>

        <View style={styles.verdict}>
          <BobAvatar size={44} />
          <Text style={styles.verdictText}>{kipVerdict(todayFocus, distracted, profile.reminderMode)}</Text>
        </View>

        {/* Headline numbers */}
        <View style={styles.tiles}>
          <Tile label="Focused" value={formatMinutes(todayFocus)} swatch={COLORS.focus} />
          <Tile label="Distracted" value={distracted === null ? '–' : formatMinutes(distracted)} swatch={COLORS.distracted} />
          <Tile label="Sessions done" value={`${completed}/${todayLogs.length}`} />
          <Tile label="Day streak" value={String(streak.count)} />
        </View>

        {/* Focus vs distraction split */}
        <Section title="Focus balance today">
          {focusShare === null || distracted === null ? (
            <Text style={styles.muted}>
              {distracted === null
                ? 'Turn on app-usage tracking to compare focus with distraction.'
                : 'No focus or distraction logged yet today.'}
            </Text>
          ) : (
            <>
              <Text style={styles.bigNumber}>{focusShare}% <Text style={styles.bigNumberUnit}>focused</Text></Text>
              <View style={styles.splitBar}>
                {todayFocus > 0 && <View style={[styles.splitSeg, { flex: todayFocus, backgroundColor: COLORS.focus }]} />}
                {distracted > 0 && <View style={[styles.splitSeg, { flex: distracted, backgroundColor: COLORS.distracted }]} />}
              </View>
              <View style={styles.legend}>
                <Legend color={COLORS.focus} label={`Focused ${formatMinutes(todayFocus)}`} />
                <Legend color={COLORS.distracted} label={`Distracted ${formatMinutes(distracted)}`} />
              </View>
            </>
          )}
        </Section>

        {/* Distraction by app */}
        <Section title="Distraction by app today">
          {usage === null ? (
            <View>
              <Text style={styles.muted}>Kip can't see your app usage yet.</Text>
              <Pressable style={styles.linkButton} onPress={onOpenSettings}>
                <Text style={styles.linkButtonText}>Turn on usage tracking →</Text>
              </Pressable>
            </View>
          ) : perApp.length === 0 ? (
            <Text style={styles.muted}>
              {usage.totalMinutes > 0
                ? `${formatMinutes(usage.totalMinutes)} in your distracting apps (this phone only reports a total).`
                : 'Nothing yet. Keep it that way.'}
            </Text>
          ) : (
            perApp.map(([label, minutes]) => (
              <View key={label} style={styles.appRow} accessibilityLabel={`${label}: ${minutes} minutes`}>
                <Text style={styles.appLabel} numberOfLines={1}>{label}</Text>
                <View style={styles.appTrack}>
                  <View style={[styles.appBar, { width: `${Math.max(2, (minutes / appMax) * 100)}%` }]} />
                </View>
                <Text style={styles.appValue}>{formatMinutes(minutes)}</Text>
              </View>
            ))
          )}
        </Section>

        {/* Last 7 days */}
        <Section title="Last 7 days">
          <View style={styles.legend}>
            <Legend color={COLORS.focus} label="Focused" />
            {hasUsage && <Legend color={COLORS.distracted} label="Distracted" />}
          </View>
          <View style={styles.chart}>
            <View style={styles.gridTop}>
              <Text style={styles.axisLabel}>{formatMinutes(weekMax)}</Text>
            </View>
            <View style={styles.columns}>
              {week.map(d => {
                const isSelected = d.day === selected.day;
                return (
                  <Pressable
                    key={d.day}
                    style={[styles.column, isSelected && styles.columnSelected]}
                    onPress={() => setSelectedDay(d.day)}
                    accessibilityLabel={`${longDay(d.day)}: ${d.focus} minutes focused${d.distracted !== null ? `, ${d.distracted} minutes distracted` : ''}`}
                  >
                    <View style={styles.barPair}>
                      <View style={[styles.bar, { height: Math.max(d.focus > 0 ? 3 : 0, (d.focus / weekMax) * CHART_HEIGHT), backgroundColor: COLORS.focus }]} />
                      {hasUsage && (
                        <View style={[styles.bar, { height: Math.max((d.distracted ?? 0) > 0 ? 3 : 0, ((d.distracted ?? 0) / weekMax) * CHART_HEIGHT), backgroundColor: COLORS.distracted }]} />
                      )}
                    </View>
                    <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>{dayLabel(d.day)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailDay}>{longDay(selected.day)}</Text>
            <Text style={styles.detailText}>
              {formatMinutes(selected.focus)} focused · {selected.sessions} {selected.sessions === 1 ? 'session' : 'sessions'}
              {selected.distracted !== null ? ` · ${formatMinutes(selected.distracted)} distracted` : ''}
            </Text>
          </View>
          <Text style={styles.hint}>Tap a day for details.</Text>
        </Section>

        {/* Today's sessions */}
        <Section title="Today's sessions">
          {todayLogs.length === 0 ? (
            <Text style={styles.muted}>No sessions yet today. The Home tab is right there.</Text>
          ) : (
            [...todayLogs].reverse().map(l => (
              <View key={l.id} style={styles.logRow}>
                <Text style={styles.logTime}>{timeOfDay(l.startedAt)}</Text>
                <View style={styles.flex}>
                  <Text style={styles.logName}>{l.name}</Text>
                  <Text style={styles.logMeta}>
                    {formatMinutes(l.focusedMinutes)} of {formatMinutes(l.plannedMinutes)}
                  </Text>
                </View>
                <Text style={l.completed ? styles.logDone : styles.logEarly}>
                  {l.completed ? '✓ Done' : 'Ended early'}
                </Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileLabelRow}>
        {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 28, paddingBottom: 60 },
  flex: { flex: 1 },
  eyebrow: { color: COLORS.accentSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 16 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18331d', borderColor: COLORS.accent, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 16 },
  verdictText: { flex: 1, color: '#d6e8d7', fontSize: 13, lineHeight: 19 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile: { flexGrow: 1, flexBasis: '45%', backgroundColor: COLORS.card, borderRadius: 12, padding: 14 },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  tileValue: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginTop: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  section: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  muted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  bigNumber: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 10 },
  bigNumberUnit: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  splitBar: { flexDirection: 'row', height: 14, gap: 2, marginBottom: 10 },
  splitSeg: { borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: COLORS.textSecondary, fontSize: 12 },
  linkButton: { marginTop: 10, alignSelf: 'flex-start' },
  linkButtonText: { color: COLORS.accentSoft, fontSize: 13, fontWeight: '800' },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  appLabel: { width: 84, color: COLORS.textSecondary, fontSize: 12 },
  appTrack: { flex: 1, height: 12, marginHorizontal: 8 },
  appBar: { height: 12, backgroundColor: COLORS.distracted, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  appValue: { width: 64, textAlign: 'right', color: COLORS.text, fontSize: 12, fontWeight: '700' },
  chart: { marginTop: 10 },
  gridTop: { borderBottomWidth: 1, borderBottomColor: '#262626', borderStyle: 'dashed', marginBottom: -1 },
  axisLabel: { color: COLORS.textMuted, fontSize: 10, marginBottom: 2 },
  columns: { flexDirection: 'row', height: CHART_HEIGHT + 24, alignItems: 'flex-end', borderTopWidth: 0 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', borderRadius: 8 },
  columnSelected: { backgroundColor: '#222' },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderBottomColor: '#333', paddingHorizontal: 2 },
  bar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dayLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 6, marginBottom: 4 },
  dayLabelSelected: { color: COLORS.text, fontWeight: '800' },
  detail: { marginTop: 12, backgroundColor: COLORS.cardRaised, borderRadius: 10, padding: 12 },
  detailDay: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  detailText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  hint: { color: '#555', fontSize: 11, marginTop: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222', gap: 12 },
  logTime: { color: COLORS.textMuted, fontSize: 12, width: 46 },
  logName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  logMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  logDone: { color: COLORS.accentSoft, fontSize: 12, fontWeight: '800' },
  logEarly: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
});
