"use client";

import { useEffect, useState, type RefObject } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { TrackerMobileSaleNotificationBanner } from "@/components/tracker/tracker-mobile-sale-notification-banner";
import { TrackerSaleNotificationsStack } from "@/components/tracker/tracker-sale-notifications-stack";
import { useElementInView } from "@/lib/use-element-in-view";
import { useTouchDevice } from "@/lib/use-touch-device";

type TrackerSaleNotificationsExperienceProps = {
  className?: string;
  /** Conteneur scroll interne (ex. `.ta-applab-studio__stage`) — complété par window scroll. */
  scrollRootRef?: RefObject<HTMLElement | null>;
  /** Pas de pile hero — bannière iOS au scroll uniquement (landing AppLAB mobile). */
  hideHeroStack?: boolean;
};

/** Seuil scroll (px) — bannière dès qu’on commence à descendre sur mobile. */
const SCROLL_BANNER_TRIGGER_PX = 40;

const MOBILE_VIEWPORT_MQ = "(max-width: 860px)";

function readScrollTop(scrollRoot?: HTMLElement | null): number {
  if (scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight + 1) {
    return scrollRoot.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/** Pile hero + bannière iOS flottante (mobile) quand on scrolle hors du hero. */
export function TrackerSaleNotificationsExperience({
  className,
  scrollRootRef,
  hideHeroStack = false,
}: TrackerSaleNotificationsExperienceProps) {
  const touch = useTouchDevice();
  const mobileViewport = useMediaQuery(MOBILE_VIEWPORT_MQ, { defaultMatches: true });
  const mobileBanner = touch || mobileViewport;

  const { ref: heroRef, inView: heroVisible } = useElementInView<HTMLElement>({
    threshold: 0.05,
    rootMargin: "0px 0px -4% 0px",
    rootRef: scrollRootRef,
  });
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (!mobileBanner) return;
      const top = readScrollTop(scrollRootRef?.current ?? null);
      setHasScrolled(top > SCROLL_BANNER_TRIGGER_PX);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const root = scrollRootRef?.current;
    root?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      root?.removeEventListener("scroll", onScroll);
    };
  }, [mobileBanner, scrollRootRef]);

  const offHero =
    mobileBanner && (hideHeroStack ? hasScrolled : hasScrolled || !heroVisible);

  return (
    <>
      {!hideHeroStack ? (
        <TrackerSaleNotificationsStack ref={heroRef} paused={offHero} className={className} />
      ) : null}
      <TrackerMobileSaleNotificationBanner active={offHero} allowMobileViewport={hideHeroStack} />
    </>
  );
}
