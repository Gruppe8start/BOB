// Six-item self-check based on the Bergen Social Media Addiction Scale (BSMAS).
// Used internally for personalisation and before/after comparison only. It is never shown
// to the user as a score, a diagnosis or a label.
export const SELF_CHECK_ITEMS = [
  'Spent a lot of time thinking about social media or planning to use it',
  'Felt an urge to use social media more and more',
  'Used social media to forget about personal problems',
  'Tried to cut down on social media without success',
  'Felt restless or troubled when you couldn’t use social media',
  'Used social media so much that it got in the way of your studies or work',
];

export const SELF_CHECK_SCALE = ['Very rarely', 'Rarely', 'Sometimes', 'Often', 'Very often'];

export function selfCheckTotal(answers: number[]) {
  return answers.reduce((sum, a) => sum + a, 0);
}

/** How many items moved in a good direction between two check-ins. Neutral wording only. */
export function itemsImproved(before: number[], after: number[]) {
  return before.filter((b, i) => after[i] !== undefined && after[i] < b).length;
}
