/** Schémas JSON stricts — OpenAI Responses API pour AppLAB Project Intelligence. */

export const APPLAB_CONCEPT_CLARIFY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["needs_clarification", "ready_to_assess"] },
    understanding: {
      type: "object",
      additionalProperties: false,
      properties: {
        core_problem: { type: "string" },
        target_user: { type: "string" },
        main_use_case: { type: "string" },
        niche: { type: "string" },
        specific_subject: { type: "string" },
        language_or_market: { type: "string" },
        monetization: { type: "string" },
        key_features: { type: "array", items: { type: "string" }, maxItems: 8 },
        not_competitors: { type: "array", items: { type: "string" }, maxItems: 10 },
        search_queries: { type: "array", items: { type: "string" }, maxItems: 10 },
        must_match: { type: "array", items: { type: "string" }, maxItems: 8 },
      },
      required: [
        "core_problem",
        "target_user",
        "main_use_case",
        "niche",
        "specific_subject",
        "language_or_market",
        "monetization",
        "key_features",
        "not_competitors",
        "search_queries",
        "must_match",
      ],
    },
    questions: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          hint: { type: "string" },
        },
        required: ["id", "question", "hint"],
      },
    },
  },
  required: ["status", "understanding", "questions"],
} as const;

const APPLAB_CLIENT_PERSONA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    label: { type: "string" },
    age_range: { type: "string" },
    profile: { type: "string" },
    goals: { type: "string" },
    frustrations: { type: "string" },
    why_this_app: { type: "string" },
  },
  required: ["name", "label", "age_range", "profile", "goals", "frustrations", "why_this_app"],
} as const;

export const APPLAB_CONCEPT_ASSESS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    how_it_works: { type: "string" },
    target_user: { type: "string" },
    monetization: { type: "string" },
    differentiation: { type: "string" },
    mvp_features: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 8 },
    risks: { type: "array", items: { type: "string" }, maxItems: 4 },
    build_prompt_seed: { type: "string" },
    market_insight: { type: "string" },
    value_proposition: { type: "string" },
    positioning: { type: "string" },
    client_personas: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: APPLAB_CLIENT_PERSONA_SCHEMA,
    },
  },
  required: [
    "headline",
    "summary",
    "how_it_works",
    "target_user",
    "monetization",
    "differentiation",
    "mvp_features",
    "risks",
    "build_prompt_seed",
    "market_insight",
    "value_proposition",
    "positioning",
    "client_personas",
  ],
} as const;

/** Génération initiale — questions uniquement. */
export const APPLAB_CLARIFY_QUESTIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          hint: { type: "string" },
        },
        required: ["id", "question", "hint"],
      },
    },
  },
  required: ["questions"],
} as const;

/** Synthèse finale — understanding uniquement, pas de nouvelles questions. */
export const APPLAB_CLARIFY_FINALIZE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    understanding: APPLAB_CONCEPT_CLARIFY_JSON_SCHEMA.properties.understanding,
  },
  required: ["understanding"],
} as const;

export const APPLAB_CLARIFY_SUGGEST_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestion: { type: "string" },
  },
  required: ["suggestion"],
} as const;

export const APPLAB_COMPETITOR_RANK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    search_queries: { type: "array", items: { type: "string" }, maxItems: 8 },
    exclude_app_names: { type: "array", items: { type: "string" }, maxItems: 12 },
    ranked: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          relevance_score: { type: "number", minimum: 0, maximum: 100 },
          include: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["id", "relevance_score", "include", "reason"],
      },
    },
  },
  required: ["search_queries", "exclude_app_names", "ranked"],
} as const;
