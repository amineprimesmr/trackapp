"use client";

import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { ShowcaseLastUpdatedSubline } from "@/components/tracker/showcase-hero-header";
import { TrackerLandingHeroTitle } from "@/components/tracker/tracker-landing-hero-title";
import { ShowcaseAppIcon } from "@/components/tracker/showcase-app-icon";
import { TrackappLogoMark } from "@/components/trackapp/trackapp-logo-mark";
import { trackappAccueilAppHref } from "@/lib/trackapp-apptracker-paths";
import { TRACKAPP_OFFERS_PATH } from "@/lib/trackapp-landing-paths";
import type { AppShowcaseVideoItemEnriched } from "@/lib/showcase-app-videos-types";
import { cn } from "@/lib/utils";

import "@/styles/build-next-showcase.css";

const VISIBLE_SHOWCASE_COUNT = 3;

const SHOWCASE_STATS = [
  { label: "apps créées", value: "+350" },
  { label: "CA généré par les apps", value: "+170k" },
] as const;

function splitMonthlyRevenueLabel(label: string): { amount: string; period: string | null } {
  const trimmed = label.trim();
  const slashIdx = trimmed.indexOf(" / ");
  if (slashIdx === -1) return { amount: trimmed, period: null };
  return {
    amount: trimmed.slice(0, slashIdx).trim(),
    period: trimmed.slice(slashIdx).trim(),
  };
}

function FormatVideoCard({
  item,
  locked,
  reduceMotion,
}: Readonly<{
  item: AppShowcaseVideoItemEnriched;
  locked: boolean;
  reduceMotion: boolean | null;
}>) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const href = locked ? TRACKAPP_OFFERS_PATH : trackappAccueilAppHref(item.appStoreId, "fr");
  const posterSrc = item.posterSrc || item.iconSrc || null;
  const revenueParts = item.monthlyRevenueLabel
    ? splitMonthlyRevenueLabel(item.monthlyRevenueLabel)
    : null;

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video || !item.src) return;

    let shouldPlay = false;

    const syncPlayback = () => {
      if (!shouldPlay || reduceMotion) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    };

    const onCanPlay = () => syncPlayback();
    video.addEventListener("canplay", onCanPlay);

    if (!("IntersectionObserver" in window)) {
      shouldPlay = true;
      syncPlayback();
      return () => {
        video.removeEventListener("canplay", onCanPlay);
        video.pause();
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        shouldPlay = Boolean(entry?.isIntersecting && (entry.intersectionRatio ?? 0) > 0.05);
        syncPlayback();
      },
      { rootMargin: "160px 0px", threshold: [0, 0.05, 0.15, 0.35] },
    );

    observer.observe(card);
    return () => {
      observer.disconnect();
      video.removeEventListener("canplay", onCanPlay);
      video.pause();
    };
  }, [item.src, reduceMotion]);

  return (
    <article
      ref={cardRef}
      className={cn("ta-applab-format-card", locked && "ta-applab-format-card--locked")}
    >
      <div className="ta-applab-iphone">
        <div className="ta-applab-iphone__device">
          <span className="ta-applab-iphone__btn ta-applab-iphone__btn--silent" aria-hidden />
          <span className="ta-applab-iphone__btn ta-applab-iphone__btn--volume" aria-hidden />

          <div className="ta-applab-iphone__screen">
            <span className="ta-applab-iphone__island" aria-hidden />

            <video
              ref={videoRef}
              className="ta-applab-format-card__video"
              src={item.src}
              poster={posterSrc ?? undefined}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              aria-label={locked ? `Aperçu ${item.displayName}` : `Vidéo ${item.displayName}`}
            />

            <div className="ta-applab-format-foot pointer-events-none">
              <div className="ta-applab-format-foot__gradient" aria-hidden />
              <div className="ta-applab-format-foot__content">
                <div className="ta-applab-format-foot__head">
                  <span className="ta-applab-format-foot__icon">
                    {locked ? (
                      <TrackappLogoMark size="xs" className="h-full w-full rounded-[inherit]" decorative />
                    ) : (
                      <ShowcaseAppIcon
                        artworkUrl={item.artworkUrl}
                        iconSrc={item.iconSrc}
                        name={item.displayName}
                      />
                    )}
                  </span>
                  <p className="ta-applab-format-foot__title">{item.displayName}</p>
                </div>
                {revenueParts ? (
                  <p className="ta-applab-format-foot__money">
                    <span className="ta-applab-format-foot__money-amount">{revenueParts.amount}</span>
                    {revenueParts.period ? (
                      <span className="ta-applab-format-foot__money-period">{revenueParts.period}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="ta-applab-format-card__shade" aria-hidden />

            <div className="ta-applab-format-card__cta-wrap">
              <Link href={href} className="ta-applab-format-card__cta" prefetch>
                {locked ? "Débloquer" : "Tracker"}
              </Link>
            </div>

            <span className="ta-applab-iphone__home-indicator" aria-hidden />
          </div>
        </div>
      </div>
    </article>
  );
}

export function TrackappApplabStudioGallery({
  videos,
}: Readonly<{
  videos: AppShowcaseVideoItemEnriched[];
}>) {
  const reduceMotion = useReducedMotion();
  const items = videos;

  if (items.length === 0) return null;

  return (
    <section id="selection" className="ta-applab-studio__gallery" aria-labelledby="ta-applab-studio-gallery-heading">
      <div className="ta-applab-studio__gallery-heading">
        <p className="ta-applab-gallery-kicker">
          <span className="ta-applab-gallery-kicker__shell">
            <span className="ta-applab-gallery-kicker__core">Notre sélection</span>
          </span>
        </p>
        <TrackerLandingHeroTitle as="h2" id="ta-applab-studio-gallery-heading">
          Trouvez les meilleures apps à copier
        </TrackerLandingHeroTitle>
        <ShowcaseLastUpdatedSubline className="ta-applab-studio__gallery-updated" />
      </div>

      <div className="ta-applab-showcase-body">
        <div className="ta-applab-format-grid-outer">
          <div className="ta-applab-format-grid" role="list">
            {items.map((item, index) => (
              <FormatVideoCard
                key={item.appStoreId}
                item={item}
                locked={index >= VISIBLE_SHOWCASE_COUNT}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
        </div>

        <div className="ta-applab-showcase-footer">
          <div className="ta-applab-showcase-stats" aria-label="Statistiques Trackapp">
            {SHOWCASE_STATS.map((stat) => (
              <div key={stat.label} className="ta-applab-showcase-stats__cell">
                <span className="ta-applab-showcase-stats__label">{stat.label}</span>
                <span className="ta-applab-showcase-stats__value">{stat.value}</span>
              </div>
            ))}
          </div>
          <div className="ta-applab-showcase-footer__edge" aria-hidden />
        </div>
      </div>
    </section>
  );
}
