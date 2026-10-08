"use client";

import { motion } from "framer-motion";

import { HeroAppIconRotator, type HeroRotatorApp } from "@/components/tracker/hero-app-icon-rotator";
import { TrackerLandingHeroTitle } from "@/components/tracker/tracker-landing-hero-title";
import { heroTitleForStep } from "@/lib/trackapp-applab-create/create-questions";
import type { ApplabCreateStepId } from "@/lib/trackapp-applab-create/types";
import { applabFieldTransition } from "@/lib/trackapp-applab-create/step-motion";
import { cn } from "@/lib/utils";

type HeroCopy = Readonly<{
  title: string;
  sub: string;
}>;

export function TrackappApplabHeroHeading({
  step,
  appName,
  hero,
  synthesisPhase,
  reduceMotion,
  heroRotatorApps = [],
}: Readonly<{
  step: ApplabCreateStepId;
  appName: string;
  hero: HeroCopy;
  synthesisPhase?: "analyzing" | "reveal" | null;
  reduceMotion: boolean | null;
  heroRotatorApps?: readonly HeroRotatorApp[];
}>) {
  const fadeT = applabFieldTransition(reduceMotion, 0.18);
  const name = appName.trim() || "votre app";
  const isNameStep = step === "name";
  const isConcept = step === "concept";
  const hideSynthesisRevealTitle = step === "synthesis" && synthesisPhase === "reveal";
  const title =
    step === "synthesis" ?
      hideSynthesisRevealTitle ?
        null
      : `Analyse de ${name}`
    : step === "concept" ?
      null
    : isNameStep ?
      null
    : heroTitleForStep(step, name);

  const titleKey = step === "synthesis" ? `synthesis-${synthesisPhase ?? "run"}` : step;

  return (
    <div className="ta-applab-studio__hero-copy">
      {isNameStep ? (
        <motion.div key={titleKey} transition={fadeT} initial={reduceMotion ? false : { opacity: 0.72 }} animate={{ opacity: 1 }}>
          <TrackerLandingHeroTitle className="ta-applab-studio__hero-landing-title">
            Créez votre prochaine
            <br />
            <span className="ta-applab-studio__hero-landing-title-line2">
              <span>app</span>
              <HeroAppIconRotator apps={heroRotatorApps} className="ta-applab-studio__hero-landing-icon" />
              <span>maintenant</span>
            </span>
          </TrackerLandingHeroTitle>
        </motion.div>
      ) : hideSynthesisRevealTitle ? null : (
        <motion.h1
          key={titleKey}
          className={cn(
            "ta-applab-studio__hero-title",
            "ta-applab-studio__hero-title--concept",
          )}
          transition={fadeT}
          initial={reduceMotion ? false : { opacity: 0.72 }}
          animate={{ opacity: 1 }}
        >
          {isConcept ? (
            <>
              Qu&apos;est-ce que fait{" "}
              <span className="ta-applab-studio__hero-app-name">
                {name}
              </span>{" "}
              ?
            </>
          ) : (
            title
          )}
        </motion.h1>
      )}

      {step === "synthesis" && synthesisPhase === "analyzing" ? (
        <motion.p className="ta-applab-studio__hero-sub" transition={fadeT}>
          Concurrents, synthèse produit et prompt Xcode — tout est généré automatiquement.
        </motion.p>
      ) : hero.sub ? (
        <motion.p className="ta-applab-studio__hero-sub" transition={fadeT}>
          {hero.sub}
        </motion.p>
      ) : null}
    </div>
  );
}
