/** Profil structuré du concept utilisateur — base pour Q&A, assessment et concurrents. */

export type ApplabConceptUnderstanding = Readonly<{
  core_problem: string;
  target_user: string;
  main_use_case: string;
  niche: string;
  specific_subject: string;
  language_or_market: string;
  monetization: string;
  key_features: readonly string[];
  not_competitors: readonly string[];
  search_queries: readonly string[];
  must_match: readonly string[];
}>;

export type ApplabClarifyingQuestion = Readonly<{
  id: string;
  question: string;
  hint?: string;
}>;

export type ApplabClientPersona = Readonly<{
  name: string;
  label: string;
  age_range: string;
  profile: string;
  goals: string;
  frustrations: string;
  why_this_app: string;
}>;

export type ApplabConceptAssessment = Readonly<{
  headline: string;
  summary: string;
  how_it_works: string;
  target_user: string;
  monetization: string;
  differentiation: string;
  mvp_features: readonly string[];
  risks: readonly string[];
  build_prompt_seed: string;
  market_insight: string;
  value_proposition: string;
  positioning: string;
  client_personas: readonly ApplabClientPersona[];
}>;

export type ApplabConceptClarifyStatus = "needs_clarification" | "ready_to_assess";

export type ApplabReferenceMatch = Readonly<{
  id: string;
  name: string;
  artistName: string;
  category: string;
  artworkUrl: string;
  revenueDisplay: string;
  relevanceScore: number;
  relevanceReason: string;
  rank: number;
}>;

export type ApplabConceptAnswers = Readonly<Record<string, string>>;
