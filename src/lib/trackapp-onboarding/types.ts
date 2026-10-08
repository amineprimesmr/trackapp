import type { ONBOARDING_VERSION } from "@/lib/trackapp-onboarding/keys";

export type OnboardingProjectMode = "defined" | "discover";

export type OnboardingLikertValue = 1 | 2 | 3 | 4 | 5;

export type TrackappOnboardingAnswers = Readonly<{
  project_status?: "has_project" | "no_project";
  identity?: string;
  experience?: string;
  primary_goal?: string;
  frustration?: string;
  likert_advantage?: OnboardingLikertValue;
  likert_focus?: OnboardingLikertValue;
  apps_per_month?: string;
  revenue_goal?: string;
  monetization_model?: string;
  capabilities?: string[];
  studio?: string;
  first_output?: string;
  capacity?: string;
  referral?: string;
  project_name?: string;
  project_stage?: string;
  discovery_focus?: string;
}>;

export type TrackappUserOnboardingPayload = Readonly<{
  version: typeof ONBOARDING_VERSION;
  currentStepIndex: number;
  answers: TrackappOnboardingAnswers;
  projectMode?: OnboardingProjectMode;
  project?: Readonly<{ name: string; goal?: string; stage?: string }>;
}>;

export type OnboardingStepKind =
  | "interstitial"
  | "single"
  | "multi"
  | "likert"
  | "chips"
  | "project"
  | "summary";

export type OnboardingOption = Readonly<{
  id: string;
  label: string;
  description?: string;
  icon?: string;
}>;

export type OnboardingStep = Readonly<{
  id: string;
  kind: OnboardingStepKind;
  section: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  image?: string;
  gradient?: string;
  options?: readonly OnboardingOption[];
  statement?: string;
  likertGradient?: string;
  branch?: OnboardingProjectMode;
}>;

export type OnboardingProfileState = Readonly<{
  completed: boolean;
  completedAt: string | null;
  payload: TrackappUserOnboardingPayload | null;
}>;

export type CreatorLevel = "beginner" | "mid" | "upper" | "top";

/** Props bootstrap overlay / page onboarding (sans import serveur). */
export type TrackappOnboardingPageProps = Readonly<{
  initialPayload: TrackappUserOnboardingPayload | null;
  initialCompleted: boolean;
  loggedIn: boolean;
  alreadyPremium: boolean;
}>;

export const GUEST_ONBOARDING_PAGE_PROPS: TrackappOnboardingPageProps = {
  initialPayload: null,
  initialCompleted: false,
  loggedIn: false,
  alreadyPremium: false,
};
