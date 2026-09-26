import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import KipAvatar from '../components/KipAvatar';
import SafetySheet from '../components/SafetySheet';
import { useKip } from '../lib/kipContext';
import { BCT, SAGE_FEATURES } from '../lib/sage/bct';
import {
  averageUsage,
  CHECKOUT_DAY,
  currentStage,
  deleteAllSageData,
  INITIAL_STATE,
  loadDiary,
  loadReflection,
  loadSelfCheck,
  protocolDayKey,
  protocolNow,
  REFLECTION_QUESTIONS,
  relapseDetected,
  sageDay,
  saveCard,
  saveDiary,
  saveFeedback,
  saveReflection,
  saveSelfCheck,
  saveWeekly,
  weeklyReflectionDue,
  WEEKLY_QUESTIONS,
  type Card,
  type DiaryEntry,
  type SageState,
} from '../lib/sage/protocol';
import { logSafetyEvent, showsDistress } from '../lib/sage/safety';
import { encryptedAtRest } from '../lib/sage/secureStore';
import { itemsImproved, SELF_CHECK_ITEMS, SELF_CHECK_SCALE } from '../lib/sage/selfCheck';
import { formatMinutes, lastDays } from '../lib/sessions';
import { dayKey } from '../lib/storage';
import { COLORS } from '../lib/theme';
import type { UsageSummary } from '../lib/usage';
import type { DayUsage } from '../lib/usageHistory';

const SAGE = '#2F5D57';
const SAGE_SOFT = '#8fd3c4';

type Props = {
  state: SageState;
  card: Card | null;
  usage: UsageSummary | null;
  usageHistory: Record<string, DayUsage>;
  onStateChange: (state: SageState) => void;
  onCardChange: (card: Card | null) => void;
};

export default function SageScreen({ state, card, usage, usageHistory, onStateChange, onCardChange }: Props) {
  const { subscription } = useKip();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stage = currentStage(state);
  const day = sageDay(state);

  /** Distress check before any answer is used. Returns false (and shows help) on a hit. */
  function guard(...texts: string[]) {
    if (texts.some(t => showsDistress(t))) {
      logSafetyEvent();
      setSafetyOpen(true);
      return false;
    }
    return true;
  }

  const update = (patch: Partial<SageState>) => onStateChange({ ...state, ...patch });

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <KipAvatar size={52} sage />
          <View style={styles.flex}>
            <Text style={styles.title}>Sage</Text>
            <Text style={styles.subtitle}>Kip's kind side · digital wellbeing coach</Text>
          </View>
          {day >= 0 && stage !== 'maintenance' && (
            <Text style={styles.dayChip}>Day {Math.min(day, CHECKOUT_DAY)} of {CHECKOUT_DAY}</Text>
          )}
        </View>

        {stage === 'intro' && <Intro onStart={() => update({ ...INITIAL_STATE, startedAt: Date.now() })} />}
        {stage === 'baseline' && <Baseline usageHistory={usageHistory} onDone={patch => update(patch)} />}
        {stage === 'waitReflection' && (
          <Info title="Baseline saved" body="Tomorrow Kip asks you five questions about your social media use. Take 20 minutes somewhere quiet." />
        )}
        {stage === 'reflection' && (
          <Reflection usageHistory={usageHistory} state={state} guard={guard} onDone={() => update({ reflectionDone: true })} />
        )}
        {stage === 'card' && <CardBuilder guard={guard} onDone={c => { saveCard(c); onCardChange(c); update({ cardDone: true }); }} />}
        {stage === 'waitDiary' && (
          <>
            {card && <ReminderCard card={card} />}
            <Info title="Your card is ready" body="From tomorrow, Kip asks for a short evening diary before bed, for seven days. He'll remind you at 21:00." />
          </>
        )}
        {stage === 'diary' && (
          <Diary state={state} card={card} usage={usage} usageHistory={usageHistory} guard={guard} onSaved={d => update({ diaryDays: [...state.diaryDays, d] })} />
        )}
        {stage === 'checkout' && (
          <Checkout state={state} usageHistory={usageHistory} onDone={() => update({ checkoutDone: true, lastWeeklyReflection: protocolNow(state) })} />
        )}
        {stage === 'maintenance' && (
          <Maintenance
            state={state}
            card={card}
            usage={usage}
            usageHistory={usageHistory}
            guard={guard}
            onWeeklyDone={() => update({ lastWeeklyReflection: protocolNow(state) })}
            onRepeat={() => update({ reflectionDone: false })}
          />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>How Sage works</Text>
          <Text style={styles.muted}>
            A one-week programme based on a study with university students (Hou et al., 2019), followed by light-touch
            maintenance. The goal is using social media less, on your terms, not quitting.
          </Text>
          {SAGE_FEATURES.map(f => (
            <Text key={f.feature} style={styles.bct}>
              • {f.feature} <Text style={styles.bctCode}>({f.bct.map(k => `BCT ${BCT[k].code}`).join(', ')})</Text>
            </Text>
          ))}
          <Text style={[styles.muted, styles.gap]}>
            Sage is a coach for everyday habits, not a medical or psychological service.{' '}
            {encryptedAtRest()
              ? 'Your answers and diary are stored encrypted on this device only.'
              : 'In the browser your answers are stored locally, not encrypted. Use the phone app for encrypted storage.'}
          </Text>
          {state.startedAt !== null && (
            <Pressable
              style={styles.deleteButton}
              onPress={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                await deleteAllSageData();
                onCardChange(null);
                onStateChange(INITIAL_STATE);
                setConfirmDelete(false);
              }}
            >
              <Text style={styles.deleteText}>{confirmDelete ? 'Tap again to delete everything' : 'Delete all Sage data'}</Text>
            </Pressable>
          )}
          {subscription.testMode && state.startedAt !== null && (
            <Pressable style={styles.testButton} onPress={() => update({ dayOffset: state.dayOffset + 1 })}>
              <Text style={styles.testText}>Test mode: skip to next day (now day {day})</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <SafetySheet visible={safetyOpen} onClose={() => setSafetyOpen(false)} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Rebalance your social media, one week at a time</Text>
      {[
        ['Day 0', 'Look at your real usage and set your own goal (less, not zero).'],
        ['Day 1', 'Five reflection questions, then you write your reminder card.'],
        ['Days 2–8', 'A two-minute evening diary before bed.'],
        ['Day 9', 'See your progress, then Sage steps back to light check-ins.'],
      ].map(([when, what]) => (
        <View key={when} style={styles.step}>
          <Text style={styles.stepWhen}>{when}</Text>
          <Text style={styles.stepWhat}>{what}</Text>
        </View>
      ))}
      <Text style={styles.muted}>Works best with app-usage tracking on (Settings → Kip's reach).</Text>
      <PrimaryButton label="Start my week" onPress={onStart} />
    </View>
  );
}

function Baseline({ usageHistory, onDone }: { usageHistory: Record<string, DayUsage>; onDone: (patch: Partial<SageState>) => void }) {
  const tracked = averageUsage(usageHistory, lastDays(7));
  const [step, setStep] = useState<'usage' | 'check' | 'goal'>('usage');
  const [selfReport, setSelfReport] = useState('');
  const [answers, setAnswers] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const baseline = tracked ?? (Number(selfReport) || null);

  if (step === 'usage') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your starting point</Text>
        {tracked !== null ? (
          <>
            <Text style={styles.big}>{formatMinutes(tracked)} <Text style={styles.bigUnit}>per day</Text></Text>
            <Text style={styles.muted}>Average of your tracked days. Real numbers beat guesses.</Text>
          </>
        ) : (
          <>
            <Text style={styles.muted}>No tracked usage yet. Roughly how many minutes a day do you spend on social media?</Text>
            <TextInput
              style={styles.input}
              value={selfReport}
              onChangeText={t => setSelfReport(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="e.g. 180"
              placeholderTextColor="#555"
            />
          </>
        )}
        <PrimaryButton label="Next" disabled={!baseline} onPress={() => setStep('check')} />
      </View>
    );
  }

  if (step === 'check') {
    return (
      <SelfCheck
        title="A quick self-check"
        answers={answers}
        onChange={setAnswers}
        onDone={() => {
          saveSelfCheck('pre', answers);
          setStep('goal');
        }}
      />
    );
  }

  const options = baseline ? [
    { label: '25% less', value: Math.round(baseline * 0.75) },
    { label: 'Half', value: Math.round(baseline * 0.5) },
    { label: 'One third', value: Math.round(baseline / 3) },
  ] : [];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your goal</Text>
      <Text style={styles.muted}>Reduce, don't quit. Cutting to zero tends to backfire. Pick a daily limit that feels doable.</Text>
      <View style={styles.chipRow}>
        {options.map(o => (
          <Chip key={o.label} label={`${o.label} · ${formatMinutes(o.value)}`} selected={target === o.value} onPress={() => setTarget(o.value)} />
        ))}
      </View>
      <PrimaryButton
        label="Save my goal"
        disabled={target === null}
        onPress={() => onDone({ baselineMinutes: baseline, baselineSource: tracked !== null ? 'tracked' : 'self-report', targetMinutes: target, selfCheckPreDone: true })}
      />
    </View>
  );
}

function SelfCheck({ title, answers, onChange, onDone }: { title: string; answers: number[]; onChange: (a: number[]) => void; onDone: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>In the last weeks, how often have you…</Text>
      {SELF_CHECK_ITEMS.map((item, i) => (
        <View key={item} style={styles.checkItem}>
          <Text style={styles.checkText}>{item}</Text>
          <View style={styles.chipRow}>
            {SELF_CHECK_SCALE.map((label, v) => (
              <Chip
                key={label}
                label={label}
                selected={answers[i] === v + 1}
                onPress={() => {
                  const next = [...answers];
                  next[i] = v + 1;
                  onChange(next);
                }}
              />
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.fine}>Only used to tailor Sage and to see change over the week. It's not a test and not a diagnosis.</Text>
      <PrimaryButton label="Continue" disabled={SELF_CHECK_ITEMS.some((_, i) => !answers[i])} onPress={onDone} />
    </View>
  );
}

function Reflection({ state, usageHistory, guard, onDone }: { state: SageState; usageHistory: Record<string, DayUsage>; guard: (...t: string[]) => boolean; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const recent = averageUsage(usageHistory, lastDays(7)) ?? state.baselineMinutes ?? 0;

  useEffect(() => {
    loadReflection().then(saved => saved && setAnswers(saved));
  }, []);

  useEffect(() => setDraft(answers[index] ?? ''), [index]);

  async function next() {
    if (!guard(draft)) return;
    const updated = [...answers];
    updated[index] = draft.trim();
    setAnswers(updated);
    await saveReflection(updated);
    if (index === REFLECTION_QUESTIONS.length - 1) onDone();
    else setIndex(index + 1);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.progress}>Question {index + 1} of {REFLECTION_QUESTIONS.length}</Text>
      {index === 0 && (
        <View style={styles.numbers}>
          <Text style={styles.big}>{formatMinutes(recent)} <Text style={styles.bigUnit}>a day</Text></Text>
          <Text style={styles.muted}>≈ {formatMinutes(recent * 7)} a week{state.baselineSource === 'self-report' ? ' (your estimate)' : ' (tracked)'}</Text>
        </View>
      )}
      <Text style={styles.question}>{REFLECTION_QUESTIONS[index]}</Text>
      <TextInput style={[styles.input, styles.multiline]} value={draft} onChangeText={setDraft} multiline placeholder="In your own words…" placeholderTextColor="#555" />
      <View style={styles.row}>
        {index > 0 && (
          <Pressable onPress={() => setIndex(index - 1)} style={styles.backButton}>
            <Text style={styles.link}>Back</Text>
          </Pressable>
        )}
        <View style={styles.flex}>
          <PrimaryButton label={index === REFLECTION_QUESTIONS.length - 1 ? 'Finish' : 'Next'} disabled={!draft.trim()} onPress={next} />
        </View>
      </View>
    </View>
  );
}

function splitIdeas(text: string | undefined) {
  return (text ?? '').split(/[\n;.,]+/).map(s => s.trim()).filter(s => s.length > 2).slice(0, 5);
}

function CardBuilder({ guard, onDone }: { guard: (...t: string[]) => boolean; onDone: (card: Card) => void }) {
  const [pros, setPros] = useState(['', '', '', '', '']);
  const [cons, setCons] = useState(['', '', '', '', '']);

  // Start from the user's own reflection answers (gains, and negative effects) as suggestions to edit.
  useEffect(() => {
    loadReflection().then(answers => {
      if (!answers) return;
      const fill = (ideas: string[]) => [0, 1, 2, 3, 4].map(i => ideas[i] ?? '');
      setPros(fill([...splitIdeas(answers[2]), ...splitIdeas(answers[1])]));
      setCons(fill(splitIdeas(answers[4])));
    });
  }, []);

  const complete = [...pros, ...cons].every(s => s.trim());
  const edit = (list: string[], set: (l: string[]) => void, i: number, text: string) => {
    const next = [...list];
    next[i] = text;
    set(next);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your reminder card</Text>
      <Text style={styles.muted}>Five reasons to use social media less, and five downsides of too much, in your own words. Kip pre-filled some from your answers; change anything.</Text>
      <Text style={styles.label}>If I use it less, I gain…</Text>
      {pros.map((p, i) => (
        <TextInput key={`p${i}`} style={styles.input} value={p} onChangeText={t => edit(pros, setPros, i, t)} placeholder={`Advantage ${i + 1}`} placeholderTextColor="#555" maxLength={80} />
      ))}
      <Text style={styles.label}>When I overdo it…</Text>
      {cons.map((c, i) => (
        <TextInput key={`c${i}`} style={styles.input} value={c} onChangeText={t => edit(cons, setCons, i, t)} placeholder={`Downside ${i + 1}`} placeholderTextColor="#555" maxLength={80} />
      ))}
      <PrimaryButton
        label="Save my card"
        disabled={!complete}
        onPress={() => {
          if (!guard(...pros, ...cons)) return;
          onDone({ pros: pros.map(s => s.trim()), cons: cons.map(s => s.trim()) });
        }}
      />
    </View>
  );
}

export function ReminderCard({ card }: { card: Card }) {
  return (
    <View style={styles.reminder}>
      <Text style={styles.reminderTitle}>My reminder card</Text>
      <Text style={styles.reminderHead}>Using less gives me</Text>
      {card.pros.map(p => <Text key={p} style={styles.reminderLine}>＋ {p}</Text>)}
      <Text style={[styles.reminderHead, styles.gap]}>Too much costs me</Text>
      {card.cons.map(c => <Text key={c} style={styles.reminderLine}>－ {c}</Text>)}
    </View>
  );
}

function Diary({ state, card, usage, usageHistory, guard, onSaved }: {
  state: SageState; card: Card | null; usage: UsageSummary | null; usageHistory: Record<string, DayUsage>;
  guard: (...t: string[]) => boolean; onSaved: (day: string) => void;
}) {
  const today = protocolDayKey(state);
  const done = state.diaryDays.includes(today);
  const [yesterday, setYesterday] = useState<DiaryEntry | null>(null);
  const [howUsed, setHowUsed] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [mood, setMood] = useState(50);
  const [focus, setFocus] = useState(50);
  const [strategy, setStrategy] = useState('');
  const [expected, setExpected] = useState(String(state.targetMinutes ?? ''));

  useEffect(() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - 1);
    loadDiary(dayKey(d)).then(setYesterday);
  }, [today]);

  const yesterdayActual = yesterday ? usageHistory[yesterday.day]?.totalMinutes ?? yesterday.actualMinutes : null;

  if (done) {
    return (
      <>
        <Info title="Diary done for today" body="Thank you. Same time tomorrow evening. Sleep well." />
        {card && <ReminderCard card={card} />}
      </>
    );
  }

  const apps = Object.entries(usage?.perApp ?? {}).filter(([, m]) => m > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Evening diary</Text>
      {yesterday && yesterdayActual !== null && (
        <View style={styles.compare}>
          <Text style={styles.compareText}>
            Yesterday you expected {formatMinutes(yesterday.expectedMinutes)} and it was {formatMinutes(yesterdayActual)}.{' '}
            {yesterdayActual <= yesterday.expectedMinutes ? 'You stayed within your plan.' : 'Just noticing, no judgment. What got in the way?'}
          </Text>
        </View>
      )}
      <Text style={styles.label}>Today so far</Text>
      {usage ? (
        apps.length > 0 ? (
          apps.map(([app, m]) => <Text key={app} style={styles.prefill}>{app}: {formatMinutes(m)}</Text>)
        ) : (
          <Text style={styles.prefill}>{formatMinutes(usage.totalMinutes)} in your flagged apps</Text>
        )
      ) : (
        <Text style={styles.muted}>No tracked data today. Your own estimate below is fine.</Text>
      )}
      <Text style={styles.label}>How did you use them?</Text>
      <TextInput style={[styles.input, styles.multiline]} value={howUsed} onChangeText={setHowUsed} multiline placeholder="Scrolling in bed, chatting with friends…" placeholderTextColor="#555" />
      <Text style={styles.label}>Thoughts and feelings around it</Text>
      <TextInput style={[styles.input, styles.multiline]} value={thoughts} onChangeText={setThoughts} multiline placeholder="What was going on?" placeholderTextColor="#555" />
      <Text style={styles.label}>How did you feel today? {mood}/100</Text>
      <Scale value={mood} onChange={setMood} />
      <Text style={styles.label}>How focused were you on study or work? {focus}/100</Text>
      <Scale value={focus} onChange={setFocus} />
      <Text style={styles.label}>One strategy for tomorrow</Text>
      <TextInput style={styles.input} value={strategy} onChangeText={setStrategy} placeholder="e.g. phone stays in my bag until lunch" placeholderTextColor="#555" />
      <Text style={styles.label}>How many minutes do you expect to use tomorrow?</Text>
      <TextInput style={styles.input} value={expected} onChangeText={t => setExpected(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" />
      <PrimaryButton
        label="Save today's diary"
        disabled={!strategy.trim() || !expected}
        onPress={async () => {
          if (!guard(howUsed, thoughts, strategy)) return;
          await saveDiary({
            day: today,
            appsMinutes: usage?.perApp ?? null,
            howUsed: howUsed.trim(),
            thoughts: thoughts.trim(),
            mood,
            focus,
            strategy: strategy.trim(),
            expectedMinutes: Number(expected),
            actualMinutes: usage?.totalMinutes ?? null,
          });
          onSaved(today);
        }}
      />
    </View>
  );
}

function Checkout({ state, usageHistory, onDone }: { state: SageState; usageHistory: Record<string, DayUsage>; onDone: () => void }) {
  const [step, setStep] = useState<'check' | 'progress' | 'feedback'>('check');
  const [answers, setAnswers] = useState<number[]>([]);
  const [improved, setImproved] = useState<number | null>(null);
  const [helpful, setHelpful] = useState('');
  const [parts, setParts] = useState<string[]>([]);
  const now = averageUsage(usageHistory, lastDays(7));

  if (step === 'check') {
    return (
      <SelfCheck
        title="Your week, one more time"
        answers={answers}
        onChange={setAnswers}
        onDone={async () => {
          await saveSelfCheck('post', answers);
          const before = await loadSelfCheck('pre');
          setImproved(before ? itemsImproved(before, answers) : null);
          setStep('progress');
        }}
      />
    );
  }

  if (step === 'progress') {
    const base = state.baselineMinutes ?? 0;
    const change = now !== null && base > 0 ? Math.round(((base - now) / base) * 100) : null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your progress</Text>
        <View style={styles.progressRow}>
          <Stat label="Before" value={formatMinutes(base)} />
          <Stat label="This week" value={now === null ? '–' : formatMinutes(now)} />
          <Stat label="Your goal" value={formatMinutes(state.targetMinutes ?? 0)} />
        </View>
        {change !== null && (
          <Text style={styles.big}>{change > 0 ? `${change}% less` : 'About the same'} <Text style={styles.bigUnit}>per day</Text></Text>
        )}
        {improved !== null && (
          <Text style={styles.muted}>In your self-check, {improved} of {SELF_CHECK_ITEMS.length} answers moved in a direction you'd probably like.</Text>
        )}
        <PrimaryButton label="Continue" onPress={() => setStep('feedback')} />
      </View>
    );
  }

  const PARTS = ['Reflection questions', 'Reminder card', 'Evening diary', 'Nudges'];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Was this helpful?</Text>
      <View style={styles.chipRow}>
        {['Yes', 'Partly', 'Not really'].map(h => <Chip key={h} label={h} selected={helpful === h} onPress={() => setHelpful(h)} />)}
      </View>
      <Text style={styles.label}>Which parts helped most?</Text>
      <View style={styles.chipRow}>
        {PARTS.map(p => (
          <Chip key={p} label={p} selected={parts.includes(p)} onPress={() => setParts(parts.includes(p) ? parts.filter(x => x !== p) : [...parts, p])} />
        ))}
      </View>
      <PrimaryButton
        label="Finish the week"
        disabled={!helpful}
        onPress={async () => {
          await saveFeedback({ helpful, parts });
          onDone();
        }}
      />
    </View>
  );
}

function Maintenance({ state, card, usage, usageHistory, guard, onWeeklyDone, onRepeat }: {
  state: SageState; card: Card | null; usage: UsageSummary | null; usageHistory: Record<string, DayUsage>;
  guard: (...t: string[]) => boolean; onWeeklyDone: () => void; onRepeat: () => void;
}) {
  const [weekly, setWeekly] = useState(['', '', '']);
  const target = state.targetMinutes ?? 0;
  const todayMinutes = usage?.totalMinutes ?? null;
  const relapse = relapseDetected(state, usageHistory, lastDays(14));

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today vs your limit</Text>
        {todayMinutes === null ? (
          <Text style={styles.muted}>Turn on usage tracking to see this.</Text>
        ) : (
          <>
            <Text style={styles.big}>{formatMinutes(todayMinutes)} <Text style={styles.bigUnit}>of {formatMinutes(target)}</Text></Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, (todayMinutes / Math.max(1, target)) * 100)}%`, backgroundColor: todayMinutes > target ? '#C98A5A' : SAGE_SOFT }]} />
            </View>
          </>
        )}
      </View>

      {relapse && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Things drifted back a bit</Text>
          <Text style={styles.muted}>For about two weeks your use has been close to where you started. That happens. Want to go through the reflection questions again?</Text>
          <PrimaryButton label="Repeat the reflection" onPress={onRepeat} />
        </View>
      )}

      {weeklyReflectionDue(state) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly check-in</Text>
          {WEEKLY_QUESTIONS.map((q, i) => (
            <View key={q}>
              <Text style={styles.label}>{q}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={weekly[i]}
                multiline
                onChangeText={t => setWeekly(weekly.map((w, j) => (j === i ? t : w)))}
                placeholderTextColor="#555"
              />
            </View>
          ))}
          <PrimaryButton
            label="Save check-in"
            disabled={weekly.some(w => !w.trim())}
            onPress={async () => {
              if (!guard(...weekly)) return;
              await saveWeekly(weekly.map(w => w.trim()));
              setWeekly(['', '', '']);
              onWeeklyDone();
            }}
          />
        </View>
      )}

      {card && <ReminderCard card={card} />}
    </>
  );
}

// ---------------------------------------------------------------------------

function Info({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Scale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.scale}>
      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
        <Pressable key={v} style={[styles.scaleStep, v <= value && styles.scaleOn]} onPress={() => onChange(v)} accessibilityLabel={`${v} of 100`} />
      ))}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.primary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 28, paddingBottom: 60 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  gap: { marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: SAGE_SOFT, fontSize: 13, fontWeight: '700' },
  dayChip: { color: SAGE_SOFT, fontSize: 12, fontWeight: '800', borderWidth: 1, borderColor: SAGE, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  card: { backgroundColor: '#142220', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#1f3632' },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  muted: { color: '#9bb3ae', fontSize: 13, lineHeight: 19 },
  fine: { color: '#6f8581', fontSize: 11, lineHeight: 16, marginTop: 6 },
  label: { color: '#cfe2de', fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  big: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginVertical: 6 },
  bigUnit: { color: '#9bb3ae', fontSize: 14, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  stepWhen: { width: 64, color: SAGE_SOFT, fontSize: 12, fontWeight: '800' },
  stepWhat: { flex: 1, color: '#cfe2de', fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: '#0f1a18', borderWidth: 1, borderColor: '#274440', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text, marginBottom: 8 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#274440', backgroundColor: '#0f1a18' },
  chipSelected: { backgroundColor: SAGE, borderColor: SAGE_SOFT },
  chipText: { color: '#9bb3ae', fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: COLORS.text, fontWeight: '800' },
  checkItem: { marginTop: 14 },
  checkText: { color: '#cfe2de', fontSize: 14, lineHeight: 20 },
  progress: { color: SAGE_SOFT, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  numbers: { backgroundColor: '#0f1a18', borderRadius: 12, padding: 12, marginBottom: 12 },
  question: { color: COLORS.text, fontSize: 17, fontWeight: '700', lineHeight: 24, marginBottom: 12 },
  backButton: { paddingVertical: 14 },
  link: { color: SAGE_SOFT, fontWeight: '800', fontSize: 14 },
  reminder: { backgroundColor: '#1d3b36', borderRadius: 18, padding: 20, marginBottom: 14 },
  reminderTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  reminderHead: { color: SAGE_SOFT, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  reminderLine: { color: '#e6f2ef', fontSize: 14, lineHeight: 22 },
  compare: { backgroundColor: '#0f1a18', borderRadius: 12, padding: 12 },
  compareText: { color: '#cfe2de', fontSize: 13, lineHeight: 19 },
  prefill: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  scale: { flexDirection: 'row', gap: 4 },
  scaleStep: { flex: 1, height: 22, borderRadius: 5, backgroundColor: '#0f1a18', borderWidth: 1, borderColor: '#274440' },
  scaleOn: { backgroundColor: SAGE_SOFT, borderColor: SAGE_SOFT },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  stat: { flex: 1, backgroundColor: '#0f1a18', borderRadius: 12, padding: 10 },
  statLabel: { color: '#9bb3ae', fontSize: 11, fontWeight: '800' },
  statValue: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  track: { height: 12, backgroundColor: '#0f1a18', borderRadius: 6, overflow: 'hidden', marginTop: 8 },
  fill: { height: 12, borderRadius: 6 },
  primary: { backgroundColor: SAGE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  footer: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingTop: 18 },
  footerTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  bct: { color: '#9bb3ae', fontSize: 12, lineHeight: 19 },
  bctCode: { color: '#6f8581' },
  deleteButton: { marginTop: 18, alignSelf: 'flex-start' },
  deleteText: { color: '#e57a73', fontWeight: '800', fontSize: 13 },
  testButton: { marginTop: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#555', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  testText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
});
