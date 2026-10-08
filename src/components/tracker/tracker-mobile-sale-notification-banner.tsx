"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SaleNotificationCard } from "@/components/tracker/sale-notification-card";
import {
  playSaleNotificationFeedback,
  unlockSaleNotificationFeedback,
} from "@/lib/sale-notification-feedback";
import { nextSaleDemo, type SaleDemo } from "@/lib/tracker-sale-demo-data";
import {
  nextBannerDisplayMs,
  nextIrregularSaleDelayMs,
} from "@/lib/sale-notification-schedule";
import { useTouchDevice } from "@/lib/use-touch-device";
import { useMediaQuery } from "@/hooks/use-media-query";

import "@/styles/tracker-sale-notifications.css";

const PAYMENT_HREF = "/trackapp/paiement";
const MOBILE_VIEWPORT_MQ = "(max-width: 860px)";

type BannerPhase = "enter" | "shown" | "exit";

type ActiveBanner = {
  sale: SaleDemo;
  phase: BannerPhase;
};

type TrackerMobileSaleNotificationBannerProps = {
  /** Active quand la pile hero n’est plus visible à l’écran. */
  active: boolean;
  /** Landing AppLAB : autoriser aussi viewport ≤860px (DevTools / scroll document). */
  allowMobileViewport?: boolean;
};

export function TrackerMobileSaleNotificationBanner({
  active,
  allowMobileViewport = false,
}: TrackerMobileSaleNotificationBannerProps) {
  const touch = useTouchDevice();
  const mobileViewport = useMediaQuery(MOBILE_VIEWPORT_MQ, {
    defaultMatches: allowMobileViewport,
  });
  const canShow = touch || (allowMobileViewport && mobileViewport);
  const [mounted, setMounted] = useState(false);
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const [glassLive, setGlassLive] = useState(false);
  const saleIndexRef = useRef(100);
  const activeRef = useRef(active);
  const bannerRef = useRef(banner);
  const touchRef = useRef(touch);
  const lifecycleRef = useRef(0);
  activeRef.current = active;
  bannerRef.current = banner;
  touchRef.current = canShow;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!banner) {
      setGlassLive(false);
      return;
    }
    setGlassLive(true);
    const id = window.requestAnimationFrame(() => {
      setGlassLive(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [banner?.sale.id, banner?.phase]);

  useEffect(() => {
    const unlock = () => unlockSaleNotificationFeedback();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    lifecycleRef.current += 1;
    setBanner((current) => (current ? { ...current, phase: "exit" } : null));
    window.setTimeout(() => setBanner(null), 320);
  }, []);

  const showBanner = useCallback(() => {
    if (bannerRef.current || !activeRef.current) return;

    const lifecycle = lifecycleRef.current;
    const i = saleIndexRef.current;
    saleIndexRef.current = i + 1;
    const sale = nextSaleDemo(i, "banner");

    setBanner({ sale, phase: "enter" });
    playSaleNotificationFeedback({ touch: touchRef.current });

    window.setTimeout(() => {
      if (lifecycleRef.current !== lifecycle) return;
      setBanner((current) =>
        current?.sale.id === sale.id ? { ...current, phase: "shown" } : current,
      );
    }, 480);

    window.setTimeout(() => {
      if (lifecycleRef.current !== lifecycle) return;
      setBanner((current) => {
        if (current?.sale.id !== sale.id) return current;
        return { ...current, phase: "exit" };
      });
      window.setTimeout(() => {
        if (lifecycleRef.current !== lifecycle) return;
        setBanner((current) => (current?.sale.id === sale.id ? null : current));
      }, 320);
    }, 480 + nextBannerDisplayMs());
  }, []);

  useEffect(() => {
    if (!canShow || !active) {
      lifecycleRef.current += 1;
      setBanner(null);
      return;
    }

    let timeoutId = 0;
    let cancelled = false;

    requestAnimationFrame(() => {
      if (!cancelled && activeRef.current) showBanner();
    });

    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        if (cancelled || !activeRef.current || document.visibilityState === "hidden") {
          scheduleNext();
          return;
        }
        showBanner();
        scheduleNext();
      }, nextIrregularSaleDelayMs("banner"));
    };

    timeoutId = window.setTimeout(scheduleNext, nextBannerDisplayMs() + 700);

    return () => {
      cancelled = true;
      lifecycleRef.current += 1;
      window.clearTimeout(timeoutId);
      setBanner(null);
    };
  }, [active, canShow, showBanner]);

  if (!mounted || !canShow || !banner) return null;

  const bannerNode = (
    <div
      className={[
        "tracker-sale-notif-banner-slot",
        banner.phase === "enter" && "tracker-sale-notif-banner-slot--enter",
        banner.phase === "exit" && "tracker-sale-notif-banner-slot--exit",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      aria-atomic="true"
    >
      <Link
        href={PAYMENT_HREF}
        prefetch={false}
        className="tracker-sale-notif-banner-hit"
        aria-label={`${banner.sale.brand} — ${banner.sale.line}. Ouvrir les offres Trackapp.`}
        onClick={dismissBanner}
      >
        <div
          className={[
            "tracker-sale-notif-banner-glass",
            glassLive && "tracker-sale-notif-banner-glass--live",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <SaleNotificationCard
            sale={banner.sale}
            depth={0}
            className="tracker-sale-notif-shell--banner"
          />
        </div>
      </Link>
    </div>
  );

  return createPortal(bannerNode, document.body);
}
