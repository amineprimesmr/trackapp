"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  APPLAB_SYNTHESIS_PIPELINE_STEPS,
  TrackappApplabSynthesisLoader,
  type ApplabSynthesisPipelineId,
} from "@/components/trackapp/applab-create/trackapp-applab-synthesis-loader";
import { TrackappApplabSynthesisProfile } from "@/components/trackapp/applab-create/trackapp-applab-synthesis-profile";
import type { ReferenceSuggestion } from "@/components/trackapp/applab-create/trackapp-applab-reference-suggestions";
import {
  buildUnderstandingFromCreateAnswers,
  createQuestionsForApi,
  migrateCreateAnswers,
} from "@/lib/trackapp-applab-create/create-questions";
import { isApplabSynthesisCached } from "@/lib/trackapp-applab-create/storage";
import { TRACKAPP_APPLAB_DEFAULT_CONSTRAINTS } from "@/lib/trackapp-applab-create/trackapp-auto-decisions";
import type { ApplabCreateDraft } from "@/lib/trackapp-applab-create/types";
import type {
  ApplabConceptAssessment,
  ApplabConceptUnderstanding,
  ApplabReferenceMatch,
} from "@/lib/trackapp-applab-project/types";
type PipelineId = ApplabSynthesisPipelineId;

const PIPELINE_STEPS = APPLAB_SYNTHESIS_PIPELINE_STEPS;

function toReferenceSuggestions(apps: readonly ApplabReferenceMatch[]): ReferenceSuggestion[] {
  return apps.map((app) => ({
    id: app.id,
    name: app.name,
    artistName: app.artistName,
    category: app.category,
    artworkUrl: app.artworkUrl,
    revenueDisplay: app.revenueDisplay,
    relevanceScore: app.relevanceScore,
    relevanceReason: app.relevanceReason,
    rank: app.rank,
  }));
}

type Props = Readonly<{
  draft: ApplabCreateDraft;
  onDraftChange: (next: ApplabCreateDraft) => void;
  onBusyChange?: (busy: boolean) => void;
  onReadyChange?: (ready: boolean) => void;
  onPhaseChange?: (phase: "analyzing" | "reveal") => void;
  onSyncPromptVersion?: (version: ApplabCreateDraft["promptVersions"][number]) => void;
}>;

export function TrackappApplabSynthesisStep({
  draft,
  onDraftChange,
  onBusyChange,
  onReadyChange,
  onPhaseChange,
  onSyncPromptVersion,
}: Props) {
  const cachedOnMount = isApplabSynthesisCached(draft);
  const bootstrappedRef = useRef(false);

  const [phase, setPhase] = useState<"analyzing" | "reveal">(cachedOnMount ? "reveal" : "analyzing");
  const [activePipeline, setActivePipeline] = useState(0);
  const [donePipeline, setDonePipeline] = useState<readonly PipelineId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<ReferenceSuggestion[]>(() =>
    toReferenceSuggestions(draft.synthesisCompetitors ?? []),
  );

  const answers = useMemo(() => migrateCreateAnswers(draft.clarifyingAnswers), [draft.clarifyingAnswers]);
  const ctx = useMemo(() => ({ name: draft.name, concept: draft.concept, answers }), [answers, draft.concept, draft.name]);
  const questions = useMemo(() => createQuestionsForApi(ctx), [ctx]);

  const markDone = useCallback((id: PipelineId) => {
    setDonePipeline((prev) => (prev.includes(id) ? prev : [...prev, id]));
    const idx = PIPELINE_STEPS.findIndex((s) => s.id === id);
    if (idx >= 0) setActivePipeline(Math.min(idx + 1, PIPELINE_STEPS.length - 1));
  }, []);

  const fetchCompetitors = useCallback(
    async (
      understanding: ApplabConceptUnderstanding,
      assessment: ApplabConceptAssessment,
    ): Promise<readonly ApplabReferenceMatch[]> => {
      const refRes = await fetch("/api/trackapp/applab/reference-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: draft.concept,
          name: draft.name,
          country: draft.referenceCountry || "fr",
          understanding,
          assessment,
        }),
        cache: "no-store",
      });
      const refData = (await refRes.json()) as { apps?: ApplabReferenceMatch[] };
      return Array.isArray(refData.apps) ? refData.apps : [];
    },
    [draft.concept, draft.name, draft.referenceCountry],
  );

  const applyCompetitors = useCallback(
    (apps: readonly ApplabReferenceMatch[], base: ApplabCreateDraft) => {
      setCompetitors(toReferenceSuggestions(apps));
      const top = apps[0];
      let nextDraft: ApplabCreateDraft = { ...base, synthesisCompetitors: apps };
      if (top && !nextDraft.referenceAppId) {
        nextDraft = {
          ...nextDraft,
          referenceAppId: top.id,
          referenceAppName: top.name,
          referenceAppArtworkUrl: top.artworkUrl,
        };
      }
      onDraftChange(nextDraft);
    },
    [onDraftChange],
  );

  const runPipeline = useCallback(
    async (options?: Readonly<{ force?: boolean }>) => {
      const force = options?.force === true;

      if (!force && isApplabSynthesisCached(draft)) {
        setPhase("reveal");
        onPhaseChange?.("reveal");
        onReadyChange?.(Boolean(draft.activePromptVersionId && draft.promptVersions.length > 0));
        if ((draft.synthesisCompetitors ?? []).length > 0) {
          setCompetitors(toReferenceSuggestions(draft.synthesisCompetitors));
        }
        return;
      }

      onBusyChange?.(true);
      setError(null);
      setPhase("analyzing");
      onPhaseChange?.("analyzing");
      setDonePipeline([]);
      setActivePipeline(0);

      try {
        await new Promise((r) => setTimeout(r, 420));
        markDone("answers");

        const understanding: ApplabConceptUnderstanding = buildUnderstandingFromCreateAnswers(
          draft.name,
          draft.concept,
          answers,
        );
        await new Promise((r) => setTimeout(r, 380));
        markDone("understanding");

        let assessment: ApplabConceptAssessment | null = draft.assessment;
        if (!assessment || force) {
          const assessRes = await fetch("/api/trackapp/applab/concept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "assess",
              name: draft.name,
              concept: draft.concept,
              understanding,
              answers,
              questions,
            }),
            cache: "no-store",
          });
          const assessData = (await assessRes.json()) as {
            assessment?: ApplabConceptAssessment;
            error?: string;
            failure?: string;
            failureDetail?: string;
          };
          if (!assessRes.ok || !assessData.assessment) {
            const detail =
              assessData.failure === "openai_missing_key"
                ? "Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez le serveur."
                : assessData.failureDetail?.trim();
            throw new Error(detail || assessData.error || "Synthèse indisponible.");
          }
          assessment = assessData.assessment;
        }
        markDone("assessment");

        const enrichedUnderstanding: ApplabConceptUnderstanding = {
          ...understanding,
          target_user: assessment?.target_user || understanding.target_user,
          monetization: assessment?.monetization || understanding.monetization,
          key_features:
            assessment && assessment.mvp_features.length > 0
              ? assessment.mvp_features
              : understanding.key_features,
          niche: assessment?.positioning || understanding.niche,
          core_problem: assessment?.value_proposition || understanding.core_problem,
        };

        let nextDraft: ApplabCreateDraft = {
          ...draft,
          understanding: enrichedUnderstanding,
          assessment,
          clarifyingQuestions: questions,
          constraints: {
            mustHave: TRACKAPP_APPLAB_DEFAULT_CONSTRAINTS.mustHave,
            mustNot: TRACKAPP_APPLAB_DEFAULT_CONSTRAINTS.mustNot,
          },
        };

        const apps = await fetchCompetitors(enrichedUnderstanding, assessment!);
        applyCompetitors(apps, nextDraft);
        markDone("competitors");

        await new Promise((r) => setTimeout(r, 320));
        markDone("prompt");

        setPhase("reveal");
        onPhaseChange?.("reveal");
        onReadyChange?.(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analyse impossible pour l'instant.");
      } finally {
        onBusyChange?.(false);
      }
    },
    [
      answers,
      applyCompetitors,
      draft,
      fetchCompetitors,
      markDone,
      onBusyChange,
      onPhaseChange,
      onReadyChange,
      questions,
    ],
  );

  useLayoutEffect(() => {
    if (!isApplabSynthesisCached(draft)) return;
    setPhase("reveal");
    onPhaseChange?.("reveal");
  }, [draft.assessment, draft.understanding, onPhaseChange]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void runPipeline();
  }, [runPipeline]);

  useEffect(() => {
    const ready = Boolean(draft.activePromptVersionId && draft.promptVersions.length > 0);
    onReadyChange?.(ready);
  }, [draft.activePromptVersionId, draft.promptVersions.length, onReadyChange]);

  useEffect(() => {
    if (draft.synthesisCompetitors.length === 0) return;
    setCompetitors(toReferenceSuggestions(draft.synthesisCompetitors));
  }, [draft.synthesisCompetitors]);

  if (phase === "analyzing" && !error) {
    return (
      <TrackappApplabSynthesisLoader donePipeline={donePipeline} activePipeline={activePipeline} />
    );
  }

  if (error) {
    return (
      <div className="ta-applab-synthesis ta-applab-synthesis--error">
        <p className="ta-applab-synthesis__error">{error}</p>
        <button
          type="button"
          className="ta-applab-studio__btn ta-applab-studio__btn--primary"
          onClick={() => void runPipeline({ force: true })}
        >
          Relancer l&apos;analyse
        </button>
      </div>
    );
  }

  return (
    <div className="ta-applab-synthesis ta-applab-synthesis--reveal">
      {draft.understanding && draft.assessment ? (
        <TrackappApplabSynthesisProfile
          draft={draft}
          competitors={competitors}
          answers={answers}
          questions={questions}
          onDraftChange={onDraftChange}
          onBusyChange={onBusyChange}
          onSyncPromptVersion={onSyncPromptVersion}
        />
      ) : null}
    </div>
  );
}
