import {
  APPLAB_CLARIFY_FINALIZE_JSON_SCHEMA,
  APPLAB_CLARIFY_QUESTIONS_JSON_SCHEMA,
  APPLAB_CLARIFY_SUGGEST_JSON_SCHEMA,
  APPLAB_CONCEPT_ASSESS_JSON_SCHEMA,
} from "@/lib/trackapp-applab-project/schema";
import {
  callApplabProjectOpenAi,
  parseAssessment,
  parseClarifyingQuestions,
  parseUnderstanding,
} from "@/lib/trackapp-applab-project/openai";
import {
  formatClarifyFlowAnswersBlock,
  type ClarifyFlowAnswers,
} from "@/lib/trackapp-applab-create/clarify-flow";
import { normalizeFounderAnswerText } from "@/lib/trackapp-applab-create/normalize-founder-text";
import type {
  ApplabConceptAnswers,
  ApplabConceptAssessment,
  ApplabConceptUnderstanding,
  ApplabClarifyingQuestion,
} from "@/lib/trackapp-applab-project/types";

/** IDs stables — une dimension par question, jamais de doublon. */
export const APPLAB_CLARIFY_TOPIC_IDS = [
  "target_user",
  "core_job",
  "angle_diff",
  "mvp_scope",
  "monetization_model",
  "discovery",
  "success_signal",
] as const;

const START_QUESTIONS_SYSTEM = `Tu es l'architecte produit AppLAB de Trackapp. Tu prépares UNE SEULE série de questions d'exploration pour clarifier un concept d'app mobile.

Règles strictes:
- Génère exactement 4 questions, chacune avec un id UNIQUE parmi: target_user, core_job, angle_diff, mvp_scope, monetization_model, discovery, success_signal.
- Formuler chaque question en vouvoiement (vous / votre / vos).
- Chaque id = une dimension DIFFÉRENTE (utilisateur, problème/job, angle différenciant, périmètre v1.0 App Store, modèle économique, acquisition/découverte, signal de succès).
- monetization_model : demander le TYPE de monétisation (abonnement, achat unique, freemium, ads…) — JAMAIS de prix, tarif, MRR ou montant €/$.
- Personnalise le texte des questions au concept (niche précise, pas généraliste type Duolingo si le sujet est niche).
- hint: exemple de bonne réponse en 1 phrase, concret.
- INTERDIT ABSOLU: questions sur prix, tarif, MRR, « combien vendre », IAP pricing, objectif de revenu chiffré.
- Ne pose jamais deux questions sur le même sujet.

Réponds UNIQUEMENT en JSON conforme au schéma (questions uniquement).`;

const FINALIZE_SYSTEM = `Tu es l'architecte produit AppLAB de Trackapp. Tu synthétises le concept en profil structuré — c'est la DERNIÈRE étape de clarification, tu ne poses PLUS de questions.

Règles:
- Utilise le concept brut + les réponses (y compris vides marquées non renseigné).
- Comprends la NICHE EXACTE (ex: "apprendre à LIRE l'arabe pour francophones" ≠ Duolingo).
- not_competitors: apps trop généralistes ou hors-sujet.
- search_queries: 4-8 requêtes App Store spécifiques (FR + EN).
- monetization: infère UNIQUEMENT si le concept le mentionne explicitement, sinon "À définir plus tard".
- Ne demande jamais de prix ou d'abonnement.

Réponds UNIQUEMENT en JSON conforme au schéma (understanding uniquement).`;

const SUGGEST_SYSTEM = `Tu es l'architecte produit AppLAB (Trackapp). L'utilisateur remplit un champ texte pour clarifier son concept d'app mobile.

Ta mission: rédiger la RÉPONSE DIRECTE qu'il peut coller tel quel dans le champ — comme s'il répondait lui-même à la question posée.

Règles STRICTES:
- INTERDIT de poser une question (aucun "?", pas de "Quels sont…", "Comment…", "Pourquoi…", "Peux-tu…").
- INTERDIT de reformuler la question ou de demander plus d'informations.
- OBLIGATOIRE: 2 à 4 phrases affirmatives, concrètes, en français.
- Adapter le contenu à la dimension de la question (cible, job principal, différenciation, MVP, monétisation, acquisition, succès).
- Pas de prix, tarif ou MRR sauf si le concept initial le mentionne déjà.
- Utilise le concept + les autres réponses déjà fournies pour être spécifique à la niche.

Exemple INTERDIT: "Quels défis rencontrent les débutants en arabe et comment Hasni peut les aider ?"
Exemple CORRECT: "Francophones 18-45 ans, débutants complets en arabe écrit. Souvent frustrés par Duolingo trop vocabulaire-first — ils veulent d'abord maîtriser l'alphabet avec une progression courte et visuelle."

Réponds UNIQUEMENT en JSON conforme au schéma (champ suggestion).`;

const ASSESS_SYSTEM = `Tu es un consultant senior étude de marché + architecte produit AppLAB (Trackapp). Tu reçois le nom du projet, le concept brut et TOUTES les réponses du fondateur (cible, tarifs, etc.).

Ta mission: produire une **étude de marché produit complète, intelligente et actionnable** — comme un cabinet conseil livrerait avant un lancement App Store. Tu ne recopies pas les réponses: tu les **analyses, développes, complètes, structurez et améliores**.

MÉTHODE OBLIGATOIRE:
1. Lire chaque réponse du fondateur — même courtes ou brouillonnes — et en extraire l'intention réelle.
2. Combler les trous par déduction logique à partir du concept + cible + tarifs (jamais de placeholder « à définir » sans contenu).
3. Croiser concept × cible × monétisation pour une vision produit cohérente.
4. Rédiger comme une vraie étude: précis, carré, crédible, sans généralités (« tout le monde », « les utilisateurs »).

CHAMPS CLÉS:
- headline: promesse produit percutante (1 ligne, pas le nom seul).
- summary: executive summary marché (3-5 phrases denses: opportunité, job utilisateur, angle).
- market_insight: analyse marché (taille/segment, tendances, concurrence implicite, fenêtre d'opportunité, 4-6 phrases).
- value_proposition: bénéfice principal unique en 1-2 phrases (résultat concret pour l'utilisateur).
- positioning: comment se positionner vs alternatives (2-3 phrases, niche claire).
- target_user: synthèse cible enrichie (segment principal + comportements + contexte d'usage).
- client_personas: **exactement 2 ou 3 avatars clients** distincts, réalistes, complémentaires:
  · name: prénom crédible (ex: Léa, Karim, Sophie)
  · label: archétype court (ex: « Sportive Apple Watch »)
  · age_range: tranche d'âge précise
  · profile: situation, lifestyle, contexte (2-3 phrases)
  · goals: objectifs concrets liés au concept
  · frustrations: douleurs actuelles sans cette app
  · why_this_app: pourquoi CETTE app résout son cas (lien direct au concept)
- how_it_works: parcours utilisateur complet (welcome → onboarding → première victoire → paywall → usage récurrent).
- differentiation: avantages vs apps généralistes ou concurrents du secteur (concret, pas marketing creux).
- mvp_features: 5-8 fonctionnalités v1.0 **complètes** (écrans/flows nommés, production-ready).
- monetization: reprendre les tarifs fournis si présents; sinon inférer le modèle sans inventer de montants.
- risks: 3-4 risques réels (marché, rétention, différenciation, App Review).
- build_prompt_seed: paragraphe dense pour générer l'app SwiftUI + Xcode (inclure personas + différenciation).

Règles:
- Français, vouvoiement, ton expert mais accessible.
- INTERDIT: copier-coller brut des réponses sans enrichissement.
- INTERDIT: personas génériques interchangeables — chacun doit être unique et ancré dans le concept.
- Les tarifs fournis dans les réponses doivent apparaître dans monetization.

Réponds UNIQUEMENT en JSON conforme au schéma.`;

export function formatClarifyAnswersBlock(
  answers: ApplabConceptAnswers,
  questions: readonly ApplabClarifyingQuestion[],
  meta?: { name?: string; concept?: string },
): string {
  if (questions.length === 0) return "Aucune question posée.";
  const isFlow = questions.some((q) => q.id === "pricing" || q.id === "pricing_confirm");
  if (isFlow && meta?.name != null && meta?.concept != null) {
    return formatClarifyFlowAnswersBlock({
      name: meta.name,
      concept: meta.concept,
      answers: answers as ClarifyFlowAnswers,
    });
  }
  return questions
    .map((q) => {
      const raw = (answers[q.id] ?? "").trim();
      const a = raw === "__skipped__" ? "" : normalizeFounderAnswerText(raw);
      return `- [${q.id}] ${q.question}\n  Réponse: ${a || "(non renseigné — déduire prudemment du concept)"}`;
    })
    .join("\n");
}

function buildStartInput(name: string, concept: string): string {
  return JSON.stringify({ project_name: name, concept_raw: concept }, null, 2);
}

function buildFinalizeInput(
  name: string,
  concept: string,
  answers: ApplabConceptAnswers,
  questions: readonly ApplabClarifyingQuestion[],
): string {
  return JSON.stringify(
    {
      project_name: name,
      concept_raw: concept,
      clarifications: formatClarifyAnswersBlock(answers, questions, { name, concept }),
    },
    null,
    2,
  );
}

export type StartClarifyResult = Readonly<{
  questions: readonly ApplabClarifyingQuestion[];
  failure?: string;
  failureDetail?: string;
}>;

export async function startApplabConceptClarify(input: {
  name: string;
  concept: string;
}): Promise<StartClarifyResult> {
  const name = input.name.trim();
  const concept = input.concept.trim();

  const result = await callApplabProjectOpenAi<{ questions: unknown }>({
    instructions: START_QUESTIONS_SYSTEM,
    input: buildStartInput(name, concept),
    schemaName: "applab_clarify_questions",
    schema: APPLAB_CLARIFY_QUESTIONS_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.data) {
    return { questions: [], failure: result.failure, failureDetail: result.failureDetail };
  }

  const questions = parseClarifyingQuestions(result.data.questions);
  return {
    questions,
    failure: questions.length > 0 ? undefined : "parse",
    failureDetail: questions.length > 0 ? undefined : "Aucune question générée",
  };
}

export type FinalizeClarifyResult = Readonly<{
  understanding: ApplabConceptUnderstanding | null;
  failure?: string;
  failureDetail?: string;
}>;

export async function finalizeApplabConceptClarify(input: {
  name: string;
  concept: string;
  answers?: ApplabConceptAnswers;
  questions: readonly ApplabClarifyingQuestion[];
}): Promise<FinalizeClarifyResult> {
  const name = input.name.trim();
  const concept = input.concept.trim();
  const answers = input.answers ?? {};
  const questions = input.questions;

  if (questions.length === 0) {
    return { understanding: null, failure: "invalid", failureDetail: "Questions manquantes" };
  }

  const result = await callApplabProjectOpenAi<{ understanding: unknown }>({
    instructions: FINALIZE_SYSTEM,
    input: buildFinalizeInput(name, concept, answers, questions),
    schemaName: "applab_clarify_finalize",
    schema: APPLAB_CLARIFY_FINALIZE_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.data) {
    return { understanding: null, failure: result.failure, failureDetail: result.failureDetail };
  }

  const understanding = parseUnderstanding(result.data.understanding);
  return {
    understanding,
    failure: understanding ? undefined : "parse",
    failureDetail: understanding ? undefined : "Understanding invalide",
  };
}

function isQuestionLikeSuggestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return true;
  if (/\?\s*$/.test(t)) return true;
  if (/^(quel|quels|quelle|qu'|comment|pourquoi|est-ce|peux-tu|as-tu|peut-on|devrais-je|avez-vous|as-tu|souhaitez-vous)/i.test(t)) {
    return true;
  }
  const questionMarks = (t.match(/\?/g) ?? []).length;
  if (questionMarks >= 1 && t.length < 120) return true;
  return false;
}

export async function suggestApplabClarifyAnswer(input: {
  name: string;
  concept: string;
  question: ApplabClarifyingQuestion;
  answers: ApplabConceptAnswers;
  questions: readonly ApplabClarifyingQuestion[];
}): Promise<Readonly<{ suggestion: string | null; failure?: string; failureDetail?: string }>> {
  const payload = {
    task: "Rédige la réponse directe à coller dans le champ utilisateur. Ne pose AUCUNE question.",
    project_name: input.name.trim(),
    concept_raw: input.concept.trim(),
    question_id: input.question.id,
    question: input.question.question,
    hint: input.question.hint ?? "",
    other_answers: formatClarifyAnswersBlock(input.answers, input.questions),
  };

  const userInput = JSON.stringify(payload, null, 2);

  const result = await callApplabProjectOpenAi<{ suggestion: string }>({
    instructions: SUGGEST_SYSTEM,
    input: userInput,
    schemaName: "applab_clarify_suggest",
    schema: APPLAB_CLARIFY_SUGGEST_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let suggestion = result.data?.suggestion?.trim() ?? "";

  if (suggestion && isQuestionLikeSuggestion(suggestion)) {
    const retry = await callApplabProjectOpenAi<{ suggestion: string }>({
      instructions: `${SUGGEST_SYSTEM}\n\nCORRECTION: ta réponse précédente était une question — INTERDIT. Donne uniquement des affirmations descriptives.`,
      input: JSON.stringify(
        {
          ...payload,
          rejected_previous: suggestion,
        },
        null,
        2,
      ),
      schemaName: "applab_clarify_suggest",
      schema: APPLAB_CLARIFY_SUGGEST_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    suggestion = retry.data?.suggestion?.trim() ?? suggestion;
  }

  if (!suggestion || isQuestionLikeSuggestion(suggestion)) {
    return {
      suggestion: null,
      failure: result.failure ?? "parse",
      failureDetail: "La suggestion doit être une réponse directe, pas une question.",
    };
  }

  return { suggestion };
}

export async function assessApplabConcept(input: {
  name: string;
  concept: string;
  understanding: ApplabConceptUnderstanding;
  answers: ApplabConceptAnswers;
  questions: readonly ApplabClarifyingQuestion[];
}): Promise<
  Readonly<{
    assessment: ApplabConceptAssessment | null;
    failure?: string;
    failureDetail?: string;
  }>
> {
  const clarifications = formatClarifyAnswersBlock(input.answers, input.questions, {
    name: input.name,
    concept: input.concept,
  });

  const userInput = JSON.stringify(
    {
      mission:
        "Étude de marché produit complète: analyser, développer et enrichir toutes les réponses du fondateur.",
      project_name: input.name.trim(),
      concept_raw: input.concept.trim(),
      founder_answers_raw: clarifications,
      understanding_draft: input.understanding,
      instructions_analyste: [
        "Développer chaque réponse en profondeur — ne pas se contenter de reformuler.",
        "Créer 2-3 personas clients distincts, crédibles et ancrés dans le concept.",
        "Synthétiser une vraie étude de marché: insight, proposition de valeur, positionnement.",
        "Aligner fonctionnalités v1.0, monétisation et cible en un récit cohérent.",
      ],
    },
    null,
    2,
  );

  const result = await callApplabProjectOpenAi<unknown>({
    instructions: ASSESS_SYSTEM,
    input: userInput,
    schemaName: "applab_concept_assess",
    schema: APPLAB_CONCEPT_ASSESS_JSON_SCHEMA as unknown as Record<string, unknown>,
    timeoutMs: 72_000,
  });

  if (!result.data) {
    return { assessment: null, failure: result.failure, failureDetail: result.failureDetail };
  }

  const assessment = parseAssessment(result.data);
  return {
    assessment,
    failure: assessment ? undefined : "parse",
    failureDetail: assessment ? undefined : "Assessment invalide",
  };
}

/** @deprecated Utiliser startApplabConceptClarify + finalizeApplabConceptClarify */
export async function clarifyApplabConcept(input: {
  name: string;
  concept: string;
  answers?: ApplabConceptAnswers;
  questions?: readonly ApplabClarifyingQuestion[];
  priorUnderstanding?: ApplabConceptUnderstanding | null;
}): Promise<{
  status: "needs_clarification" | "ready_to_assess";
  understanding: ApplabConceptUnderstanding | null;
  questions: readonly ApplabClarifyingQuestion[];
  failure?: string;
  failureDetail?: string;
}> {
  const questions = input.questions ?? [];
  if (questions.length === 0) {
    const started = await startApplabConceptClarify(input);
    return {
      status: "needs_clarification",
      understanding: null,
      questions: started.questions,
      failure: started.failure,
      failureDetail: started.failureDetail,
    };
  }
  const finalized = await finalizeApplabConceptClarify({
    name: input.name,
    concept: input.concept,
    answers: input.answers,
    questions,
  });
  return {
    status: "ready_to_assess",
    understanding: finalized.understanding,
    questions,
    failure: finalized.failure,
    failureDetail: finalized.failureDetail,
  };
}

export type ClarifyConceptResult = Awaited<ReturnType<typeof clarifyApplabConcept>>;
