"use client";

import { TrackappLogoMark } from "@/components/trackapp/trackapp-logo-mark";

import "@/styles/trackapp-onboarding.css";

const PROGRESS_GROUPS = 5;

export function TrackappOnboardingShell({
  section,
  headline,
  stepIndex,
  totalSteps,
  canGoBack,
  onBack,
  onDismiss,
  overlay = false,
  children,
  footer,
  promoTitle,
  promoSubtitle,
  promoBadge,
  promoGradient = "purple",
}: Readonly<{
  section: string;
  headline?: string;
  stepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  onBack: () => void;
  onDismiss?: () => void;
  overlay?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
  promoTitle?: string;
  promoSubtitle?: string;
  promoBadge?: string;
  promoGradient?: string;
}>) {
  const ratio = totalSteps > 1 ? stepIndex / (totalSteps - 1) : 1;
  const activeGroup = Math.min(PROGRESS_GROUPS - 1, Math.floor(ratio * PROGRESS_GROUPS));
  const stepLabel = `${stepIndex + 1} / ${totalSteps}`;
  const showBack = canGoBack;
  const showClose = overlay && !canGoBack && Boolean(onDismiss);

  const handleNavClick = () => {
    if (showBack) {
      onBack();
      return;
    }
    onDismiss?.();
  };

  return (
    <div className={overlay ? "ta-onboarding ta-onboarding--overlay ta-font" : "ta-onboarding ta-font"}>
      <div className="ta-onboarding__frame">
        <aside className="ta-onboarding__promo" aria-hidden="true">
          <div className={`ta-onboarding__promo-visual ta-onboarding__promo-visual--${promoGradient}`} />
          <div className="ta-onboarding__promo-content">
            <div className="ta-onboarding__promo-brand">
              <div className="ta-onboarding__brand-mark">
                <TrackappLogoMark size="sm" decorative />
              </div>
              <span className="ta-onboarding__brand-name">Trackapp</span>
            </div>
            {promoBadge ? <p className="ta-onboarding__promo-badge">{promoBadge}</p> : null}
            {promoTitle ? <h2 className="ta-onboarding__promo-title">{promoTitle}</h2> : null}
            {promoSubtitle ? <p className="ta-onboarding__promo-sub">{promoSubtitle}</p> : null}
            <p className="ta-onboarding__promo-step">Étape {stepLabel}</p>
            <div className="ta-onboarding__promo-progress">
              {Array.from({ length: PROGRESS_GROUPS }, (_, i) => {
                const isDone = i < activeGroup;
                const isActive = i === activeGroup;
                return (
                  <div
                    key={i}
                    className={`ta-onboarding__progress-seg${isDone ? " is-done" : ""}${isActive ? " is-active" : ""}`}
                  >
                    <span className="ta-onboarding__progress-fill" />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="ta-onboarding__inner">
          <header className="ta-onboarding__top">
            <div className="ta-onboarding__nav">
              <button
                type="button"
                className="ta-onboarding__back"
                aria-label={showBack ? "Étape précédente" : showClose ? "Fermer l'onboarding" : "Retour"}
                disabled={!showBack && !showClose}
                onClick={handleNavClick}
              >
                {showBack ? "←" : showClose ? "✕" : "←"}
              </button>
              <p className="ta-onboarding__section">{headline ?? promoTitle ?? section}</p>
              <span className="ta-onboarding__step-pill" aria-hidden>
                {stepLabel}
              </span>
            </div>
            <div className="ta-onboarding__progress ta-onboarding__progress--mobile" aria-hidden>
              {Array.from({ length: PROGRESS_GROUPS }, (_, i) => {
                const isDone = i < activeGroup;
                const isActive = i === activeGroup;
                return (
                  <div
                    key={i}
                    className={`ta-onboarding__progress-seg${isDone ? " is-done" : ""}${isActive ? " is-active" : ""}`}
                  >
                    <span className="ta-onboarding__progress-fill" />
                  </div>
                );
              })}
            </div>
          </header>

          <div className="ta-onboarding__body">{children}</div>
          {footer ? <footer className="ta-onboarding__footer">{footer}</footer> : null}
        </div>
      </div>
    </div>
  );
}

export function TrackappOnboardingBrand() {
  return (
    <div className="ta-onboarding__brand">
      <div className="ta-onboarding__brand-mark">
        <TrackappLogoMark size="sm" decorative />
      </div>
      <span className="ta-onboarding__brand-name">Trackapp</span>
    </div>
  );
}

export function TrackappOnboardingContinue({
  disabled,
  label = "Continuer",
  onClick,
}: Readonly<{
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}>) {
  return (
    <button type="button" className="ta-onboarding__cta" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
