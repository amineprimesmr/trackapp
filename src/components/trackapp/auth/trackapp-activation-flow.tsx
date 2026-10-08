"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  PromoPanel,
  PROMO_SLIDES,
  SvgGoogle,
  SvgMail,
  TaAuthLegalFooter,
  TaAuthSuspended,
  TrackappLimeLogo,
} from "@/components/trackapp/auth/trackapp-auth-shared";
import { createClient } from "@/lib/supabase/client";
import { syncOnboardingDraftToProfile } from "@/lib/trackapp-onboarding/local-draft";
import { TRACKAPP_ACCUEIL_BASE } from "@/lib/trackapp-apptracker-paths";
import {
  fetchOnboardingNeedsCompletion,
  TRACKAPP_BIENVENUE_PATH,
} from "@/lib/trackapp/post-payment-flow";
import type { TrackappBillingPlan } from "@/lib/trackapp/pricing";

type CheckoutInfo = {
  paid: boolean;
  email: string | null;
  email_masked: string | null;
  plan: TrackappBillingPlan;
  already_linked: boolean;
};

type Step = "loading" | "account" | "linking" | "done" | "error";

function ActivationExperienceInner() {
  const sb = createClient();
  const router = useRouter();
  const sp = useSearchParams();
  const reduce = useReducedMotion();

  const sessionId = sp?.get("session_id")?.trim() ?? "";
  const oauthReturn = sp?.get("oauth") === "1";
  const returnedFirstName = sp?.get("first_name")?.trim().slice(0, 80) ?? "";

  const [step, setStep] = useState<Step>("loading");
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [slide, setSlide] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gate, setGate] = useState<"pick" | "email">("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % PROMO_SLIDES.length), 4200);
    return () => clearInterval(t);
  }, []);

  const callbackUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ?
        window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "");
    const firstNameParam = firstName.trim();
    const firstNameQs = firstNameParam ? `&first_name=${encodeURIComponent(firstNameParam)}` : "";
    const nextEnc = encodeURIComponent(`/trackapp/activation?session_id=${sessionId}&oauth=1${firstNameQs}`);
    return `${origin}/trackapp/auth/callback?next=${nextEnc}`;
  }, [firstName, sessionId]);

  const finishPostPayment = useCallback(async () => {
    setStep("done");
    await syncOnboardingDraftToProfile();
    router.refresh();
    const needsOnboarding = await fetchOnboardingNeedsCompletion();
    router.push(needsOnboarding ? TRACKAPP_BIENVENUE_PATH : TRACKAPP_ACCUEIL_BASE);
  }, [router]);

  useEffect(() => {
    if (!sessionId) {
      setStep("error");
      setError("Lien d'activation invalide. Reprends depuis la page paiement.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/trackapp/checkout-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as CheckoutInfo & { error?: string };
        if (!res.ok) throw new Error(data.error || "Session introuvable.");
        if (!data.paid) throw new Error("Paiement non confirmé. Attends quelques secondes puis recharge.");
        if (cancelled) return;
        setCheckout(data);
        if (data.email) setEmail(data.email);
        if (returnedFirstName) setFirstName(returnedFirstName);

        const { data: auth } = sb ? await sb.auth.getUser() : { data: { user: null } };
        const loggedIn = Boolean(auth.user);

        if (loggedIn && (oauthReturn || data.already_linked)) {
          setStep("linking");
          const linkRes = await fetch("/api/trackapp/link-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: sessionId, first_name: returnedFirstName }),
          });
          const linkData = (await linkRes.json().catch(() => ({}))) as { error?: string };
          if (!linkRes.ok) throw new Error(linkData.error || "Impossible de lier votre paiement.");
          finishPostPayment();
          return;
        }

        if (loggedIn && !oauthReturn) {
          setStep("linking");
          const linkRes = await fetch("/api/trackapp/link-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: sessionId, first_name: returnedFirstName }),
          });
          const linkData = (await linkRes.json().catch(() => ({}))) as { error?: string };
          if (linkRes.ok) {
            finishPostPayment();
            return;
          }
          setError(linkData.error ?? "Connectez-vous avec l'e-mail utilisé lors du paiement.");
          setStep("account");
          return;
        }

        setStep("account");
      } catch (err) {
        if (cancelled) return;
        setStep("error");
        setError(err instanceof Error ? err.message : "Impossible de vérifier le paiement.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, oauthReturn, returnedFirstName, sb, finishPostPayment]);

  const oauthGoogle = useCallback(async () => {
    if (!sb || firstName.trim().length < 2) {
      setError("Indiquez votre prénom avant de continuer avec Google.");
      return;
    }
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
    if (oErr) setError(oErr.message ?? "Connexion Google indisponible.");
  }, [sb, callbackUrl, firstName]);

  async function onEmailSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sb || !sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trackapp/activate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          first_name: firstName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (res.status === 409) {
        setError(data.error ?? "Compte existant — connectez-vous.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Création du compte impossible.");

      const signInEmail = data.email ?? email;
      const { error: signErr } = await sb.auth.signInWithPassword({ email: signInEmail, password });
      if (signErr) throw new Error(signErr.message ?? "Compte créé mais connexion échouée.");

      finishPostPayment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'inscription.");
    } finally {
      setBusy(false);
    }
  }

  if (!sb) {
    return (
      <div className="ta-auth-root">
        <div className="rounded-3xl border border-white/14 bg-neutral-950/90 p-12 text-[14px] text-white/55">
          Configure Supabase (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>ANON_KEY</code>).
        </div>
      </div>
    );
  }

  const disabledEmail = busy || firstName.trim().length < 2 || email.length < 5 || password.length < 8;

  return (
    <div className="ta-auth-root ta-font ta-activation-root">
      <div className="ta-auth-modal relative ta-activation-modal">
        <Link href="/trackapp/paiement" className="ta-auth-close" prefetch={false} aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>

        <div className="ta-auth-pane ta-activation-pane">
          <TrackappLimeLogo />

          <AnimatePresence mode="wait">
            {step === "loading" || step === "linking" ?
              <motion.div
                key="loading"
                className="ta-activation-stage"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="ta-activation-spinner" aria-hidden />
                <p className="ta-activation-stage__label">
                  {step === "linking" ? "Finalisation de votre compte…" : "Vérification du paiement…"}
                </p>
              </motion.div>
            : step === "error" ?
              <motion.div
                key="error"
                className="ta-activation-stage"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h1 className="ta-auth-headline">Activation impossible</h1>
                <p className="ta-auth-error">{error}</p>
                <Link href="/trackapp/paiement" className="ta-auth-submit ta-activation-cta">
                  Retour au paiement
                </Link>
              </motion.div>
            : <>
                <motion.div
                  key="account"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0.15 } : { type: "spring", damping: 26, stiffness: 300 }}
                >
                  <h1 className="ta-auth-headline">Créez votre compte</h1>
                  <p className="ta-auth-lead">
                    Dernière étape pour accéder à Trackapp
                    {checkout?.email_masked ? ` · ${checkout.email_masked}` : ""}.
                  </p>

                  <label className="ta-activation-field-label" htmlFor="ta-act-firstname">
                    Prénom
                  </label>
                  <input
                    id="ta-act-firstname"
                    className="ta-auth-input ta-activation-input"
                    placeholder="Votre prénom"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    minLength={2}
                    required
                  />

                  {gate === "pick" ?
                    <>
                      <div className="ta-auth-oauth-stack ta-activation-oauth">
                        <button
                          type="button"
                          className="ta-auth-oauth-row"
                          disabled={busy || firstName.trim().length < 2}
                          onClick={oauthGoogle}
                        >
                          <SvgGoogle />
                          Continuer avec Google
                        </button>
                      </div>

                      <div className="ta-auth-divider-or" aria-hidden>
                        <span>ou</span>
                      </div>

                      <div className="ta-auth-oauth-stack">
                        <button
                          type="button"
                          className="ta-auth-oauth-row"
                          disabled={busy || firstName.trim().length < 2}
                          onClick={() => {
                            setGate("email");
                            setError(null);
                          }}
                        >
                          <SvgMail />
                          Continuer avec l&apos;e-mail
                        </button>
                      </div>
                    </>
                  : <>
                      <button
                        type="button"
                        className="ta-auth-back ta-activation-back-inline"
                        onClick={() => setGate("pick")}
                        aria-label="Retour"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m15 6-9 9 9 9" />
                        </svg>
                      </button>

                      <form className="ta-auth-fields w-full max-w-none" onSubmit={onEmailSubmit}>
                        <input
                          className="ta-auth-input"
                          name="email"
                          type="email"
                          placeholder="E-mail (celui du paiement)"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          readOnly={Boolean(checkout?.email)}
                          required
                        />
                        <input
                          className="ta-auth-input"
                          name="password"
                          type="password"
                          placeholder="Mot de passe (8 caractères min.)"
                          autoComplete="new-password"
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        {error ? <p className="ta-auth-error">{error}</p> : null}
                        <button className="ta-auth-submit" type="submit" disabled={disabledEmail}>
                          {busy ? "Création…" : "Accéder à Trackapp"}
                        </button>
                      </form>
                    </>
                  }

                  {error && gate === "pick" ? <p className="ta-auth-error">{error}</p> : null}

                  <p className="ta-auth-muted-link">
                    Déjà un compte ?{" "}
                    <Link
                      prefetch={false}
                      href={`/trackapp/connexion?next=${encodeURIComponent(`/trackapp/activation?session_id=${sessionId}`)}`}
                    >
                      Se connecter
                    </Link>
                  </p>
                </motion.div>
              </>
            }
          </AnimatePresence>

          <TaAuthLegalFooter />
        </div>

        <PromoPanel active={slide} />
      </div>
    </div>
  );
}

export function TaActivationFlow() {
  return (
    <Suspense fallback={<TaAuthSuspended />}>
      <ActivationExperienceInner />
    </Suspense>
  );
}
