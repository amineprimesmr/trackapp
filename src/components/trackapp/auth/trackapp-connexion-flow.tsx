"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import {
  PROMO_SLIDES,
  PromoPanel,
  SvgGoogle,
  TaAuthLegalFooter,
  TaAuthSuspended,
  TrackappLimeLogo,
} from "@/components/trackapp/auth/trackapp-auth-shared";
import { TrackappConnexionMissingSupabase } from "@/components/trackapp/auth/trackapp-connexion-missing-supabase";
import { TrackappPaymentNavLink } from "@/components/trackapp/trackapp-payment-nav-link";
import { createClient } from "@/lib/supabase/client";
import { claimPostPaymentAccess } from "@/lib/trackapp/post-payment-flow";
import { syncOnboardingDraftToProfile } from "@/lib/trackapp-onboarding/local-draft";

function ConnexionExperienceInner({
  nextHrefSafe,
  embedded = false,
  onClose,
}: Readonly<{
  nextHrefSafe: string;
  embedded?: boolean;
  onClose?: () => void;
}>) {
  const sb = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % PROMO_SLIDES.length), 4200);
    return () => clearInterval(t);
  }, []);

  const callbackUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ?
        window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "");
    const nextEnc = encodeURIComponent(nextHrefSafe);
    return `${origin}/trackapp/auth/callback?next=${nextEnc}`;
  }, [nextHrefSafe]);

  const oauth = useCallback(async () => {
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error: oErr } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: { prompt: "select_account" },
      },
    });
    setBusy(false);
    if (oErr) setError(oErr.message ?? "Connexion Google indisponible (Supabase).");
  }, [sb, callbackUrl]);

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sb) {
      setError("Configurer Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON).");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authErr) {
      setError(authErr.message ?? "Erreur de connexion.");
      return;
    }
    try {
      await fetch("/api/trackapp/profile/ensure", { method: "POST", credentials: "same-origin" });
      await syncOnboardingDraftToProfile();
      await claimPostPaymentAccess();
    } catch {
      /* profil créé au prochain accès workspace si besoin */
    }
    onClose?.();
    router.refresh();
    router.push(nextHrefSafe);
  }

  if (!sb) {
    return <TrackappConnexionMissingSupabase embedded={embedded} />;
  }

  const closeHref = "/tracker";
  const disabled = busy || !email || !password;
  const rootClass = embedded ? "ta-auth-root ta-auth-root--embedded ta-font" : "ta-auth-root ta-font";

  return (
    <div className={rootClass}>
      <div className="ta-auth-modal relative">
        {embedded && onClose ? (
          <button type="button" className="ta-auth-close" onClick={onClose} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <Link href={closeHref} className="ta-auth-close" prefetch={false} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        )}

        <div className="ta-auth-pane">
          <TrackappLimeLogo />
          <h1 id="ta-auth-headline" className="ta-auth-headline">
            Connexion Trackapp
          </h1>
          <p className="ta-auth-lead">Connectez-vous pour retrouver votre espace et vos outils.</p>

          <div className="ta-auth-oauth-stack">
            <button type="button" className="ta-auth-oauth-row" disabled={busy} onClick={oauth}>
              <SvgGoogle />
              Continuer avec Google
            </button>
          </div>

          <div className="ta-auth-divider-or" aria-hidden>
            <span>ou</span>
          </div>

          <form className="ta-auth-fields w-full max-w-none" onSubmit={onSubmit}>
            <input
              className="ta-auth-input"
              name="email"
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="ta-auth-input"
              name="password"
              type="password"
              placeholder="Mot de passe"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? <p className="ta-auth-error">{error}</p> : null}
            <button type="submit" className="ta-auth-submit" disabled={disabled}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div className="ta-auth-muted-link-row">
            <Link prefetch={false} href="/trackapp/mot-de-passe-oublie">
              Mot de passe oublié ?
            </Link>
            <span>
              Pas de compte ?{" "}
              <TrackappPaymentNavLink className="hover:text-white hover:underline" onBeforeOpen={onClose}>
                S&apos;inscrire
              </TrackappPaymentNavLink>
            </span>
          </div>

          <TaAuthLegalFooter />
        </div>

        <PromoPanel active={slide} />
      </div>
    </div>
  );
}

export function TaConnexionFlow({
  nextHref,
  embedded = false,
  onClose,
}: Readonly<{
  nextHref: string;
  embedded?: boolean;
  onClose?: () => void;
}>) {
  return (
    <Suspense fallback={<TaAuthSuspended />}>
      <ConnexionExperienceInner nextHrefSafe={nextHref} embedded={embedded} onClose={onClose} />
    </Suspense>
  );
}
