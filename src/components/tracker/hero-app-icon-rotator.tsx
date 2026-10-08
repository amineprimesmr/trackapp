"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { ShowcaseAppIcon } from "@/components/tracker/showcase-app-icon";
import { useTouchDevice } from "@/lib/use-touch-device";
import { cn } from "@/lib/utils";

import "@/styles/hero-app-icon-rotator.css";

export type HeroRotatorApp = {
  id: string;
  name: string;
  artworkUrl?: string;
  iconSrc?: string;
};

const INTERVAL_MS = 3000;
const CROSSFADE_MS = 380;

type CrossfadePhase = "idle" | "entering" | "animating";

function HeroIconFrame({
  app,
  priority = false,
}: {
  app: HeroRotatorApp;
  priority?: boolean;
}) {
  return (
    <ShowcaseAppIcon
      artworkUrl={app.artworkUrl}
      iconSrc={app.iconSrc}
      name={app.name}
      priority={priority}
    />
  );
}

export function HeroAppIconRotator({
  apps,
  className,
}: {
  apps: readonly HeroRotatorApp[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const touch = useTouchDevice();
  const pool = apps.length > 0 ? apps : [{ id: "placeholder", name: "App", artworkUrl: undefined }];
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<CrossfadePhase>("idle");
  const crossfadeTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const use3D = !reduceMotion && !touch;

  const advance = useCallback(() => {
    if (pool.length < 2 || reduceMotion) return;

    setIndex((current) => {
      const next = (current + 1) % pool.length;
      setPrevIndex(current);
      setPhase("entering");

      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = window.requestAnimationFrame(() => setPhase("animating"));
      });

      if (crossfadeTimerRef.current != null) window.clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = window.setTimeout(() => {
        setPrevIndex(null);
        setPhase("idle");
      }, CROSSFADE_MS);

      return next;
    });
  }, [pool.length, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || pool.length < 2) return;
    const id = window.setInterval(advance, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [advance, pool.length, reduceMotion]);

  useEffect(
    () => () => {
      if (crossfadeTimerRef.current != null) window.clearTimeout(crossfadeTimerRef.current);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const current = pool[index];
  const previous = prevIndex != null ? pool[prevIndex] : null;
  const isCrossfading = phase !== "idle";

  const shellClass =
    "relative flex h-full w-full items-center justify-center overflow-hidden rounded-[22%] bg-neutral-950 shadow-[0_4px_18px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.14)]";

  return (
    <span
      className={cn(
        "hero-app-icon-rotator relative ml-1 mr-[0.55rem] inline-flex align-middle sm:mr-2.5 md:mr-3 [--hero-icon:2.35rem] sm:[--hero-icon:2.65rem] md:[--hero-icon:2.9rem]",
        className,
      )}
      style={use3D ? { perspective: "960px" } : undefined}
      aria-hidden
    >
      <span
        className="hero-app-icon-stage relative inline-flex h-[var(--hero-icon)] w-[var(--hero-icon)] items-center justify-center"
        style={use3D ? { transformStyle: "preserve-3d" } : undefined}
      >
        {previous ? (
          <span
            className={cn(
              "hero-app-icon-layer absolute inset-0 z-[1]",
              use3D && "hero-app-icon-layer--3d",
              "hero-app-icon-layer--in",
              phase === "animating" && "hero-app-icon-layer--out",
            )}
          >
            <span className={shellClass}>
              <HeroIconFrame app={previous} />
            </span>
          </span>
        ) : null}
        <span
          className={cn(
            "hero-app-icon-layer absolute inset-0 z-[2]",
            use3D && "hero-app-icon-layer--3d",
            isCrossfading && "hero-app-icon-layer--in-from",
            !isCrossfading || phase === "animating" ? "hero-app-icon-layer--in" : null,
          )}
        >
          <span className={shellClass}>
            <HeroIconFrame app={current} priority />
          </span>
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[3] rounded-[22%] bg-gradient-to-br from-white/12 via-transparent to-transparent opacity-30"
        />
      </span>
    </span>
  );
}
