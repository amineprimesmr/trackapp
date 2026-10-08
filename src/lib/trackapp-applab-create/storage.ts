import type { ApplabCreateDraft, ApplabCreateStepId } from "@/lib/trackapp-applab-create/types";
import { DEFAULT_APPLAB_CONSTRAINTS } from "@/lib/trackapp-applab-create/types";
import { migrateCreateAnswers } from "@/lib/trackapp-applab-create/create-questions";

export const APPLAB_CREATE_STORAGE_KEY = "trackapp-applab-create:v3";
export const APPLAB_DRAFT_CHANGE_EVENT = "trackapp-applab-draft-change";

const STEP_ORDER: ApplabCreateStepId[] = [
  "name",
  "concept",
  "audience",
  "pricing",
  "synthesis",
];

function normalizeStep(step: unknown): ApplabCreateStepId {
  if (step === "welcome") return "name";
  if (step === "ready" || step === "prompt") return "synthesis";
  if (step === "clarify") return "audience";
  if (step === "problem" || step === "v1_features") return "pricing";
  if (step === "assessment" || step === "reference" || step === "constraints") return "synthesis";
  if (
    step === "name" ||
    step === "concept" ||
    step === "audience" ||
    step === "pricing" ||
    step === "synthesis"
  ) {
    return step;
  }
  return "name";
}

function migrateLegacyDraft(raw: Record<string, unknown>): ApplabCreateDraft {
  const base = defaultApplabCreateDraft({
    setupComplete: Boolean(raw.setupComplete),
    currentStep: normalizeStep(raw.currentStep),
    name: typeof raw.name === "string" ? raw.name : "",
    concept: typeof raw.concept === "string" ? raw.concept : "",
    referenceAppId: typeof raw.referenceAppId === "string" ? raw.referenceAppId : null,
    referenceAppName: typeof raw.referenceAppName === "string" ? raw.referenceAppName : null,
    referenceAppArtworkUrl:
      typeof raw.referenceAppArtworkUrl === "string" ? raw.referenceAppArtworkUrl : null,
    stack: "swiftui",
  });

  const constraintsRaw = raw.constraints;
  const constraints =
    constraintsRaw && typeof constraintsRaw === "object" && !Array.isArray(constraintsRaw) ?
      {
        mustHave: String((constraintsRaw as Record<string, unknown>).mustHave ?? ""),
        mustNot: String((constraintsRaw as Record<string, unknown>).mustNot ?? ""),
      }
    : DEFAULT_APPLAB_CONSTRAINTS;

  const promptVersions = Array.isArray(raw.promptVersions) ? raw.promptVersions : [];
  const activePromptVersionId =
    typeof raw.activePromptVersionId === "string" ? raw.activePromptVersionId : null;

  const clarifyingAnswers =
    raw.clarifyingAnswers && typeof raw.clarifyingAnswers === "object" ?
      migrateCreateAnswers(raw.clarifyingAnswers as Record<string, string>)
    : {};

  return {
    ...base,
    clarifyingAnswers,
    constraints,
    promptVersions: promptVersions as ApplabCreateDraft["promptVersions"],
    activePromptVersionId,
    referenceCountry: typeof raw.referenceCountry === "string" ? raw.referenceCountry : "fr",
    syncedAt: typeof raw.syncedAt === "string" ? raw.syncedAt : null,
  };
}

export function defaultApplabCreateDraft(partial?: Partial<ApplabCreateDraft>): ApplabCreateDraft {
  const { currentStep, version: _version, clarifyingAnswers: partialAnswers, ...rest } = partial ?? {};

  return {
    version: 3,
    setupComplete: false,
    name: "",
    concept: "",
    clarifyingQuestions: [],
    clarifyingAnswers: migrateCreateAnswers(partialAnswers ?? {}),
    understanding: null,
    assessment: null,
    referenceAppId: null,
    referenceAppName: null,
    referenceAppArtworkUrl: null,
    referenceCountry: "fr",
    constraints: DEFAULT_APPLAB_CONSTRAINTS,
    stack: "swiftui",
    promptVersions: [],
    activePromptVersionId: null,
    synthesisCompetitors: [],
    syncedAt: null,
    updatedAt: new Date().toISOString(),
    ...rest,
    currentStep: normalizeStep(currentStep ?? "name"),
  };
}

export function readApplabCreateDraft(): ApplabCreateDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const rawV3 = localStorage.getItem(APPLAB_CREATE_STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3) as ApplabCreateDraft;
      if (parsed?.version === 3) {
        return {
          ...defaultApplabCreateDraft(),
          ...parsed,
          currentStep: normalizeStep(parsed.currentStep),
          clarifyingAnswers: migrateCreateAnswers(parsed.clarifyingAnswers ?? {}),
          constraints: parsed.constraints ?? DEFAULT_APPLAB_CONSTRAINTS,
          promptVersions: parsed.promptVersions ?? [],
          synthesisCompetitors: Array.isArray(parsed.synthesisCompetitors) ?
            parsed.synthesisCompetitors
          : [],
        };
      }
    }

    for (const key of ["trackapp-applab-create:v2", "trackapp-applab-create:v1"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed?.version === 2 || parsed?.version === 1) {
        const migrated = migrateLegacyDraft(parsed);
        writeApplabCreateDraft(migrated);
        return migrated;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function readApplabProjectNav(): Readonly<{ name: string; inProgress: boolean }> | null {
  const draft = readApplabCreateDraft();
  const name = draft?.name?.trim() ?? "";
  if (name.length < 2) return null;
  return { name, inProgress: !draft?.setupComplete };
}

export function writeApplabCreateDraft(draft: ApplabCreateDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      APPLAB_CREATE_STORAGE_KEY,
      JSON.stringify({
        ...draft,
        version: 3,
        currentStep: normalizeStep(draft.currentStep),
        clarifyingAnswers: migrateCreateAnswers(draft.clarifyingAnswers ?? {}),
        updatedAt: new Date().toISOString(),
      }),
    );
    window.dispatchEvent(new CustomEvent(APPLAB_DRAFT_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function stepIndex(stepId: ApplabCreateStepId): number {
  return Math.max(0, STEP_ORDER.indexOf(normalizeStep(stepId)));
}

export function nextStepId(stepId: ApplabCreateStepId): ApplabCreateStepId | null {
  const i = STEP_ORDER.indexOf(normalizeStep(stepId));
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1]! : null;
}

export function prevStepId(stepId: ApplabCreateStepId): ApplabCreateStepId | null {
  const i = STEP_ORDER.indexOf(normalizeStep(stepId));
  return i > 0 ? STEP_ORDER[i - 1]! : null;
}

export function hasPassedNameStep(currentStep: ApplabCreateStepId): boolean {
  return stepIndex(currentStep) > stepIndex("name");
}

/** Bilan déjà généré (synthèse + understanding) — ne pas relancer l’animation au refresh. */
export function isApplabSynthesisCached(draft: ApplabCreateDraft): boolean {
  return Boolean(draft.understanding && draft.assessment);
}

export function getActivePromptVersion(draft: ApplabCreateDraft) {
  if (!draft.activePromptVersionId) return null;
  return draft.promptVersions.find((v) => v.id === draft.activePromptVersionId) ?? null;
}

export function appendPromptVersion(
  draft: ApplabCreateDraft,
  version: ApplabCreateDraft["promptVersions"][number],
): ApplabCreateDraft {
  const nextVersions = [version, ...draft.promptVersions.filter((v) => v.id !== version.id)].slice(
    0,
    10,
  );
  return {
    ...draft,
    promptVersions: nextVersions,
    activePromptVersionId: version.id,
  };
}
