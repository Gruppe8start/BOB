import { StyleSheet, Text, View } from 'react-native';
import { focusByDayPart, records, sessionLengthTrend, studyHistory, weekOverWeek } from '../lib/analytics';
import { useKip } from '../lib/kipContext';
import { formatMinutes, type SessionLog } from '../lib/sessions';
import { COLORS } from '../lib/theme';
import type { DayUsage } from '../lib/usageHistory';
import ProLock from './ProLock';

type Props = {
  logs: SessionLog[];
  usageHistory: Record<string, DayUsage>;
};

// Sequential single-hue ramp for the study-history grid (dark surface: brighter = more).
const HEAT = ['#222222', '#1f4a28', '#2e7a3b', '#43A047', '#7fd08a'];
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function heat(minutes: number) {
  if (minutes <= 0) return HEAT[0];
  if (minutes < 25) return HEAT[1];
  if (minutes < 60) return HEAT[2];
  if (minutes < 120) return HEAT[3];
  return HEAT[4];
}

function delta(now: number | null, before: number | null, lowerIsBetter = false) {
  if (now === null || before === null) return { text: '–', good: null as boolean | null };
  const diff = now - before;
  if (diff === 0) return { text: 'same', good: null };
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return { text: `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}`, good: better };
}

/** Premium: this week vs your own last week. Pro: detailed behaviour analytics. */
export default function InsightsPanel({ logs, usageHistory }: Props) {
  const { ent } = useKip();

  const { thisWeek, lastWeek } = weekOverWeek(logs, usageHistory);
  const rows = [
    { label: 'Focused (min)', now: thisWeek.focus, before: lastWeek.focus, lower: false },
    { label: 'Sessions', now: thisWeek.sessions, before: lastWeek.sessions, lower: false },
    { label: 'Study days', now: thisWeek.studyDays, before: lastWeek.studyDays, lower: false },
    { label: 'Distracted (min)', now: thisWeek.distracted, before: lastWeek.distracted, lower: true },
  ];

  return (
    <>
      {ent.premium ? (
        <View style={styles.section}>
          <Text style={styles.title}>You vs. last week</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.flex]} />
            <Text style={styles.th}>Last week</Text>
            <Text style={styles.th}>This week</Text>
            <Text style={styles.th}>Change</Text>
          </View>
          {rows.map(r => {
            const d = delta(r.now, r.before, r.lower);
            return (
              <View key={r.label} style={styles.tr}>
                <Text style={[styles.td, styles.flex, styles.rowLabel]}>{r.label}</Text>
                <Text style={styles.td}>{r.before ?? '–'}</Text>
                <Text style={[styles.td, styles.strong]}>{r.now ?? '–'}</Text>
                <Text style={[styles.td, d.good === true && styles.good, d.good === false && styles.bad]}>{d.text}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <ProLock tier="Premium" feature="Compare with your past weeks" detail="See this week against last week: focus, sessions, study days and distraction." />
      )}

      {ent.pro ? <ProAnalytics logs={logs} /> : (
        <ProLock feature="Detailed analytics" detail="When you focus best, your study history, and how your session lengths change over time." />
      )}
    </>
  );
}

function ProAnalytics({ logs }: { logs: SessionLog[] }) {
  const parts = focusByDayPart(logs);
  const partMax = Math.max(1, ...parts.map(p => p.minutes));
  const bestPart = parts.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const history = studyHistory(logs, 5);
  const trend = sessionLengthTrend(logs);
  const trendMax = Math.max(1, ...trend.map(t => t.avgLength));
  const { longestStreak, bestDay } = records(logs);

  // Pad the history so columns line up with Monday-first weekdays.
  const firstWeekday = (new Date(`${history[0].day}T00:00:00`).getDay() + 6) % 7;
  const cells: ({ day: string; minutes: number } | null)[] = [...Array(firstWeekday).fill(null), ...history];
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.title}>When you focus best</Text>
        <Text style={styles.sub}>Last 4 weeks{bestPart.minutes > 0 ? ` · strongest: ${bestPart.label.toLowerCase()}` : ''}</Text>
        {parts.map(p => (
          <View key={p.label} style={styles.barRow} accessibilityLabel={`${p.label}: ${p.minutes} minutes`}>
            <Text style={styles.barLabel}>{p.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${Math.max(p.minutes > 0 ? 2 : 0, (p.minutes / partMax) * 100)}%` }]} />
            </View>
            <Text style={styles.barValue}>{formatMinutes(p.minutes)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Study history</Text>
        <Text style={styles.sub}>Last 5 weeks · longest run {longestStreak} {longestStreak === 1 ? 'day' : 'days'}{bestDay.minutes > 0 ? ` · best day ${formatMinutes(bestDay.minutes)}` : ''}</Text>
        <View style={styles.gridHead}>
          {WEEKDAY_INITIALS.map((d, i) => <Text key={i} style={styles.gridHeadText}>{d}</Text>)}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.gridRow}>
            {Array.from({ length: 7 }, (_, i) => week[i] ?? null).map((cell, i) => (
              <View
                key={i}
                style={[styles.cell, { backgroundColor: cell ? heat(cell.minutes) : 'transparent' }]}
                accessibilityLabel={cell ? `${cell.day}: ${cell.minutes} minutes` : undefined}
              />
            ))}
          </View>
        ))}
        <View style={styles.heatLegend}>
          <Text style={styles.sub}>Less</Text>
          {HEAT.map(c => <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />)}
          <Text style={styles.sub}>More</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Session length trend</Text>
        <Text style={styles.sub}>Average focused minutes per session, and how many you finished</Text>
        <View style={styles.trend}>
          {trend.map(t => (
            <View key={t.label} style={styles.trendCol} accessibilityLabel={`${t.label}: average ${t.avgLength} minutes, ${t.completionRate}% finished`}>
              <Text style={styles.trendValue}>{t.sessions ? `${t.avgLength}m` : '–'}</Text>
              <View style={[styles.trendBar, { height: Math.max(t.avgLength > 0 ? 3 : 0, (t.avgLength / trendMax) * 90) }]} />
              <Text style={styles.trendLabel}>{t.label}</Text>
              <Text style={styles.trendRate}>{t.sessions ? `${t.completionRate}% done` : ''}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.soon}>AI summary of your patterns: coming soon.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  sub: { color: COLORS.textMuted, fontSize: 11, marginBottom: 10 },
  tableHead: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  th: { width: 70, textAlign: 'right', color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  tr: { flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#222' },
  td: { width: 70, textAlign: 'right', color: COLORS.textSecondary, fontSize: 13 },
  rowLabel: { textAlign: 'left', color: COLORS.textSecondary },
  strong: { color: COLORS.text, fontWeight: '800' },
  good: { color: COLORS.accentSoft, fontWeight: '800' },
  bad: { color: '#d9a067', fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  barLabel: { width: 76, color: COLORS.textSecondary, fontSize: 12 },
  barTrack: { flex: 1, height: 12, marginHorizontal: 8 },
  bar: { height: 12, backgroundColor: COLORS.focus, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barValue: { width: 64, textAlign: 'right', color: COLORS.text, fontSize: 12, fontWeight: '700' },
  gridHead: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  gridHeadText: { flex: 1, textAlign: 'center', color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  gridRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4, maxHeight: 34 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
  trend: { flexDirection: 'row', alignItems: 'flex-end', height: 150, marginTop: 6 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendValue: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  trendBar: { width: 22, backgroundColor: COLORS.focus, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  trendLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
  trendRate: { color: COLORS.textMuted, fontSize: 10, marginTop: 2, height: 14 },
  soon: { color: '#555', fontSize: 11, marginBottom: 14 },
});
