import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  AFFILIATE_REF_COOKIE,
  AFFILIATE_REF_COOKIE_MAX_AGE_SEC,
} from "@/lib/trackapp/affiliate/config";

function withReferralCookie(request: NextRequest, response: NextResponse): NextResponse {
  const ref = request.nextUrl.searchParams.get("ref")?.trim().toLowerCase();
  if (ref && ref.length >= 4 && ref.length <= 32) {
    response.cookies.set(AFFILIATE_REF_COOKIE, ref, {
      maxAge: AFFILIATE_REF_COOKIE_MAX_AGE_SEC,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

const PREMIUM_COOKIE = "trackapp_plan_unlocked";
/** 24 h — évite une requête DB premium à chaque navigation. */
const PREMIUM_COOKIE_MAX_AGE_SEC = 86_400;

function isRouterPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get("next-router-prefetch") === "1"
    || request.headers.get("purpose") === "prefetch"
    || request.headers.get("x-middleware-prefetch") === "1"
  );
}

const PREMIUM_EXEMPT_PREFIXES = [
  "/trackapp/paiement",
  "/trackapp/merci",
  "/trackapp/bienvenue",
  "/trackapp/activation",
  "/trackapp/connexion",
  "/trackapp/inscription",
  "/trackapp/mot-de-passe-oublie",
  "/trackapp/legal",
  "/trackapp/auth",
  "/trackapp/deconnexion",
  "/trackapp/apercu",
  "/trackapp/onboarding",
  "/trackapp/creer-une-app",
];

function isGuestPreviewPath(pathname: string): boolean {
  return pathname === "/trackapp/apercu" || pathname.startsWith("/trackapp/apercu/");
}

const PROTECT_PREFIXES = [
  "/trackapp/accueil",
  "/trackapp/apptracker",
  "/trackapp/marketing",
  "/trackapp/ads",
  "/trackapp/organique",
  "/trackapp/notre-selection",
  "/trackapp/creer-mon-app",
  "/trackapp/creer-depuis-app",
  "/trackapp/applab",
  "/trackapp/logiciels",
  "/trackapp/favoris",
  "/trackapp/gagner-240",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });
  response = withReferralCookie(request, response);

  if (pathname.startsWith("/trackapp/apptracker/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/trackapp/accueil${pathname.slice("/trackapp/apptracker".length)}`;
    return withReferralCookie(request, NextResponse.redirect(url));
  }

  if (pathname === "/explorer" || pathname.startsWith("/explorer/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/tracker";
    return withReferralCookie(request, NextResponse.redirect(url));
  }

  if (pathname === "/tracker/new-releases" || pathname.startsWith("/tracker/new-releases/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/tracker";
    return withReferralCookie(request, NextResponse.redirect(url));
  }

  const isResourcesApi = pathname.startsWith("/api/trackapp/ressources");
  const isPublicResourceFileDownload =
    request.method === "GET"
    && /^\/api\/trackapp\/ressources\/file\/[^/]+\.(zip|mp4|mov|webm|m4v)$/i.test(pathname);
  const isFavoritesApi = pathname.startsWith("/api/trackapp/favorites");
  const isProfileEnsureApi = pathname === "/api/trackapp/profile/ensure";
  const isProfileOnboardingApi = pathname.startsWith("/api/trackapp/profile/onboarding");
  const isAffiliateApi = pathname.startsWith("/api/trackapp/affiliate");
  const isMediaProxyApi = pathname.startsWith("/api/trackapp/media-proxy");
  const isInstagramOrganicApi = pathname.startsWith("/api/trackapp/instagram-organic");
  const isTikTokOrganicApi = pathname.startsWith("/api/trackapp/tiktok-organic");
  const isMetaAdsApi = pathname.startsWith("/api/trackapp/meta-ads");

  if (
    !pathname.startsWith("/trackapp") &&
    !isResourcesApi &&
    !isFavoritesApi &&
    !isProfileEnsureApi &&
    !isProfileOnboardingApi &&
    !isAffiliateApi &&
    !isMediaProxyApi &&
    !isInstagramOrganicApi &&
    !isTikTokOrganicApi &&
    !isMetaAdsApi
  ) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const needsAuth =
    !isGuestPreviewPath(pathname)
    && !isPublicResourceFileDownload
    && (
      PROTECT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
      || isResourcesApi
      || isFavoritesApi
      || isProfileEnsureApi
      || isProfileOnboardingApi
      || isAffiliateApi
      || isMediaProxyApi
      || isInstagramOrganicApi
      || isTikTokOrganicApi
      || isMetaAdsApi
    );

  /** En local tu peux ouvrir l’UI SaaS sans session ; la page serve les données maquette. */
  const skipTrackappAuth = process.env.NODE_ENV !== "production";

  if (skipTrackappAuth && needsAuth) {
    return response;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (needsAuth && !user && !skipTrackappAuth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Non autorisé. Connectez-vous pour accéder aux ressources." },
        { status: 401 },
      );
    }

    const signUrl = request.nextUrl.clone();
    signUrl.pathname = "/trackapp/connexion";
    const nextFull = pathname + request.nextUrl.search;
    signUrl.searchParams.set("next", nextFull);
    const redirectResponse = NextResponse.redirect(signUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  const isPremiumExempt = PREMIUM_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  /** Favoris / ensure profil : session suffit (pas de double garde premium). */
  if (
    needsAuth
    && user
    && !skipTrackappAuth
    && !isPremiumExempt
    && !isFavoritesApi
    && !isProfileEnsureApi
    && !isProfileOnboardingApi
    && !isRouterPrefetch(request)
  ) {
    const premiumCookie = request.cookies.get(PREMIUM_COOKIE)?.value;
    let hasPremium = premiumCookie === user.id;

    if (!hasPremium) {
      const { data: profile } = await supabase
        .from("trackapp_profiles")
        .select("plan_unlocked_at")
        .eq("id", user.id)
        .maybeSingle();

      hasPremium = Boolean(profile?.plan_unlocked_at);
      if (hasPremium) {
        response.cookies.set(PREMIUM_COOKIE, user.id, {
          maxAge: PREMIUM_COOKIE_MAX_AGE_SEC,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
    }

    if (!hasPremium) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Abonnement Trackapp requis." }, { status: 402 });
      }

      const payUrl = request.nextUrl.clone();
      payUrl.pathname = "/trackapp/paiement";
      payUrl.search = "";
      const redirectResponse = NextResponse.redirect(payUrl);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/explorer",
    "/explorer/:path*",
    "/trackapp",
    "/trackapp/:path*",
    "/api/trackapp/ressources/:path*",
    "/api/trackapp/favorites",
    "/api/trackapp/favorites/:path*",
    "/api/trackapp/profile/ensure",
    "/api/trackapp/profile/onboarding",
    "/api/trackapp/affiliate",
    "/api/trackapp/affiliate/:path*",
    "/api/trackapp/media-proxy",
    "/api/trackapp/media-proxy/:path*",
    "/api/trackapp/instagram-organic",
    "/api/trackapp/instagram-organic/:path*",
    "/api/trackapp/tiktok-organic",
    "/api/trackapp/tiktok-organic/:path*",
  ],
};
