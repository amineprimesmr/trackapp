import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { AFFILIATE_REF_COOKIE } from "@/lib/trackapp/affiliate/config";
import { resolveReferrerByCode } from "@/lib/trackapp/affiliate/referral";
import { resolveTrackappOrigin } from "@/lib/trackapp/checkout-session";
import { trackappPlanStripeMetadata, TRACKAPP_PRICING, type TrackappBillingPlan } from "@/lib/trackapp/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

function parseBillingPlan(body: { plan?: unknown } | null): TrackappBillingPlan {
  if (body?.plan === "monthly") return "monthly";
  if (body?.plan === "lifetime" || body?.plan === "yearly") return "lifetime";
  return "lifetime";
}

function parseUiMode(body: { uiMode?: unknown } | null): "hosted" | "elements" {
  if (body?.uiMode === "elements") return "elements";
  return "hosted";
}

export async function POST(req: Request) {
  const stripe = getStripe();

  let plan: TrackappBillingPlan = "lifetime";
  let uiMode: "hosted" | "elements" = "hosted";
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { plan?: unknown; uiMode?: unknown };
      plan = parseBillingPlan(body);
      uiMode = parseUiMode(body);
    }
  } catch {
    plan = "lifetime";
  }

  const priceMonthly =
    process.env.STRIPE_PRICE_ID_TRACKAPP?.trim()
    ?? process.env.STRIPE_PRICE_ID_MONTHLY?.trim()
    ?? "";
  const priceLifetime =
    process.env.STRIPE_PRICE_ID_LIFETIME?.trim()
    ?? process.env.STRIPE_PRICE_ID_YEARLY?.trim()
    ?? "";
  const price = plan === "lifetime" ? priceLifetime : priceMonthly;

  if (!stripe) {
    return NextResponse.json({ error: "Stripe non configuré (STRIPE_SECRET_KEY)." }, { status: 503 });
  }
  if (!price) {
    const msg =
      plan === "lifetime" ?
        `Définir STRIPE_PRICE_ID_LIFETIME dans .env (accès à vie ${TRACKAPP_PRICING.lifetime.display}).`
      : `Définir STRIPE_PRICE_ID_TRACKAPP ou STRIPE_PRICE_ID_MONTHLY dans .env.local (abonnement ${TRACKAPP_PRICING.monthly.display}${TRACKAPP_PRICING.monthly.period}).`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const origin = resolveTrackappOrigin();
  const cookieStore = await cookies();

  const metadata: Record<string, string> = {
    product: "trackapp_full_access",
    trackapp_plan: trackappPlanStripeMetadata(plan),
  };

  const refCode = cookieStore.get(AFFILIATE_REF_COOKIE)?.value?.trim();
  const admin = createAdminClient();
  if (refCode && admin) {
    const referrer = await resolveReferrerByCode(admin, refCode);
    if (referrer) {
      metadata.referrer_user_id = referrer.id;
      metadata.referral_code = refCode.toLowerCase();
    }
  }

  try {
    const referralFriendCoupon = process.env.STRIPE_COUPON_ID_REFERRAL_FRIEND?.trim();
    const isLifetime = plan === "lifetime";
    const isElements = uiMode === "elements";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: isLifetime ? "payment" : "subscription",
      customer_creation: "always",
      line_items: [{ price, quantity: 1 }],
      metadata,
    };

    if (isElements) {
      sessionParams.ui_mode = "elements";
      sessionParams.return_url = `${origin}/trackapp/merci?session_id={CHECKOUT_SESSION_ID}`;
    } else {
      sessionParams.success_url = `${origin}/trackapp/merci?session_id={CHECKOUT_SESSION_ID}`;
      sessionParams.cancel_url = `${origin}/trackapp/paiement`;
    }

    if (referralFriendCoupon && metadata.referrer_user_id) {
      sessionParams.discounts = [{ coupon: referralFriendCoupon }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const sessionStripe = await stripe.checkout.sessions.create(sessionParams);

    if (isElements) {
      if (!sessionStripe.client_secret) {
        return NextResponse.json({ error: "Stripe n'a pas retourné de client secret." }, { status: 502 });
      }
      return NextResponse.json({ clientSecret: sessionStripe.client_secret });
    }

    if (!sessionStripe.url) {
      return NextResponse.json({ error: "Stripe n'a pas retourné d'URL de paiement." }, { status: 502 });
    }

    return NextResponse.json({ url: sessionStripe.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe rejected checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
