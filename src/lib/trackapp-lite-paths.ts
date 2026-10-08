/** Routes « lite » sans sidebar workspace — onboarding, paiement, auth, légal. */
const LITE_FULLSCREEN_PREFIXES = [
  "/trackapp/onboarding",
  "/trackapp/offers",
  "/trackapp/paiement",
  "/trackapp/merci",
  "/trackapp/bienvenue",
  "/trackapp/connexion",
  "/trackapp/inscription",
  "/trackapp/activation",
  "/trackapp/mot-de-passe-oublie",
  "/trackapp/legal/",
] as const;

export function isTrackappLiteFullscreenPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "";
  return LITE_FULLSCREEN_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );
}
