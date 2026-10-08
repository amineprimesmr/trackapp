import type { ApplabClarifyingQuestion, ApplabConceptUnderstanding } from "@/lib/trackapp-applab-project/types";
import { buildCompetitorSearchHints } from "@/lib/trackapp-applab-project/competitor-sector";

import { normalizeFounderAnswerText } from "@/lib/trackapp-applab-create/normalize-founder-text";
import type { ApplabCreateStepId } from "@/lib/trackapp-applab-create/types";
import {
  ensurePricingAnswer,
  isValidPricingAnswer,
  monetizationFromPricing,
} from "@/lib/trackapp-applab-create/pricing-plans";

export type ApplabAnswerStepId = "audience" | "pricing";

export type CreateQuestionAnswers = Readonly<Record<string, string>>;

export type CreateQuestionContext = Readonly<{
  name: string;
  concept: string;
  answers: CreateQuestionAnswers;
}>;

export type CreateQuestionField = Readonly<{
  id: ApplabAnswerStepId;
  step: ApplabAnswerStepId;
  question: string;
  help: string;
  placeholder: string;
  examples: readonly string[];
  minLength: number;
  maxLength: number;
  rows: number;
}>;

/** Étapes avec saisie utilisateur (4 questions). */
export const APPLAB_INPUT_STEPS: readonly ApplabCreateStepId[] = [
  "name",
  "concept",
  "audience",
  "pricing",
] as const;

export const APPLAB_ANSWER_STEP_ORDER: readonly ApplabAnswerStepId[] = [
  "audience",
  "pricing",
] as const;

const FIELD_CONFIG: Record<
  ApplabAnswerStepId,
  Readonly<{
    help: string;
    placeholder: string;
    examples: readonly string[];
    minLength: number;
    maxLength: number;
    rows: number;
  }>
> = {
  audience: {
    help: "Décrivez une vraie personne : profil, âge, situation, pays — pas « tout le monde ».",
    placeholder:
      "Ex. Femmes 25–40 ans, débutantes en musculation à la maison, peu de temps, veulent un plan simple sans salle…",
    examples: [
      "Étudiant 18–24 ans, révisions avec sessions de 10 min",
      "Parents actifs 30–45 ans, organisation familiale",
    ],
    minLength: 12,
    maxLength: 600,
    rows: 3,
  },
  pricing: {
    help: "Essai gratuit, abonnements mensuel ou annuel — ajustez les montants ou ajoutez d'autres offres.",
    placeholder: "",
    examples: [],
    minLength: 1,
    maxLength: 2000,
    rows: 1,
  },
};

export function migrateCreateAnswers(answers: CreateQuestionAnswers): CreateQuestionAnswers {
  const a: Record<string, string> = { ...answers };
  if (!a.audience?.trim()) {
    const legacy = [a.target_user, a.target_user_detail].filter(Boolean).join(" ");
    if (legacy.trim()) a.audience = legacy.trim();
  }
  if (!a.problem?.trim() && a.core_problem?.trim()) a.problem = a.core_problem.trim();
  if (!a.pricing?.trim()) {
    const legacy = [answers.pricing_confirm, answers.pricing_followup].filter(Boolean).join(" · ");
    if (legacy.trim()) a.pricing = legacy.trim();
  }
  if (!a.v1_features?.trim()) {
    const legacy = [a.v1_launch_ready, a.v1_launch_detail, a.first_session].filter(Boolean).join(" · ");
    if (legacy.trim()) a.v1_features = legacy.trim();
  }
  return a;
}

export function answerOf(answers: CreateQuestionAnswers, id: string): string {
  const v = (answers[id] ?? "").trim();
  return v === "__skipped__" ? "" : v;
}

export function isAnswerStep(step: ApplabCreateStepId): step is ApplabAnswerStepId {
  return APPLAB_ANSWER_STEP_ORDER.includes(step as ApplabAnswerStepId);
}

export function getQuestionField(step: ApplabAnswerStepId, ctx: CreateQuestionContext): CreateQuestionField {
  const base = FIELD_CONFIG[step];
  return { id: step, step, question: heroTitleForStep(step, ctx.name), ...base };
}

export function canSubmitAnswerStep(step: ApplabAnswerStepId, value: string): boolean {
  if (step === "pricing") return isValidPricingAnswer(value);
  const min = FIELD_CONFIG[step].minLength;
  return value.trim().length >= min;
}

export function canSubmitInputStep(step: ApplabCreateStepId, draft: {
  name: string;
  concept: string;
  clarifyingAnswers: CreateQuestionAnswers;
}): boolean {
  if (step === "name") return draft.name.trim().length >= 2;
  if (step === "concept") return draft.concept.trim().length >= 12;
  if (isAnswerStep(step)) return canSubmitAnswerStep(step, answerOf(draft.clarifyingAnswers, step));
  return false;
}

export function createQuestionsForApi(ctx: CreateQuestionContext): ApplabClarifyingQuestion[] {
  return APPLAB_ANSWER_STEP_ORDER.map((id) => {
    const field = getQuestionField(id, ctx);
    return { id, question: heroTitleForStep(id, ctx.name), hint: field.help };
  });
}

export function formatCreateAnswersBlock(ctx: CreateQuestionContext): string {
  const norm = (s: string) => normalizeFounderAnswerText(s);
  const header = [
    `- [name] Nom du projet\n  Réponse: ${norm(ctx.name) || "(non renseigné)"}`,
    `- [concept] ${heroTitleForStep("concept", ctx.name)}\n  Réponse: ${norm(ctx.concept) || "(non renseigné)"}`,
  ];
  const steps = APPLAB_ANSWER_STEP_ORDER.map((id) => {
    const a =
      id === "pricing" ?
        monetizationFromPricing(answerOf(ctx.answers, id))
      : answerOf(ctx.answers, id);
    return `- [${id}] ${heroTitleForStep(id, ctx.name)}\n  Réponse: ${norm(a) || "(non renseigné)"}`;
  });
  return [...header, ...steps].join("\n");
}

export function heroTitleForStep(step: ApplabCreateStepId, appName: string): string {
  const app = appName.trim() || "votre app";
  switch (step) {
    case "name":
      return "Créez votre prochaine app maintenant";
    case "concept":
      return `Qu'est-ce que fait ${app} ?`;
    case "audience":
      return "À qui s'adresse votre app ?";
    case "pricing":
      return "Choisissez les tarifs de votre app";
    case "synthesis":
      return `Bilan produit — ${app}`;
    default:
      return "AppLAB Studio";
  }
}

export function buildUnderstandingFromCreateAnswers(
  name: string,
  concept: string,
  answers: CreateQuestionAnswers,
): ApplabConceptUnderstanding {
  const migrated = migrateCreateAnswers(answers);
  const audience = answerOf(migrated, "audience");
  const legacyProblem = answerOf(migrated, "problem");
  const legacyV1 = answerOf(migrated, "v1_features");
  const pricing = answerOf(migrated, "pricing");

  const features = legacyV1
    .split(/\n|[;,]|(?:\d+[\).])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .slice(0, 3);

  const conceptCorpus = `${concept} ${audience} ${legacyV1}`.trim();
  const competitorHints = buildCompetitorSearchHints(concept, conceptCorpus);

  const searchQueries = [
    ...competitorHints.searchQueries,
    concept.slice(0, 48),
    legacyV1.slice(0, 40),
    ...features,
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 8);

  return {
    core_problem: legacyProblem || concept,
    target_user: audience || "À affiner",
    main_use_case: legacyV1 || concept,
    niche: concept.slice(0, 280),
    specific_subject: concept,
    language_or_market: "App Store France — interface FR (décision Trackapp)",
    monetization: monetizationFromPricing(pricing),
    key_features: features.length > 0 ? features : [legacyV1.slice(0, 120) || concept.slice(0, 120)],
    not_competitors: [...competitorHints.notCompetitors],
    search_queries: searchQueries,
    must_match: [...competitorHints.mustMatch],
  };
}

/** Compat legacy clarify-flow imports. */
export const buildUnderstandingFromClarifyFlow = buildUnderstandingFromCreateAnswers;
export const clarifyFlowQuestionsForApi = createQuestionsForApi;
export function getClarifyFlowProgress(ctx: CreateQuestionContext) {
  const done = APPLAB_ANSWER_STEP_ORDER.filter((id) =>
    canSubmitAnswerStep(id, answerOf(ctx.answers, id)),
  ).length;
  return { done, total: APPLAB_ANSWER_STEP_ORDER.length };
}
