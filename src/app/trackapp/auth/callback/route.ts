import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { TRACKAPP_WORKSPACE_HUB_PATH } from "@/lib/trackapp-apptracker-paths";
import { claimPostPaymentPremium, hasPostPaymentCookie, POST_PAYMENT_COOKIE } from "@/lib/trackapp/post-payment-cookie";
import { ensureTrackappProfileRow } from "@/lib/trackapp-profile-favorites-store";
import { resolveTrackappRedirectOrigin } from "@/lib/trackapp/request-origin";

/**
 * OAuth / magic-link Supabase (PKCE) — à ajouter dans Supabase Redirect URLs :
 * https://trackapp.fr/trackapp/auth/callback
 * https://*.vercel.app/trackapp/auth/callback
 * http://127.0.0.1:3000/trackapp/auth/callback
 */
export async function GET(request: NextRequest) {
  const origin = resolveTrackappRedirectOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next");

  let nextPath = TRACKAPP_WORKSPACE_HUB_PATH;
  if (nextRaw?.startsWith("/") && !nextRaw.startsWith("//")) {
    try {
      const pathOnly = decodeURIComponent(nextRaw.split("#")[0]);
      if (pathOnly.startsWith("/trackapp/")) nextPath = pathOnly;
    } catch {
      nextPath = TRACKAPP_WORKSPACE_HUB_PATH;
    }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const failRedirect = NextResponse.redirect(new URL(`/trackapp/connexion?error=auth_oauth`, origin));

  if (!code || !supabaseUrl || !anon) return failRedirect;

  const response = NextResponse.redirect(new URL(nextPath, origin));

  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failRedirect;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await ensureTrackappProfileRow(supabase, user.id);
    const postPayment = hasPostPaymentCookie(request.cookies.get(POST_PAYMENT_COOKIE)?.value);
    if (postPayment) {
      await claimPostPaymentPremium(user.id);
      response.cookies.set(POST_PAYMENT_COOKIE, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}
