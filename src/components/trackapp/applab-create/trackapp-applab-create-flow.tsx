"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TrackappApplabCreateStartButton } from "@/components/trackapp/applab-create/trackapp-applab-create-start-button";
import { TrackappApplabComposerSubmit } from "@/components/trackapp/applab-create/trackapp-applab-composer-submit";
import { TrackappApplabGlassComposer } from "@/components/trackapp/applab-create/trackapp-applab-glass-composer";
import { TrackappApplabHeroHeading } from "@/components/trackapp/applab-create/trackapp-applab-hero-heading";
import { TrackappApplabPricingField } from "@/components/trackapp/applab-create/trackapp-applab-pricing-field";
import { TrackappApplabQuestionField } from "@/components/trackapp/applab-create/trackapp-applab-question-field";
import { TrackappApplabLandingSection } from "@/components/trackapp/applab-create/trackapp-applab-landing-section";
import { TrackappCompetitorContentSection } from "@/components/trackapp/applab-create/trackapp-competitor-content-section";
import { TrackappApplabStudioGallery } from "@/components/trackapp/applab-create/trackapp-applab-studio-gallery";
import { TrackappLandingOfferSection } from "@/components/trackapp/trackapp-landing-offer-section";
import { TrackappLandingClosingSection } from "@/components/trackapp/trackapp-landing-closing-section";
import { TrackappLandingFaqSection } from "@/components/trackapp/trackapp-landing-faq-section";
import { TrackappLandingFooter } from "@/components/trackapp/trackapp-landing-footer";
import { TrackappApplabSynthesisStep } from "@/components/trackapp/applab-create/trackapp-applab-synthesis-step";
import { TrackerHeroSocialProofBadge } from "@/components/tracker/tracker-hero-social-proof-badge";
import { TrackerSaleNotificationsExperience } from "@/components/tracker/tracker-sale-notifications-experience";
import { listHeroRotatorApps } from "@/lib/selection-app/items";
import { ensurePricingAnswer } from "@/lib/trackapp-applab-create/pricing-plans";
import {
  canSubmitInputStep,
  createQuestionsForApi,
  getQuestionField,
  isAnswerStep,
  migrateCreateAnswers,
} from "@/lib/trackapp-applab-create/create-questions";
import {
  defaultApplabCreateDraft,
  hasPassedNameStep,
  isApplabSynthesisCached,
  nextStepId,
  prevStepId,
  readApplabCreateDraft,
  writeApplabCreateDraft,
} from "@/lib/trackapp-applab-create/storage";
import { useApplabDraftSync } from "@/lib/trackapp-applab-create/use-applab-draft-sync";
import { applabBelowMotion, applabMotionTransition } from "@/lib/trackapp-applab-create/step-motion";
import type { ApplabCreateDraft, ApplabCreateStepId } from "@/lib/trackapp-applab-create/types";
import type { AppShowcaseVideoItemEnriched } from "@/lib/showcase-app-videos-types";
import { cn } from "@/lib/utils";

type Props = Readonly<{
  initialName?: string;
  initialConcept?: string;
  showcaseVideos?: AppShowcaseVideoItemEnriched[];
}>;

const STEP_HERO: Record<ApplabCreateStepId, { title: string; sub: string }> = {
  name: { title: "", sub: "" },
  concept: { title: "", sub: "" },
  audience: { title: "", sub: "" },
  pricing: { title: "", sub: "" },
  synthesis: { title: "", sub: "" },
};

function StudioBackButton({
  onBack,
  disabled,
  className,
}: Readonly<{ onBack: () => void; disabled?: boolean; className?: string }>) {
  return (
    <button type="button" className={cn("ta-applab-studio__back-btn", className)} onClick={onBack} disabled={disabled}>
      <span className="ta-applab-studio__back-btn-icon" aria-hidden>
        ←
      </span>
      Retour
    </button>
  );
}

function HomeHub({ showcaseVideos }: Readonly<{ showcaseVideos: AppShowcaseVideoItemEnriched[] }>) {
  return (
    <>
      <TrackappApplabStudioGallery videos={showcaseVideos} />
      <TrackappApplabLandingSection />
      <TrackappCompetitorContentSection />
      <TrackappLandingOfferSection />
      <TrackappLandingFaqSection />
      <TrackappLandingClosingSection />
      <TrackappLandingFooter />
    </>
  );
}

export function TrackappApplabCreateFlow({
  initialName = "",
  initialConcept = "",
  showcaseVideos = [],
}: Props) {
  const [draft, setDraft] = useState<ApplabCreateDraft>(() =>
    defaultApplabCreateDraft({ name: initialName, concept: initialConcept }),
  );
  const [hydrated, setHydrated] = useState(false);
  const [intelBusy, setIntelBusy] = useState(false);
  const [answerDraft, setAnswerDraft] = useState("");
  const [synthesisPhase, setSynthesisPhase] = useState<"analyzing" | "reveal">("analyzing");
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const localSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const belowExitTransition = applabMotionTransition(reduceMotion, 0.22);

  const currentStep = draft.currentStep;
  const hero = STEP_HERO[currentStep];
  const answers = useMemo(() => migrateCreateAnswers(draft.clarifyingAnswers), [draft.clarifyingAnswers]);
  const questionCtx = useMemo(
    () => ({ name: draft.name, concept: draft.concept, answers }),
    [answers, draft.concept, draft.name],
  );
  const questionField =
    isAnswerStep(currentStep) && currentStep !== "pricing" ?
      getQuestionField(currentStep, questionCtx)
    : null;
  const heroRotatorApps = useMemo(() => listHeroRotatorApps(), []);

  useEffect(() => {
    const saved = readApplabCreateDraft();
    if (saved) {
      setDraft(saved);
      if (saved.currentStep === "synthesis" && isApplabSynthesisCached(saved)) {
        setSynthesisPhase("reveal");
      }
    } else if (initialName || initialConcept) {
      setDraft((d) => ({ ...d, name: initialName || d.name, concept: initialConcept || d.concept }));
    }
    setHydrated(true);
  }, [initialName, initialConcept]);

  const saveDraft = useCallback((next: ApplabCreateDraft, flush = false) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);

    if (localSaveTimerRef.current) {
      clearTimeout(localSaveTimerRef.current);
      localSaveTimerRef.current = null;
    }

    if (flush) {
      writeApplabCreateDraft(stamped);
      return;
    }

    localSaveTimerRef.current = setTimeout(() => {
      writeApplabCreateDraft(stamped);
      localSaveTimerRef.current = null;
    }, 450);
  }, []);

  const persist = useCallback((next: ApplabCreateDraft) => saveDraft(next, true), [saveDraft]);
  const updateDraft = useCallback((next: ApplabCreateDraft) => saveDraft(next, false), [saveDraft]);

  const { pushDraft, pushPromptVersion } = useApplabDraftSync(draft, (remote) => {
    setDraft(remote);
    writeApplabCreateDraft(remote);
  });

  useEffect(
    () => () => {
      if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    pushDraft(draft);
  }, [draft, pushDraft]);

  useEffect(() => {
    if (!isAnswerStep(currentStep)) return;
    const saved = answers[currentStep] ?? "";
    if (currentStep === "pricing") {
      setAnswerDraft(ensurePricingAnswer(saved));
      return;
    }
    setAnswerDraft(saved);
  }, [answers, currentStep]);

  const showBackNav = hasPassedNameStep(currentStep) || draft.setupComplete;
  const isInputStep = currentStep !== "synthesis";
  const isGlassExpanded = currentStep !== "name";
  const isPricingStep = currentStep === "pricing";
  const isGlassArea = currentStep === "concept" || isAnswerStep(currentStep);
  const showHomeHub = currentStep === "name" && draft.name.trim().length === 0;

  const continueLabel = "Continuer";

  const canContinue = useMemo(() => {
    if (intelBusy) return false;
    if (isAnswerStep(currentStep)) {
      return canSubmitInputStep(currentStep, {
        ...draft,
        clarifyingAnswers: { ...answers, [currentStep]: answerDraft },
      });
    }
    return canSubmitInputStep(currentStep, draft);
  }, [answerDraft, answers, currentStep, draft, intelBusy]);

  const goNext = useCallback(() => {
    if (currentStep === "concept") {
      persist({
        ...draft,
        currentStep: "audience",
        clarifyingAnswers: {},
        clarifyingQuestions: createQuestionsForApi({ name: draft.name, concept: draft.concept, answers: {} }),
        understanding: null,
        assessment: null,
        referenceAppId: null,
        referenceAppName: null,
        referenceAppArtworkUrl: null,
        promptVersions: [],
        activePromptVersionId: null,
        synthesisCompetitors: [],
      });
      return;
    }

    if (isAnswerStep(currentStep)) {
      if (!canSubmitInputStep(currentStep, { ...draft, clarifyingAnswers: { ...answers, [currentStep]: answerDraft } }))
        return;
      const nextAnswers = { ...answers, [currentStep]: answerDraft.trim() };
      const nextStep = nextStepId(currentStep);
      if (!nextStep) return;

      if (nextStep === "synthesis") {
        persist({
          ...draft,
          clarifyingAnswers: nextAnswers,
          clarifyingQuestions: createQuestionsForApi({ name: draft.name, concept: draft.concept, answers: nextAnswers }),
          currentStep: "synthesis",
          understanding: null,
          assessment: null,
          referenceAppId: null,
          referenceAppName: null,
          referenceAppArtworkUrl: null,
          promptVersions: [],
          activePromptVersionId: null,
          synthesisCompetitors: [],
        });
        setSynthesisPhase("analyzing");
        return;
      }

      persist({
        ...draft,
        clarifyingAnswers: nextAnswers,
        clarifyingQuestions: createQuestionsForApi({ name: draft.name, concept: draft.concept, answers: nextAnswers }),
        currentStep: nextStep,
      });
      setAnswerDraft("");
      return;
    }

    const next = nextStepId(currentStep);
    if (!next) return;
    persist({ ...draft, currentStep: next });
  }, [answerDraft, answers, currentStep, draft, persist]);

  const goBack = useCallback(() => {
    const prev = prevStepId(currentStep);
    if (!prev) return;
    persist({ ...draft, currentStep: prev });
  }, [currentStep, draft, persist]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduceMotion) return;
    stage.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep, reduceMotion]);

  useEffect(() => {
    if (currentStep !== "synthesis" || synthesisPhase !== "reveal" || draft.setupComplete) return;
    persist({ ...draft, setupComplete: true });
  }, [currentStep, draft, persist, synthesisPhase]);

  if (!hydrated) return null;

  return (
    <div className="ta-applab-studio__frame">
      <div ref={stageRef} className="ta-applab-studio__stage">
        {showBackNav ? (
          <div className="ta-applab-studio__back-row">
            <StudioBackButton
              onBack={goBack}
              disabled={intelBusy || (currentStep === "synthesis" && synthesisPhase === "analyzing")}
            />
          </div>
        ) : null}

        <div className="ta-applab-studio__hero ta-applab-studio__hero--animated" id="landing-top">
          {currentStep !== "synthesis" ? (
            <TrackerHeroSocialProofBadge className="ta-applab-studio__social-proof" />
          ) : null}
          <TrackappApplabHeroHeading
            step={currentStep}
            appName={draft.name}
            hero={hero}
            synthesisPhase={currentStep === "synthesis" ? synthesisPhase : null}
            reduceMotion={reduceMotion}
            heroRotatorApps={heroRotatorApps}
          />
        </div>

        {showHomeHub ? (
          <TrackerSaleNotificationsExperience scrollRootRef={stageRef} hideHeroStack />
        ) : null}

        {currentStep === "name" ? (
          <TrackappApplabCreateStartButton busy={intelBusy} disabled={intelBusy} />
        ) : isInputStep ? (
          <TrackappApplabGlassComposer
            expanded={isGlassExpanded}
            area={isGlassArea}
            stacked={isPricingStep}
            hideSubmit={isPricingStep}
            fieldKey={currentStep}
            canContinue={canContinue}
            onContinue={goNext}
            continueLabel={continueLabel}
            busy={intelBusy}
            reduceMotion={reduceMotion}
          >
              {currentStep === "concept" ? (
                <textarea
                  id="applab-concept"
                  className="ta-applab-glass-panel__field ta-applab-glass-panel__field--area"
                  value={draft.concept}
                  onChange={(e) => updateDraft({ ...draft, concept: e.target.value })}
                  placeholder="Ex. App d'apprentissage de l'arabe pour francophones — leçons courtes, quiz, streaks."
                  maxLength={280}
                  rows={3}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canContinue) {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                />
              ) : null}

              {questionField ? (
                <TrackappApplabQuestionField
                  field={questionField}
                  draft={answerDraft}
                  onDraftChange={setAnswerDraft}
                  onSubmit={goNext}
                  canSubmit={canContinue}
                />
              ) : null}

              {isPricingStep ? (
                <TrackappApplabPricingField
                  value={answerDraft}
                  onChange={setAnswerDraft}
                  submitSlot={
                    <TrackappApplabComposerSubmit
                      disabled={!canContinue}
                      busy={intelBusy}
                      onClick={goNext}
                      label={continueLabel}
                    />
                  }
                />
              ) : null}
          </TrackappApplabGlassComposer>
        ) : (
          <TrackappApplabSynthesisStep
            draft={draft}
            onDraftChange={persist}
            onBusyChange={setIntelBusy}
            onPhaseChange={setSynthesisPhase}
            onSyncPromptVersion={(version) => void pushPromptVersion(version)}
          />
        )}

        <AnimatePresence initial={false}>
          {showHomeHub ? (
            <motion.div
              key="applab-below"
              className="ta-applab-studio__below"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={applabBelowMotion.exit}
              transition={belowExitTransition}
            >
              <HomeHub showcaseVideos={showcaseVideos} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
