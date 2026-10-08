import type { TrackappResourceCatalogEntry } from "@/lib/trackapp-ressources/catalog";
import { resourceZipFilename } from "@/lib/trackapp-ressources/match-for-prompt";

export const TRACKAPP_RESOURCES_PUBLIC_PREFIX = "/trackapp-ressources";

/** Origine fixe pour les URLs curl dans les prompts exportés (Cursor/Claude n'accèdent pas au localhost). */
export const TRACKAPP_PROMPT_EXPORT_ORIGIN = "https://www.trackapp.fr";

export function trackappSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return TRACKAPP_PROMPT_EXPORT_ORIGIN;
}

/** Origine utilisée dans les prompts MVP — toujours prod, jamais localhost. */
export function promptExportSiteOrigin(): string {
  return TRACKAPP_PROMPT_EXPORT_ORIGIN;
}

export function resourcePublicPath(filename: string): string {
  return `${TRACKAPP_RESOURCES_PUBLIC_PREFIX}/${encodeURIComponent(filename).replace(/%2F/g, "/")}`;
}

export function resourcePublicUrl(filename: string, origin?: string): string {
  const base = (origin ?? trackappSiteOrigin()).replace(/\/$/, "");
  return `${base}${resourcePublicPath(filename)}`;
}

/** Téléchargement public via API (accessible sans auth en prod). */
export function promptResourceDownloadUrl(filename: string): string {
  const base = promptExportSiteOrigin();
  return `${base}/api/trackapp/ressources/file/${encodeURIComponent(filename)}`;
}

export function resourceZipPublicUrl(
  entry: TrackappResourceCatalogEntry,
  origin?: string,
): string {
  if (!origin || origin === promptExportSiteOrigin()) {
    return promptResourceDownloadUrl(resourceZipFilename(entry));
  }
  return resourcePublicUrl(resourceZipFilename(entry), origin);
}

export function resourceVideoPublicUrl(
  entry: TrackappResourceCatalogEntry,
  origin?: string,
): string {
  const filename = `${entry.stem}.mp4`;
  if (!origin || origin === promptExportSiteOrigin()) {
    return promptResourceDownloadUrl(filename);
  }
  return resourcePublicUrl(filename, origin);
}

export function resourcesManifestPublicUrl(origin?: string): string {
  const base = (origin ?? promptExportSiteOrigin()).replace(/\/$/, "");
  return `${base}${resourcePublicPath("manifest.json")}`;
}
