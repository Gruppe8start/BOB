// Every Sage feature is tagged with the behaviour change technique it implements
// (Michie et al., BCT Taxonomy v1), as the spec requires.
export const BCT = {
  goalSetting: { code: '1.1', name: 'Goal setting (behaviour)' },
  problemSolving: { code: '1.2', name: 'Problem solving' },
  actionPlanning: { code: '1.4', name: 'Action planning' },
  reviewGoals: { code: '1.5', name: 'Review behaviour goal(s)' },
  discrepancy: { code: '1.6', name: 'Discrepancy between current behaviour and goal' },
  feedback: { code: '2.2', name: 'Feedback on behaviour' },
  selfMonitoring: { code: '2.3', name: 'Self-monitoring of behaviour' },
  emotionalConsequences: { code: '5.4', name: 'Monitoring of emotional consequences' },
  prompts: { code: '7.1', name: 'Prompts/cues' },
  prosAndCons: { code: '9.2', name: 'Pros and cons' },
  comparativeImagining: { code: '9.3', name: 'Comparative imagining of future outcomes' },
} as const;

export type BctKey = keyof typeof BCT;

export const SAGE_FEATURES: { feature: string; bct: BctKey[] }[] = [
  { feature: 'Tracked baseline and daily usage', bct: ['selfMonitoring', 'feedback'] },
  { feature: 'Your own reduction goal', bct: ['goalSetting'] },
  { feature: 'Reflection questions', bct: ['problemSolving', 'comparativeImagining'] },
  { feature: 'Reminder card (your pros and cons)', bct: ['prosAndCons'] },
  { feature: 'Evening diary', bct: ['selfMonitoring', 'emotionalConsequences', 'actionPlanning'] },
  { feature: 'Expected vs. actual use', bct: ['discrepancy', 'reviewGoals'] },
  { feature: 'Time-limit nudges with your card lines', bct: ['prompts', 'discrepancy'] },
  { feature: 'Check-out and weekly mini-reflection', bct: ['feedback', 'reviewGoals'] },
];
