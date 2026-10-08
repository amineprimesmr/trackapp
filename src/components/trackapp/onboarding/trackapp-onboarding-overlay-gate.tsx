"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useTrackappOnboardingUi } from "@/components/trackapp/onboarding/trackapp-onboarding-ui-context";
import { isTrackappLandingPath } from "@/lib/trackapp-landing-paths";
import { resolveOnboardingReturnHref } from "@/lib/trackapp-onboarding-overlay";
import {
  GUEST_ONBOARDING_PAGE_PROPS,
  type TrackappOnboardingPageProps,
} from "@/lib/trackapp-onboarding/types";

const TrackappOnboardingFlow = dynamic(
  () =>
    import("@/components/trackapp/onboarding/trackapp-onboarding-flow").then((m) => m.TrackappOnboardingFlow),
  { ssr: false },
);

let bootstrapCache: TrackappOnboardingPageProps | null = null;
let bootstrapInflight: Promise<TrackappOnboardingPageProps> | null = null;

function fetchOnboardingBootstrap(): Promise<TrackappOnboardingPageProps> {
  if (bootstrapInflight) return bootstrapInflight;

  bootstrapInflight = fetch("/api/trackapp/onboarding/bootstrap", {
    credentials: "include",
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("bootstrap_failed");
      return (await res.json()) as TrackappOnboardingPageProps;
    })
    .then((data) => {
      bootstrapCache = data;
      return data;
    })
    .finally(() => {
      bootstrapInflight = null;
    });

  return bootstrapInflight;
}

/** Réservé aux sessions connectées (évite un GET Supabase au survol « Commencer »). */
export function prefetchOnboardingBootstrap(): void {
  if (typeof window === "undefined") return;
  void fetchOnboardingBootstrap().catch(() => {});
}

export function TrackappOnboardingOverlayGate() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { isOpen, closeOnboarding } = useTrackappOnboardingUi();
  const returnHref = resolveOnboardingReturnHref(searchParams);
  const reduceMotion = useReducedMotion();

  /** Onboarding uniquement post-paiement — jamais en overlay sur la LP. */
  const overlayAllowed = !isTrackappLandingPath(pathname);
  const showOverlay = isOpen && overlayAllowed;

  const [props, setProps] = useState<TrackappOnboardingPageProps>(
    () => bootstrapCache ?? GUEST_ONBOARDING_PAGE_PROPS,
  );
  const [loadError, setLoadError] = useState(false);

  const dismiss = closeOnboarding;

  useEffect(() => {
    if (isOpen && !overlayAllowed) {
      dismiss();
    }
  }, [dismiss, isOpen, overlayAllowed]);

  useEffect(() => {
    if (!showOverlay) return;

    document.body.classList.add("trackapp-onboarding-open");
    return () => document.body.classList.remove("trackapp-onboarding-open");
  }, [showOverlay]);

  useEffect(() => {
    if (!showOverlay) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss, showOverlay]);

  useEffect(() => {
    if (!showOverlay) return;

    setProps(bootstrapCache ?? GUEST_ONBOARDING_PAGE_PROPS);
    setLoadError(false);

    let cancelled = false;
    void fetchOnboardingBootstrap()
      .then((data) => {
        if (cancelled) return;
        setProps(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [showOverlay]);

  const overlayMotion = reduceMotion ?
    { initial: false as const, animate: { opacity: 1 }, exit: undefined }
  : {
      initial: { opacity: 0, scale: 0.96, y: 14 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.98, y: 8 },
    };

  const scrimMotion = reduceMotion ?
    { initial: false as const, animate: { opacity: 1 } }
  : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  return (
    <AnimatePresence>
      {showOverlay ?
        <motion.div
          key="trackapp-onboarding-overlay"
          className="ta-onboarding-overlay-host"
          role="presentation"
          aria-hidden={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.button
            type="button"
            className="ta-onboarding-overlay-host__scrim"
            aria-label="Fermer l'onboarding"
            onClick={dismiss}
            {...scrimMotion}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            className="ta-onboarding-overlay-host__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Onboarding Trackapp"
            {...overlayMotion}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.85 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {loadError ?
              <div className="ta-onboarding-overlay-host__error">
                <p>Impossible de charger l&apos;onboarding.</p>
                <button
                  type="button"
                  className="ta-onboarding-overlay-host__retry"
                  onClick={() => {
                    bootstrapCache = null;
                    setLoadError(false);
                    setProps(GUEST_ONBOARDING_PAGE_PROPS);
                    void fetchOnboardingBootstrap().then(setProps).catch(() => setLoadError(true));
                  }}
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  className="ta-onboarding-overlay-host__retry ta-onboarding-overlay-host__retry--ghost"
                  onClick={dismiss}
                >
                  Fermer
                </button>
              </div>
            : <TrackappOnboardingFlow
                {...props}
                overlay
                returnHref={returnHref}
                onDismiss={dismiss}
              />
            }
          </motion.div>
        </motion.div>
      : null}
    </AnimatePresence>
  );
}
