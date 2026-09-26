import { KEYS, readJson, writeJson } from './storage';

export type PlanId = 'free' | 'monthly' | 'annual' | 'referral' | 'pro';

export type PlanInfo = {
  id: PlanId;
  name: string;
  price: string;
  note: string;
};

export const PLANS: PlanInfo[] = [
  { id: 'free', name: 'Free', price: '0', note: 'Kip, sessions, timer, streak, basic stats' },
  { id: 'monthly', name: 'Monthly', price: '2.49 CHF / month', note: 'Full Premium (incl. dressing up Kip), billed monthly' },
  { id: 'annual', name: 'Annual — Basic', price: '20 CHF / year', note: 'Full Premium (incl. dressing up Kip)' },
  { id: 'referral', name: 'Annual — Referral', price: '15 CHF / year', note: 'Same as Basic, with an invite code' },
  { id: 'pro', name: 'Annual — Pro', price: '40 CHF / year', note: "Premium + Kip's personality, exams, calendar, alarms, insights" },
];

export const SAGE_ADDON = { name: 'Sage add-on', price: '20 CHF / year', note: "Kip's kind side as a digital wellbeing coach, stackable on any paid plan" };

export type Subscription = {
  plan: PlanId;
  sage: boolean;
  /**
   * True when unlocked with the in-app test switch. Real purchases need App Store /
   * Play Billing (e.g. via RevenueCat) and are not wired up yet.
   */
  testMode: boolean;
};

export const FREE: Subscription = { plan: 'free', sage: false, testMode: false };

export type Entitlements = {
  /** Any paid plan: Kip's wardrobe (colours, outfits), own-past comparison, referral, social layer. */
  premium: boolean;
  /** Pro: Kip's custom personality, exams, calendar, advanced accountability, detailed analytics. */
  pro: boolean;
  /** Sage add-on, only valid on top of a paid plan. */
  sage: boolean;
};

export function entitlements(sub: Subscription): Entitlements {
  const premium = sub.plan !== 'free';
  return { premium, pro: sub.plan === 'pro', sage: premium && sub.sage };
}

export function loadSubscription() {
  return readJson<Subscription>(KEYS.subscription, FREE);
}

export function saveSubscription(sub: Subscription) {
  return writeJson(KEYS.subscription, sub);
}
