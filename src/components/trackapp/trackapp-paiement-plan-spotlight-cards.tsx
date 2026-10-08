"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { TrackappPaiementStripeCheckout } from "@/components/trackapp/trackapp-paiement-stripe-checkout";
import { TRACKAPP_PAIEMENT_UNLOCK_ITEMS } from "@/lib/trackapp-paiement-unlock-items";
import { getTrackappPaiementPlan, setTrackappPaiementPlan } from "@/lib/trackapp-paiement-plan-storage";
import { TRACKAPP_PRICING, type TrackappBillingPlan } from "@/lib/trackapp/pricing";

function UnlockCreditBox({
  priceAmount,
  pricePeriod,
  priceNote,
}: Readonly<{ priceAmount: string; pricePeriod: string; priceNote?: string }>) {
  return (
    <div className="tpl-credit-box">
      <div className="tpl-credit-box__price">
        <p className="tpl-credit-box__price-value">
          {priceAmount}
          <span className="tpl-credit-box__price-period">{pricePeriod}</span>
        </p>
        {priceNote ? <p className="tpl-credit-box__price-note">{priceNote}</p> : null}
      </div>
      <p className="tpl-credit-box__title">Ce que vous débloquez après achat :</p>
      <ul className="tpl-credit-box__list">
        {TRACKAPP_PAIEMENT_UNLOCK_ITEMS.map((line) => (
          <li key={line} className="tpl-credit-box__list-item">
            <span className="tpl-credit-box__check" aria-hidden>
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LifetimeChip() {
  return (
    <span className="tpl-spotlight__chip tpl-spotlight__chip--reduction">
      <span className="tpl-spotlight__chip-reduction-wrap">
        <span className="tpl-spotlight__chip-reduction-inner">
          <span className="tpl-spotlight__chip-reduction-pct">{TRACKAPP_PRICING.lifetime.shortLabel}</span>
        </span>
      </span>
    </span>
  );
}

function GuaranteeChip() {
  return (
    <span className="tpl-spotlight__chip tpl-spotlight__chip--guarantee">
      Satisfait ou remboursé · 7&nbsp;jours
    </span>
  );
}

function LifetimeBadges() {
  return (
    <span className="tpl-spotlight__head-badges">
      <LifetimeChip />
      <GuaranteeChip />
    </span>
  );
}

function SimpleChevron({ toward }: Readonly<{ toward: "next" | "prev" }>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={toward === "next" ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"}
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpotlightOfferCheckout({
  plan,
  priceAmount,
  pricePeriod,
  priceNote,
  checkoutReveal,
  checkoutRevealed,
  onRevealCheckout,
}: Readonly<{
  plan: TrackappBillingPlan;
  priceAmount: string;
  pricePeriod: string;
  priceNote?: string;
  checkoutReveal: boolean;
  checkoutRevealed: boolean;
  onRevealCheckout: () => void;
}>) {
  const showExpress = !checkoutReveal || !checkoutRevealed;
  const showCard = !checkoutReveal || checkoutRevealed;

  return (
    <div className="tpl-spotlight__checkout-intro">
      <UnlockCreditBox priceAmount={priceAmount} pricePeriod={pricePeriod} priceNote={priceNote} />
      <TrackappPaiementStripeCheckout
        plan={plan}
        showExpress={showExpress}
        showCard={showCard}
        className={checkoutRevealed ? "tpl-spotlight__order tpl-spotlight__order--revealed" : "tpl-spotlight__order"}
      />
      {checkoutReveal && !checkoutRevealed ? (
        <button type="button" className="tpl-spotlight__pay-card-link" onClick={onRevealCheckout}>
          ou payer par carte
        </button>
      ) : null}
    </div>
  );
}

/** Deux cartes offre (À vie / Mensuel) + flèches, synchro avec le toggle et le checkout. */
export function TrackappPaiementPlanSpotlightCards({
  className,
  mode = "page",
  checkoutReveal = false,
  checkoutRevealed: checkoutRevealedProp,
  onCheckoutRevealedChange,
}: Readonly<{
  className?: string;
  mode?: "page" | "modal";
  checkoutReveal?: boolean;
  checkoutRevealed?: boolean;
  onCheckoutRevealedChange?: (revealed: boolean) => void;
}>) {
  if (mode === "modal") {
    return <ModalSpotlightGrid className={className} />;
  }

  return (
    <PageSpotlightCarousel
      className={className}
      checkoutReveal={checkoutReveal}
      checkoutRevealed={checkoutRevealedProp}
      onCheckoutRevealedChange={onCheckoutRevealedChange}
    />
  );
}

const SCROLL_SYNC_MS = 90;

function planIndexFromCarouselSlide(slideIndex: number): 0 | 1 {
  return slideIndex === 0 ? 1 : 0;
}

function carouselIndexFromPlanIndex(planIndex: 0 | 1): number {
  return planIndex === 0 ? 1 : 0;
}

function PageSpotlightCarousel({
  className,
  checkoutReveal,
  checkoutRevealed: checkoutRevealedProp,
  onCheckoutRevealedChange,
}: Readonly<{
  className?: string;
  checkoutReveal: boolean;
  checkoutRevealed?: boolean;
  onCheckoutRevealedChange?: (revealed: boolean) => void;
}>) {
  /** 0 = à vie, 1 = mensuel */
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const [internalCheckoutRevealed, setInternalCheckoutRevealed] = useState(false);
  const isCheckoutControlled = checkoutRevealedProp !== undefined && onCheckoutRevealedChange !== undefined;
  const checkoutRevealed = isCheckoutControlled ? checkoutRevealedProp : internalCheckoutRevealed;

  const revealCheckout = useCallback(() => {
    if (isCheckoutControlled) onCheckoutRevealedChange(true);
    else setInternalCheckoutRevealed(true);
  }, [isCheckoutControlled, onCheckoutRevealedChange]);

  const resetCheckout = useCallback(() => {
    if (isCheckoutControlled) onCheckoutRevealedChange(false);
    else setInternalCheckoutRevealed(false);
  }, [isCheckoutControlled, onCheckoutRevealedChange]);

  const goLifetime = useCallback(() => {
    setIndex(0);
    setTrackappPaiementPlan("lifetime");
  }, []);

  const goMonthly = useCallback(() => {
    setIndex(1);
    setTrackappPaiementPlan("monthly");
  }, []);

  const carouselIndex = carouselIndexFromPlanIndex(index as 0 | 1);

  const scrollToCarouselIndex = useCallback(
    (targetIndex: number, behavior: ScrollBehavior = "smooth") => {
      const viewport = viewportRef.current;
      if (!viewport || checkoutRevealed) return;
      const slides = viewport.querySelectorAll<HTMLElement>(".tpl-spotlight-carousel__slide");
      const target = slides[targetIndex];
      if (!target) return;
      programmaticScrollRef.current = true;
      target.scrollIntoView({ inline: "center", block: "nearest", behavior });
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, behavior === "smooth" ? 480 : 60);
    },
    [checkoutRevealed],
  );

  const syncFromStore = useCallback(() => {
    setIndex(getTrackappPaiementPlan() === "lifetime" ? 0 : 1);
  }, []);

  useEffect(() => {
    syncFromStore();
    window.addEventListener("trackapp-paiement-plan", syncFromStore);
    return () => window.removeEventListener("trackapp-paiement-plan", syncFromStore);
  }, [syncFromStore]);

  useEffect(() => {
    resetCheckout();
  }, [index, resetCheckout]);

  useEffect(() => {
    scrollToCarouselIndex(carouselIndex);
  }, [carouselIndex, scrollToCarouselIndex]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let scrollTimer: number | undefined;

    const onScroll = () => {
      if (programmaticScrollRef.current || checkoutRevealed) return;
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        const slides = Array.from(viewport.querySelectorAll<HTMLElement>(".tpl-spotlight-carousel__slide"));
        if (slides.length < 2) return;

        const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
        let closestSlide = 0;
        let minDistance = Number.POSITIVE_INFINITY;

        slides.forEach((slide, slideIndex) => {
          const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
          const distance = Math.abs(slideCenter - viewportCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestSlide = slideIndex;
          }
        });

        const planIndex = planIndexFromCarouselSlide(closestSlide);
        if (planIndex === 0 && index !== 0) goLifetime();
        else if (planIndex === 1 && index !== 1) goMonthly();
      }, SCROLL_SYNC_MS);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (scrollTimer) window.clearTimeout(scrollTimer);
    };
  }, [checkoutRevealed, goLifetime, goMonthly, index]);

  const showMonthlySlide = !checkoutReveal || !checkoutRevealed || index === 1;
  const showLifetimeSlide = !checkoutReveal || !checkoutRevealed || index === 0;

  const monthly = TRACKAPP_PRICING.monthly;
  const lifetime = TRACKAPP_PRICING.lifetime;

  return (
    <div
      id="paiement-checkout"
      className={[
        "tpl-spotlight-carousel",
        className,
        checkoutReveal ? "tpl-spotlight-carousel--checkout-reveal" : "",
        checkoutReveal && checkoutRevealed ? "tpl-spotlight-carousel--checkout-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-roledescription="carousel"
      aria-label="Formules Trackapp"
    >
      <div
        ref={viewportRef}
        className="tpl-spotlight-carousel__viewport"
        data-swipe-hint={checkoutRevealed ? undefined : "true"}
      >
        <div
          className="tpl-spotlight-carousel__track"
          style={{ "--carousel-index": checkoutRevealed ? 0 : carouselIndex } as CSSProperties}
        >
          {showMonthlySlide ? (
            <div className="tpl-spotlight-carousel__slide">
              <div className="tpl-spotlight tpl-spotlight--monthly">
                <span className="tpl-spotlight__glow-ring" aria-hidden />
                <span className="tpl-spotlight__vignette" aria-hidden />
                <div className="tpl-spotlight__content">
                  <div className="tpl-spotlight__head">
                    <p className="tpl-spotlight__name">TRACKAPP</p>
                  </div>
                  <p className="tpl-spotlight__desc">{monthly.cardDesc}</p>
                  <SpotlightOfferCheckout
                    plan="monthly"
                    priceAmount={monthly.display}
                    pricePeriod={monthly.period}
                    priceNote={monthly.note}
                    checkoutReveal={checkoutReveal}
                    checkoutRevealed={checkoutRevealed && index === 1}
                    onRevealCheckout={revealCheckout}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {showLifetimeSlide ? (
            <div className="tpl-spotlight-carousel__slide">
              <div className="tpl-spotlight">
                <span className="tpl-spotlight__glow-ring" aria-hidden />
                <span className="tpl-spotlight__vignette" aria-hidden />
                <div className="tpl-spotlight__content">
                  <div className="tpl-spotlight__head">
                    <p className="tpl-spotlight__name">TRACKAPP</p>
                    <LifetimeBadges />
                  </div>
                  <p className="tpl-spotlight__desc">{lifetime.cardDesc}</p>
                  <SpotlightOfferCheckout
                    plan="lifetime"
                    priceAmount={lifetime.display}
                    pricePeriod={lifetime.period}
                    priceNote={lifetime.note}
                    checkoutReveal={checkoutReveal}
                    checkoutRevealed={checkoutRevealed && index === 0}
                    onRevealCheckout={revealCheckout}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!checkoutRevealed && index === 0 ? (
        <button
          type="button"
          className="tpl-spotlight-carousel__arrow tpl-spotlight-carousel__arrow--left"
          onClick={goMonthly}
          aria-label={"Voir l'offre mensuelle"}
        >
          <SimpleChevron toward="prev" />
        </button>
      ) : null}

      {!checkoutRevealed && index === 1 ? (
        <button
          type="button"
          className="tpl-spotlight-carousel__arrow tpl-spotlight-carousel__arrow--right"
          onClick={goLifetime}
          aria-label={"Voir l'offre à vie"}
        >
          <SimpleChevron toward="next" />
        </button>
      ) : null}
    </div>
  );
}

function ModalSpotlightGrid({ className }: Readonly<{ className?: string }>) {
  const monthly = TRACKAPP_PRICING.monthly;
  const lifetime = TRACKAPP_PRICING.lifetime;

  return (
    <div
      className={[
        "tpl-spotlight-carousel",
        "tpl-spotlight-carousel--modal-grid",
        "tpl-spotlight-carousel--checkout-reveal",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Formules Trackapp"
    >
      <div className="tpl-spotlight-carousel__viewport">
        <div className="tpl-spotlight-carousel__track">
          <div className="tpl-spotlight-carousel__slide">
            <div className="tpl-spotlight tpl-spotlight--monthly">
              <span className="tpl-spotlight__glow-ring" aria-hidden />
              <span className="tpl-spotlight__vignette" aria-hidden />
              <div className="tpl-spotlight__content">
                <div className="tpl-spotlight__head">
                  <p className="tpl-spotlight__name">TRACKAPP</p>
                </div>
                <p className="tpl-spotlight__desc">{monthly.cardDesc}</p>
                <SpotlightOfferCheckout
                  plan="monthly"
                  priceAmount={monthly.display}
                  pricePeriod={monthly.period}
                  priceNote={monthly.note}
                  checkoutReveal
                  checkoutRevealed
                  onRevealCheckout={() => {}}
                />
              </div>
            </div>
          </div>

          <div className="tpl-spotlight-carousel__slide">
            <div className="tpl-spotlight">
              <span className="tpl-spotlight__glow-ring" aria-hidden />
              <span className="tpl-spotlight__vignette" aria-hidden />
              <div className="tpl-spotlight__content">
                <div className="tpl-spotlight__head">
                  <p className="tpl-spotlight__name">TRACKAPP</p>
                  <LifetimeBadges />
                </div>
                <p className="tpl-spotlight__desc">{lifetime.cardDesc}</p>
                <SpotlightOfferCheckout
                  plan="lifetime"
                  priceAmount={lifetime.display}
                  pricePeriod={lifetime.period}
                  priceNote={lifetime.note}
                  checkoutReveal
                  checkoutRevealed
                  onRevealCheckout={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
