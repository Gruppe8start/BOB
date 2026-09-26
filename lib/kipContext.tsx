import { createContext, useContext } from 'react';
import type { Exam } from './exams';
import { DEFAULT_LOOK, type KipLook } from './kipLook';
import type { Personality } from './personality';
import type { Entitlements, Subscription } from './plan';

export type KipContextValue = {
  subscription: Subscription;
  ent: Entitlements;
  setSubscription: (sub: Subscription) => void;
  personality: Personality;
  setPersonality: (personality: Personality) => void;
  /** The saved look, even when the plan doesn't show it (so it comes back after upgrading). */
  kipLook: KipLook;
  setKipLook: (look: KipLook) => void;
  exams: Exam[];
  setExams: (exams: Exam[]) => void;
  openPlans: () => void;
};

export const KipContext = createContext<KipContextValue | null>(null);

export function useKip() {
  const value = useContext(KipContext);
  if (!value) throw new Error('useKip must be used inside KipContext');
  return value;
}

/** The look Kip should be drawn with: the custom one on Premium, otherwise the default. */
export function useVisibleLook(): KipLook {
  const value = useContext(KipContext);
  return value && value.ent.premium ? value.kipLook : DEFAULT_LOOK;
}
