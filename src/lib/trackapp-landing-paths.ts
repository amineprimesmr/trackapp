import {
  TRACKAPP_APP_STUDIO_PATH,
  isTrackappCreerUneAppPath,
} from "@/lib/trackapp-applab-create/paths";
import {
  TRACKAPP_APPTRACKER_PATH,
  isTrackappApptrackerPath,
} from "@/lib/trackapp-tools-paths";

/** Page offre publique (rewrite `/offers` → cette route). */
export const TRACKAPP_OFFERS_PATH = "/offers";

/** Entrée produit trackapp.fr — parcours « Créez votre prochaine app » (`/trackapp`). */
export const TRACKAPP_LANDING_PATH = TRACKAPP_APP_STUDIO_PATH;

/** Entrée paiement Whop — parcours LP → Whop → merci → bienvenue. */
export const TRACKAPP_COMMENCER_PATH = TRACKAPP_OFFERS_PATH;

const GUEST_OPEN_PATHS = new Set([
  TRACKAPP_LANDING_PATH,
  TRACKAPP_OFFERS_PATH,
  "/trackapp/offers",
  "/trackapp/connexion",
  "/trackapp/onboarding",
  "/trackapp/paiement",
  "/trackapp/merci",
  "/trackapp/bienvenue",
  "/trackapp/inscription",
  "/trackapp/activation",
  "/trackapp/mot-de-passe-oublie",
]);

const GUEST_TOOL_PREFIXES = [
  TRACKAPP_APPTRACKER_PATH,
  "/trackapp/marketing",
  "/trackapp/notre-selection",
  "/trackapp/logiciels",
  "/trackapp/gagner-240",
  "/trackapp/favoris",
  "/trackapp/accueil",
] as const;

export function isTrackappLandingPath(pathname: string): boolean {
  return isTrackappCreerUneAppPath(pathname);
}

export function trackappConnexionNextHref(nextPath: string = TRACKAPP_LANDING_PATH): string {
  const path = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `/trackapp/connexion?next=${encodeURIComponent(path)}`;
}

export function trackappCommencerHref(_nextPath: string = TRACKAPP_LANDING_PATH): string {
  return TRACKAPP_OFFERS_PATH;
}

function pathOnly(href: string): string {
  return (href.split("?")[0] ?? href).split("#")[0] ?? href;
}

function isGuestOpenPath(path: string): boolean {
  if (GUEST_OPEN_PATHS.has(path)) return true;
  if (path.startsWith("/trackapp/legal/") || path.startsWith("/trackapp/apercu/")) return true;
  return isTrackappLandingPath(path);
}

function isProtectedToolPath(path: string): boolean {
  return GUEST_TOOL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Invité : garde le parcours landing ouvert ; les outils SaaS passent par la connexion.
 * Connecté : liens directs.
 */
export function trackappGuestNavHref(href: string, loggedIn: boolean): string {
  if (loggedIn) return href;
  const path = pathOnly(href);
  if (isGuestOpenPath(path)) return href;
  if (isProtectedToolPath(path)) return trackappConnexionNextHref(href);
  return trackappConnexionNextHref(TRACKAPP_LANDING_PATH);
}

export function isTrackappGuestToolNavTarget(pathname: string): boolean {
  const path = pathOnly(pathname);
  return (
    isTrackappApptrackerPath(path)
    || isProtectedToolPath(path)
  );
}
