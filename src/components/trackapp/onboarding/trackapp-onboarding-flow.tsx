"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  TrackappOnboardingBrand,
  TrackappOnboardingContinue,
  TrackappOnboardingShell,
} from "@/components/trackapp/onboarding/trackapp-onboarding-shell";
import {
  ONBOARDING_GRID_STEP_IDS,
  TrackappOnboardingGridOptions,
} from "@/components/trackapp/onboarding/trackapp-onboarding-grid-options";
import {
  buildSummaryRows,
  computeCreatorLevel,
  creatorLevelLabel,
  tipsForLevel,
} from "@/lib/trackapp-onboarding/compute-summary";
import { ONBOARDING_VERSION } from "@/lib/trackapp-onboarding/keys";
import {
  markOnboardingLocallyComplete,
  readOnboardingDraft,
  writeOnboardingDraft,
} from "@/lib/trackapp-onboarding/local-draft";
import {
  clampStepIndex,
  getProjectModeFromAnswers,
  resolveActiveOnboardingSteps,
} from "@/lib/trackapp-onboarding/resolve-steps";
import { TRACKAPP_ONBOARDING_STEPS, onboardingAnswerKey } from "@/lib/trackapp-onboarding/steps";
import type {
  OnboardingLikertValue,
  OnboardingStep,
  TrackappOnboardingAnswers,
  TrackappUserOnboardingPayload,
} from "@/lib/trackapp-onboarding/types";
import { trackappConnexionNextHref } from "@/lib/trackapp-landing-paths";
import { resolvePostPaymentWorkspaceHref, claimPostPaymentAccess } from "@/lib/trackapp/post-payment-flow";
import { trackappWhopCheckoutUrl } from "@/lib/trackapp/whop-checkout";
import { cn } from "@/lib/utils";

const LIKERT_ICONS: readonly string[] = ["👎👎", "👎", "😐", "👍", "👍👍"];

const SECTION_PROMO: Record<string, { title: string; subtitle: string; gradient: string }> = {
  "Votre parcours": {
    title: "Projet ou exploration ?",
    subtitle: "Une idée d'app à builder, ou nous vous aidons à trouver la bonne opportunité.",
    gradient: "lime",
  },
  "Profil créateur": {
    title: "Créez votre profil créateur Trackapp",
    subtitle: "Nous adaptons Trackapp à votre niveau, votre expérience et vos blocages.",
    gradient: "lime",
  },
  Objectifs: {
    title: "Vos objectifs",
    subtitle: "Chaque réponse affine votre parcours et vos recommandations.",
    gradient: "gold",
  },
  Communauté: {
    title: "Rejoignez la communauté",
    subtitle: "Des créateurs qui passent de l'idée à l'app monétisée.",
    gradient: "violet",
  },
  "Objectifs créateur": {
    title: "Ambition créateur",
    subtitle: "Fixez le cap — Trackapp vous aide à scaler sans vous perdre dans le build.",
    gradient: "purple",
  },
  Monétisation: {
    title: "Monétisez votre app",
    subtitle: "Abonnement, achat unique ou hybride — choisissez votre modèle.",
    gradient: "gold",
  },
  Motivation: {
    title: "Votre motivation",
    subtitle: "Comprendre votre pourquoi pour mieux vous accompagner au bon moment.",
    gradient: "lime",
  },
  AppLAB: {
    title: "AppLAB — votre copilote produit",
    subtitle: "Analyse 12 piliers et exportez directement vers votre IDE.",
    gradient: "violet",
  },
  "Votre projet": {
    title: "Votre premier projet",
    subtitle: "Donnez un nom à votre app — votre espace AppLAB et la formation s'adaptent.",
    gradient: "lime",
  },
  Récapitulatif: {
    title: "Votre récap créateur",
    subtitle: "Voici votre niveau, vos conseils et le résumé de vos choix.",
    gradient: "violet",
  },
};

function promoForStep(step: OnboardingStep) {
  if (step.kind === "interstitial") {
    const sectionPromo = SECTION_PROMO[step.section];
    return {
      promoTitle: sectionPromo?.title ?? step.title,
      promoSubtitle: step.subtitle ?? sectionPromo?.subtitle,
      promoBadge: step.badge ?? step.section,
      promoGradient: step.gradient ?? sectionPromo?.gradient ?? "purple",
    };
  }

  if (step.kind === "summary") {
    const sectionPromo = SECTION_PROMO.Récapitulatif;
    return {
      promoTitle: sectionPromo.title,
      promoSubtitle: sectionPromo.subtitle,
      promoBadge: step.section,
      promoGradient: sectionPromo.gradient,
    };
  }

  const sectionPromo = SECTION_PROMO[step.section] ?? {
    title: step.title,
    subtitle: step.subtitle ?? "Quelques réponses pour personnaliser votre parcours Trackapp.",
    gradient: "lime",
  };

  return {
    promoTitle: sectionPromo.title,
    promoSubtitle: sectionPromo.subtitle,
    promoBadge: undefined,
    promoGradient: sectionPromo.gradient,
  };
}

type Props = Readonly<{
  initialPayload: TrackappUserOnboardingPayload | null;
  initialCompleted: boolean;
  loggedIn?: boolean;
  alreadyPremium?: boolean;
  postPayment?: boolean;
  overlay?: boolean;
  returnHref?: string;
  onDismiss?: () => void;
}>;

function defaultPayload(): TrackappUserOnboardingPayload {
  return { version: ONBOARDING_VERSION, currentStepIndex: 0, answers: {} };
}

async function persistRemote(payload: TrackappUserOnboardingPayload, complete = false) {
  const res = await fetch("/api/trackapp/profile/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, complete }),
  });
  if (res.status === 401) return;
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Sauvegarde impossible");
  }
}

function applyAnswerToPayload(
  prev: TrackappUserOnboardingPayload,
  key: keyof TrackappOnboardingAnswers,
  value: string | string[] | number,
): TrackappUserOnboardingPayload {
  if (key === "project_status" && typeof value === "string") {
    if (value === "no_project") {
      const { project_name: _pn, project_stage: _ps, ...rest } = prev.answers;
      return {
        ...prev,
        answers: { ...rest, project_status: "no_project" },
        project: undefined,
        projectMode: "discover",
      };
    }
    if (value === "has_project") {
      const { discovery_focus: _df, ...rest } = prev.answers;
      return {
        ...prev,
        answers: { ...rest, project_status: "has_project" },
        projectMode: "defined",
      };
    }
  }

  return {
    ...prev,
    answers: { ...prev.answers, [key]: value },
  };
}

function stepUsesAutoAdvance(step: OnboardingStep): boolean {
  return step.kind === "single" || step.kind === "likert" || step.kind === "chips";
}

function InterstitialStep({ step }: Readonly<{ step: OnboardingStep }>) {
  return (
    <div className="ta-onboarding__interstitial">
      <TrackappOnboardingBrand />
      {step.badge ? <div className="ta-onboarding__badge">✓ {step.badge}</div> : null}
      <h1 className="ta-onboarding__title ta-onboarding__title--hero">{step.title}</h1>
      {step.subtitle ? (
        <p className="ta-onboarding__subtitle ta-onboarding__subtitle--center">{step.subtitle}</p>
      ) : null}
      <div className={cn("ta-onboarding__hero", step.id !== "social_proof" && "ta-onboarding__hero--wide")}>
        <div
          className={cn(
            "ta-onboarding__hero-gradient",
            step.gradient === "purple" && "ta-onboarding__hero-gradient--purple",
            step.gradient === "lime" && "ta-onboarding__hero-gradient--lime",
            step.gradient === "gold" && "ta-onboarding__hero-gradient--gold",
            step.gradient === "violet" && "ta-onboarding__hero-gradient--violet",
            !step.gradient && "ta-onboarding__hero-gradient--purple",
          )}
        />
      </div>
      <p className="ta-onboarding__interstitial-hint">Appuie sur Continuer pour passer à l&apos;étape suivante.</p>
    </div>
  );
}

export function TrackappOnboardingFlow({
  initialPayload,
  initialCompleted,
  loggedIn = false,
  alreadyPremium = false,
  postPayment = false,
  overlay = false,
  returnHref = "/trackapp",
  onDismiss,
}: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const motionReduced = reduce;
  const persistLocalDraft = !overlay;
  const [hydrated, setHydrated] = useState(() => overlay || Boolean(initialPayload || initialCompleted));
  const [payload, setPayload] = useState<TrackappUserOnboardingPayload>(initialPayload ?? defaultPayload());
  const [stepIndex, setStepIndex] = useState(initialPayload?.currentStepIndex ?? 0);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState(initialPayload?.project?.name ?? "");
  const goNextRef = useRef<(source?: TrackappUserOnboardingPayload) => Promise<void>>(async () => {});

  const answers = payload.answers;
  const projectMode = getProjectModeFromAnswers(answers) ?? payload.projectMode ?? null;

  const activeSteps = useMemo(() => resolveActiveOnboardingSteps(answers), [answers]);
  const totalSteps = activeSteps.length;
  const step = activeSteps[stepIndex] ?? activeSteps[0] ?? TRACKAPP_ONBOARDING_STEPS[0];

  useEffect(() => {
    setStepIndex((i) => clampStepIndex(answers, i));
  }, [answers.project_status]);

  useEffect(() => {
    if (!overlay && !initialPayload && !initialCompleted) {
      const draft = readOnboardingDraft();
      if (draft) {
        setPayload(draft);
        setStepIndex(Math.min(draft.currentStepIndex, resolveActiveOnboardingSteps(draft.answers).length - 1));
        setProjectName(draft.project?.name ?? draft.answers.project_name ?? "");
      }
    }
    setHydrated(true);
  }, [initialCompleted, initialPayload, overlay]);

  useEffect(() => {
    if (!initialPayload) return;
    setPayload(initialPayload);
    setStepIndex(
      Math.min(
        initialPayload.currentStepIndex ?? 0,
        Math.max(0, resolveActiveOnboardingSteps(initialPayload.answers).length - 1),
      ),
    );
    setProjectName(initialPayload.project?.name ?? initialPayload.answers.project_name ?? "");
  }, [initialPayload]);

  useEffect(() => {
    if (initialCompleted) {
      if (overlay && onDismiss) {
        onDismiss();
        return;
      }
      router.replace(alreadyPremium ? returnHref : trackappWhopCheckoutUrl());
    }
  }, [initialCompleted, alreadyPremium, onDismiss, overlay, returnHref, router]);

  const save = useCallback(
    async (next: TrackappUserOnboardingPayload, complete = false) => {
      if (persistLocalDraft) writeOnboardingDraft(next);
      setPayload(next);
      if (!loggedIn) return;
      setBusy(true);
      try {
        await persistRemote(next, complete);
      } finally {
        setBusy(false);
      }
    },
    [loggedIn, persistLocalDraft],
  );

  const setAnswer = useCallback((key: keyof TrackappOnboardingAnswers, value: string | string[] | number) => {
    if (key === "project_status" && value === "no_project") {
      setProjectName("");
    }
    setPayload((prev) => applyAnswerToPayload(prev, key, value));
  }, []);

  const canContinue = useMemo(() => {
    if (step.kind === "interstitial" || step.kind === "summary") return true;
    if (step.kind === "project") return projectName.trim().length >= 2;
    const key = onboardingAnswerKey(step.id);
    if (key === "project_name") return projectName.trim().length >= 2;
    const val = answers[key as keyof TrackappOnboardingAnswers];
    if (step.kind === "multi") return Array.isArray(val) && val.length > 0;
    if (step.kind === "likert") return typeof val === "number";
    return typeof val === "string" && val.length > 0;
  }, [answers, projectName, step]);

  const goNext = useCallback(async (sourcePayload?: TrackappUserOnboardingPayload) => {
    const p = sourcePayload ?? payload;
    const mode = getProjectModeFromAnswers(p.answers) ?? p.projectMode ?? null;
    const nextIndex = stepIndex + 1;
    const branchPatch =
      step.kind === "project" ?
        {
          projectMode: "defined" as const,
          project: {
            name: projectName.trim(),
            goal: p.answers.monetization_model,
            stage: p.answers.project_stage,
          },
          answers: { ...p.answers, project_name: projectName.trim() },
        }
      : step.id === "project_status" && p.answers.project_status === "no_project" ?
        { projectMode: "discover" as const, project: undefined }
      : step.id === "project_status" && p.answers.project_status === "has_project" ?
        { projectMode: "defined" as const }
      : {};

    const nextPayload: TrackappUserOnboardingPayload = {
      ...p,
      currentStepIndex: nextIndex,
      ...branchPatch,
    };

    if (step.kind === "summary") {
      const resolvedMode = mode ?? "discover";
      const finalPayload: TrackappUserOnboardingPayload = {
        ...nextPayload,
        currentStepIndex: totalSteps - 1,
        projectMode: resolvedMode,
        project:
          resolvedMode === "defined" && (nextPayload.project?.name?.trim() || projectName.trim()) ?
            {
              name: (nextPayload.project?.name ?? projectName).trim(),
              goal: p.answers.monetization_model,
              stage: p.answers.project_stage,
            }
          : undefined,
      };
      setBusy(true);
      try {
        if (persistLocalDraft) {
          writeOnboardingDraft(finalPayload);
          markOnboardingLocallyComplete();
        }
        if (loggedIn) await persistRemote(finalPayload, true);
        const premiumDest = resolvePostPaymentWorkspaceHref(resolvedMode, returnHref);
        if (overlay && onDismiss) onDismiss();
        if (alreadyPremium) {
          if (loggedIn) {
            if (postPayment) await claimPostPaymentAccess();
            router.push(premiumDest);
          } else {
            router.push(trackappConnexionNextHref(premiumDest));
          }
        } else {
          window.location.href = trackappWhopCheckoutUrl();
        }
      } catch {
        setBusy(false);
      }
      return;
    }

    if (persistLocalDraft) writeOnboardingDraft(nextPayload);
    if (loggedIn) await save(nextPayload);
    else setPayload(nextPayload);
    setStepIndex(nextIndex);
  }, [
    payload,
    projectName,
    router,
    save,
    step.id,
    step.kind,
    stepIndex,
    loggedIn,
    persistLocalDraft,
    alreadyPremium,
    postPayment,
    totalSteps,
    overlay,
    onDismiss,
    returnHref,
  ]);

  goNextRef.current = goNext;

  const answerAndAdvance = useCallback((key: keyof TrackappOnboardingAnswers, value: string | number) => {
    if (busy) return;
    setBusy(true);
    if (key === "project_status" && value === "no_project") {
      setProjectName("");
    }
    setPayload((prev) => {
      const next = applyAnswerToPayload(prev, key, value);
      window.setTimeout(() => {
        void goNextRef.current(next).finally(() => setBusy(false));
      }, 280);
      return next;
    });
  }, [busy]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) {
      if (overlay && onDismiss) onDismiss();
      return;
    }
    setStepIndex((i) => i - 1);
  }, [onDismiss, overlay, stepIndex]);

  const renderQuestion = () => {
    if (step.kind === "interstitial") {
      return <InterstitialStep step={step} />;
    }

    if (step.kind === "summary") {
      const level = computeCreatorLevel(answers);
      const rows = buildSummaryRows(answers);
      const tips = tipsForLevel(level, projectMode);
      const youIndex = level === "beginner" ? 0 : level === "mid" ? 1 : level === "upper" ? 2 : 3;
      const modeLabel =
        projectMode === "defined" ?
          projectName.trim() ?
            `Projet « ${projectName.trim()} »`
          : "Projet en cours de définition"
        : projectMode === "discover" ?
          "Mode exploration — Trackapp vous aide à trouver la bonne app"
        : "";

      return (
        <div className="ta-onboarding__summary">
          <TrackappOnboardingBrand />
          <h1 className="ta-onboarding__title ta-onboarding__title--hero">{step.title}</h1>
          <div className="ta-onboarding__level-bar">
            <span
              className="ta-onboarding__level-pill ta-onboarding__level-pill--you"
              style={{ left: `${12.5 + youIndex * 25}%` }}
            >
              Vous
            </span>
            <span className="ta-onboarding__level-pill ta-onboarding__level-pill--goal" style={{ left: "87.5%" }}>
              Avec Trackapp
            </span>
            {(["Beginner", "Mid", "Upper", "Top"] as const).map((label, i) => (
              <div key={label} className={cn("ta-onboarding__level-seg", i === youIndex && "is-you")}>
                {label}
                {i === 3 ? " 👑" : ""}
              </div>
            ))}
          </div>
          <p className="ta-onboarding__subtitle">
            Niveau actuel : <strong>{creatorLevelLabel(level)}</strong>
            {modeLabel ? ` — ${modeLabel}` : ""}
          </p>
          <div className="ta-onboarding__summary-grid">
            <div className="ta-onboarding__tips">
              <p className="ta-onboarding__tips-head">✓ Conseils pour atteindre votre objectif</p>
              <ul className="ta-onboarding__tips-list">
                {tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="ta-onboarding__summary-rows">
              {rows.map((row) => (
                <div key={row.label} className="ta-onboarding__summary-row">
                  <span className="ta-onboarding__summary-icon">{row.icon}</span>
                  <div className="ta-onboarding__summary-meta">
                    <span className="ta-onboarding__summary-label">{row.label}</span>
                    <span className="ta-onboarding__summary-value">{row.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step.kind === "project") {
      return (
        <>
          <h1 className="ta-onboarding__title ta-onboarding__title--hero">{step.title}</h1>
          {step.subtitle ? <p className="ta-onboarding__subtitle ta-onboarding__subtitle--center">{step.subtitle}</p> : null}
          <input
            className="ta-onboarding__input"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Ex. FitMind Pro, Budget AI…"
            maxLength={80}
            autoFocus
          />
        </>
      );
    }

    if (step.kind === "likert") {
      const key = onboardingAnswerKey(step.id) as keyof TrackappOnboardingAnswers;
      const current = answers[key] as number | undefined;
      return (
        <>
          <h1 className="ta-onboarding__title ta-onboarding__title--hero">{step.statement}</h1>
          <div
            className={cn(
              "ta-onboarding__likert-card",
              step.likertGradient === "blue" ?
                "ta-onboarding__likert-card--blue"
              : "ta-onboarding__likert-card--green",
            )}
          >
            <div className="ta-onboarding__likert-row">
              {([1, 2, 3, 4, 5] as OnboardingLikertValue[]).map((v, i) => (
                <button
                  key={v}
                  type="button"
                  className={cn("ta-onboarding__likert-btn", current === v && "is-selected")}
                  aria-label={`Note ${v}`}
                  disabled={busy}
                  onClick={() => answerAndAdvance(key, v)}
                >
                  {LIKERT_ICONS[i]}
                </button>
              ))}
            </div>
            <div className="ta-onboarding__likert-labels">
              <span>Pas du tout d&apos;accord</span>
              <span>Tout à fait d&apos;accord</span>
            </div>
          </div>
        </>
      );
    }

    if (step.kind === "chips") {
      const key = onboardingAnswerKey(step.id) as keyof TrackappOnboardingAnswers;
      const current = answers[key] as string | undefined;
      return (
        <>
          <h1 className="ta-onboarding__title ta-onboarding__title--hero">{step.title}</h1>
          {step.subtitle ? <p className="ta-onboarding__subtitle ta-onboarding__subtitle--center">{step.subtitle}</p> : null}
          <div className="ta-onboarding__chips">
            {step.options?.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cn("ta-onboarding__chip", current === opt.id && "is-selected")}
                disabled={busy}
                onClick={() => answerAndAdvance(key, opt.id)}
              >
                {opt.icon ? <span aria-hidden>{opt.icon}</span> : null}
                {opt.label}
              </button>
            ))}
          </div>
        </>
      );
    }

    const key = onboardingAnswerKey(step.id) as keyof TrackappOnboardingAnswers;
    const multi = step.kind === "multi";
    const selectedMulti = (answers[key] as string[] | undefined) ?? [];
    const useGrid = step.kind === "single" && ONBOARDING_GRID_STEP_IDS.has(step.id);

    return (
      <>
        <h1 className="ta-onboarding__title ta-onboarding__title--hero">{step.title}</h1>
        {step.subtitle && !useGrid ? (
          <p className="ta-onboarding__subtitle ta-onboarding__subtitle--center">{step.subtitle}</p>
        ) : null}
        {useGrid ? (
          <TrackappOnboardingGridOptions
            options={step.options ?? []}
            selectedId={answers[key] as string | undefined}
            disabled={busy}
            onSelect={(id) => answerAndAdvance(key, id)}
          />
        ) : (
          <div className="ta-onboarding__list ta-onboarding__list--options">
            {step.options?.map((opt) => {
              const isSelected =
                multi ? selectedMulti.includes(opt.id) : (answers[key] as string | undefined) === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={cn("ta-onboarding__option", isSelected && "is-selected")}
                  disabled={busy}
                  onClick={() => {
                    if (multi) {
                      const next = isSelected ?
                        selectedMulti.filter((id) => id !== opt.id)
                      : [...selectedMulti, opt.id];
                      setAnswer(key, next);
                    } else {
                      answerAndAdvance(key, opt.id);
                    }
                  }}
                >
                  <span className="ta-onboarding__option-text">
                    <span className="ta-onboarding__option-label">{opt.label}</span>
                    {opt.description ? <span className="ta-onboarding__option-desc">{opt.description}</span> : null}
                  </span>
                  <span className={multi ? "ta-onboarding__checkbox" : "ta-onboarding__radio"} aria-hidden>
                    {multi && isSelected ? "✓" : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const promo = useMemo(() => promoForStep(step), [step]);

  return (
    <TrackappOnboardingShell
      section={step.section}
      headline={
        step.kind === "interstitial" || step.kind === "summary" ? step.section : (promo.promoTitle ?? step.section)
      }
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      canGoBack={stepIndex > 0}
      onBack={goBack}
      onDismiss={onDismiss}
      overlay={overlay}
      promoTitle={promo.promoTitle}
      promoSubtitle={promo.promoSubtitle}
      promoBadge={promo.promoBadge}
      promoGradient={promo.promoGradient}
      footer={
        stepUsesAutoAdvance(step) ? null : (
          <TrackappOnboardingContinue
            disabled={!canContinue || busy}
            label={
              step.kind === "summary" ?
                alreadyPremium ?
                  loggedIn ?
                    "Accéder à mon espace"
                  : "Se connecter et accéder"
                : "Voir l'offre Trackapp"
              : "Continuer"
            }
            onClick={() => void goNext()}
          />
        )
      }
    >
      {!hydrated ? null : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            className="ta-onboarding__step-motion ta-onboarding__step-motion--swap"
            initial={motionReduced ? false : { opacity: 0, y: overlay ? 10 : 0, x: overlay ? 0 : 16 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={motionReduced ? undefined : { opacity: 0, y: overlay ? -6 : 0, x: overlay ? 0 : -16 }}
            transition={{ duration: overlay ? 0.24 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderQuestion()}
          </motion.div>
        </AnimatePresence>
      )}
    </TrackappOnboardingShell>
  );
}
