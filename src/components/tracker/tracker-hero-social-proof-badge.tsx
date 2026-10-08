"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  ClaudeIcon,
  CursorIcon,
  OpenAiIcon,
  PerplexityIcon,
} from "@/components/tracker/tracker-hero-social-proof-icons";
import { TrackerLiquidGlassFilterSvg } from "@/components/tracker/tracker-liquid-glass-filter-svg";
import { cn } from "@/lib/utils";

import "@/styles/tracker-hero-social-proof.css";

const ROTATE_MS = 5000;

/** Portraits réels pour le badge social proof. */
const DEFAULT_AVATAR_SRCS = [
  "/assets/social-proof/avatar-1.png",
  "/assets/social-proof/avatar-2.png",
  "/assets/social-proof/avatar-3.png",
  "/assets/social-proof/avatar-4.png",
] as const;

export type TrackerHeroSocialProofAvatar = {
  src?: string;
  alt?: string;
};

type Slide = Readonly<{
  id: string;
  ariaLabel: string;
  mobileAriaLabel: string;
  leading: ReactNode;
  text: ReactNode;
  mobileText: ReactNode;
}>;

function useMobileSocialProofText(breakpointPx = 860): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(`(max-width: ${breakpointPx}px)`).matches,
    () => false,
  );
}

type Props = Readonly<{
  avatars?: TrackerHeroSocialProofAvatar[];
  className?: string;
  /** Pilule claire (fonds blancs) — défaut : glass sombre comme la landing. */
  surface?: "dark" | "light";
}>;

function CreatorsAvatars({
  avatars,
}: Readonly<{ avatars?: TrackerHeroSocialProofAvatar[] }>) {
  const slots = Array.from({ length: 4 }, (_, i) => {
    const custom = avatars?.[i];
    return {
      src: custom?.src ?? DEFAULT_AVATAR_SRCS[i],
    };
  });

  return (
    <span className="tracker-hero-social-proof__avatars" aria-hidden>
      {slots.map((avatar) => (
        <span key={avatar.src} className="tracker-hero-social-proof__avatar">
          <Image src={avatar.src} alt="" fill className="object-cover" sizes="32px" />
        </span>
      ))}
    </span>
  );
}

function buildSlides(avatars?: TrackerHeroSocialProofAvatar[]): Slide[] {
  return [
    {
      id: "creators",
      ariaLabel: "Utilisé par plus de 1 384 créateurs d'app",
      mobileAriaLabel: "Plus de 1 384 créateurs d'app",
      leading: <CreatorsAvatars avatars={avatars} />,
      text: <>Utilisé par <strong>+1 384</strong> créateurs d&apos;app</>,
      mobileText: <><strong>+1 384</strong> créateurs d&apos;app</>,
    },
    {
      id: "claude",
      ariaLabel: "Modèle IA Claude Opus 4.8",
      mobileAriaLabel: "Claude Opus 4.8",
      leading: <ClaudeIcon />,
      text: <>Propulsé par <strong>Claude Opus 4.8</strong></>,
      mobileText: <><strong>Claude Opus 4.8</strong></>,
    },
    {
      id: "gpt",
      ariaLabel: "Modèle IA GPT Image 5.5",
      mobileAriaLabel: "GPT Image 5.5",
      leading: <OpenAiIcon />,
      text: <>Images via <strong>GPT Image 5.5</strong></>,
      mobileText: <><strong>GPT Image 5.5</strong></>,
    },
    {
      id: "cursor",
      ariaLabel: "Modèle IA Cursor Composer 2.5",
      mobileAriaLabel: "Cursor Composer 2.5",
      leading: <CursorIcon />,
      text: <>Code avec <strong>Cursor Composer 2.5</strong></>,
      mobileText: <><strong>Cursor 2.5</strong></>,
    },
    {
      id: "perplexity",
      ariaLabel: "Recherche avec Perplexity",
      mobileAriaLabel: "Recherche avec Perplexity",
      leading: <PerplexityIcon />,
      text: <>Recherche avec <strong>Perplexity</strong></>,
      mobileText: <>Recherche avec <strong>Perplexity</strong></>,
    },
  ];
}

export function TrackerHeroSocialProofBadge({ avatars, className, surface = "dark" }: Props) {
  const reduceMotion = useReducedMotion();
  const isMobile = useMobileSocialProofText();
  const slides = useMemo(() => buildSlides(avatars), [avatars]);
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [mountGlassFilter, setMountGlassFilter] = useState(false);

  useEffect(() => {
    setMountGlassFilter(!document.getElementById("tracker-liquid-glass-fr"));
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
      setAnimKey((k) => k + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, slides.length]);

  const slide = slides[index] ?? slides[0];
  const label = isMobile ? slide.mobileAriaLabel : slide.ariaLabel;
  const copy = isMobile ? slide.mobileText : slide.text;

  return (
    <>
      {mountGlassFilter ? <TrackerLiquidGlassFilterSvg /> : null}
      <p
      className={cn(
        "tracker-hero-social-proof",
        isMobile && "tracker-hero-social-proof--compact",
        surface === "light" && "tracker-hero-social-proof--light",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="tracker-hero-social-proof__stage" key={animKey}>
        <span className="tracker-hero-social-proof__leading">{slide.leading}</span>
        <span className="tracker-hero-social-proof__text">{copy}</span>
      </span>
    </p>
    </>
  );
}
