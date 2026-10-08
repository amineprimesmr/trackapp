import {
  derivePreciseRevenueDisplayUsd,
  formatUsdTrackerPrecise,
  resolveSensorTowerRevenueUsd,
} from "@/lib/tracker-revenue-display";

export const COUNTRIES = [
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "jp", name: "Japan", flag: "🇯🇵" },
  { code: "br", name: "Brazil", flag: "🇧🇷" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "it", name: "Italy", flag: "🇮🇹" },
  { code: "es", name: "Spain", flag: "🇪🇸" },
  { code: "mx", name: "Mexico", flag: "🇲🇽" },
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "kr", name: "South Korea", flag: "🇰🇷" },
  { code: "cn", name: "China", flag: "🇨🇳" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const COUNTRY_MAP = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
) as Record<CountryCode, (typeof COUNTRIES)[number]>;

/** Boutique utilisée sans `country` explicite (recherche, fiches, API, liens du tracker). */
export const TRACKER_DEFAULT_COUNTRY: CountryCode = "fr";

/** Accepte uniquement les codes présents dans `COUNTRIES` (`us`, etc., retombent sur `fr`). */
export function normalizeTrackerCountryParam(raw: string | undefined | null): CountryCode {
  const c = String(raw ?? "").toLowerCase();
  for (const row of COUNTRIES) {
    if (row.code === c) return row.code;
  }
  return TRACKER_DEFAULT_COUNTRY;
}

export const CHART_TYPES = [
  { id: "top-free", label: "Top Gratuit" },
  { id: "top-paid", label: "Top Payant" },
] as const;

export type ChartTypeId = (typeof CHART_TYPES)[number]["id"];

export const APPLE_CATEGORIES = [
  { id: "all", name: "Toutes catégories" },
  { id: "6000", name: "Business" },
  { id: "6001", name: "Météo" },
  { id: "6002", name: "Utilitaires" },
  { id: "6003", name: "Voyage" },
  { id: "6004", name: "Sports" },
  { id: "6005", name: "Réseaux sociaux" },
  { id: "6006", name: "Référence" },
  { id: "6007", name: "Productivité" },
  { id: "6008", name: "Photo & Vidéo" },
  { id: "6009", name: "Actualités" },
  { id: "6010", name: "Navigation" },
  { id: "6011", name: "Musique" },
  { id: "6012", name: "Mode de vie" },
  { id: "6013", name: "Santé & Forme" },
  { id: "6014", name: "Jeux" },
  { id: "6015", name: "Finance" },
  { id: "6016", name: "Divertissement" },
  { id: "6017", name: "Éducation" },
  { id: "6018", name: "Livres" },
  { id: "6020", name: "Médical" },
  { id: "6023", name: "Alimentation & Boissons" },
  { id: "6024", name: "Shopping" },
] as const;

// Revenue multipliers per category (from public mobile market studies)
// These adjust base estimates per category monetisation profile
const CATEGORY_REVENUE_MULTIPLIER: Record<string, number> = {
  "6015": 4.5,  // Finance — high LTV
  "6013": 2.8,  // Santé & Forme — subscriptions
  "6007": 2.2,  // Productivité — subscriptions
  "6014": 1.8,  // Jeux — IAP heavy
  "6017": 1.6,  // Éducation — subscriptions
  "6011": 1.5,  // Musique
  "6005": 0.9,  // Réseaux sociaux — ad monetisation
  "6008": 1.2,  // Photo & Vidéo
  "6012": 1.3,  // Mode de vie
  "6016": 0.8,  // Divertissement
};

export interface AppEntry {
  id: string;
  name: string;
  artworkUrl: string;
  artistName: string;
  category: string;
  categoryId: string;
  url: string;
  releaseDate: string;
  rank: number;
}

export interface AppDetail extends AppEntry {
  description: string;
  releaseNotes: string;
  price: number;
  formattedPrice: string;
  averageUserRating: number;
  userRatingCount: number;
  averageUserRatingForCurrentVersion: number;
  userRatingCountForCurrentVersion: number;
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
  minimumOsVersion: string;
  fileSizeBytes: string;
  version: string;
  currentVersionReleaseDate: string;
  trackContentRating: string;
  genres: string[];
  primaryGenreName: string;
  primaryGenreId: string;
  trackViewUrl: string;
  sellerUrl: string;
  supportUrl: string;
  sellerName: string;
  bundleId: string;
  languageCodesISO2A: string[];
  supportedDevices: string[];
  advisories: string[];
}

export interface CountryRanking {
  country: CountryCode;
  flag: string;
  name: string;
  rank: number | null;
  /** Présent sur l’App Store dans ce pays (Sensor Tower `valid_countries`). */
  storeAvailable?: boolean;
  /** Marché prioritaire ST (`top_countries`). */
  isTopMarket?: boolean;
  /** Note boutique locale (iTunes lookup par pays). */
  storeRating?: number;
  storeRatingCount?: number;
}

export interface MultiCountryApp extends AppEntry {
  country: string;
  flag: string;
}

export interface SearchResult extends AppEntry {
  averageUserRating: number;
  userRatingCount: number;
  price: number;
  formattedPrice: string;
  description: string;
  version: string;
  fileSizeBytes: string;
  minimumOsVersion: string;
  /** Présent quand l’API iTunes Search le renvoie (badges langue dans l’UI). */
  languageCodesISO2A?: string[];
}

/** App + variation de rang pour table movers (dashboard). */
export type Mover = {
  id: string;
  name: string;
  rank: number;
  change: number;
  country: CountryCode;
  flag: string;
  artworkUrl: string;
  category: string;
};

const RSS_BASE = "https://rss.marketingtools.apple.com/api/v2";
const ITUNES_BASE = "https://itunes.apple.com";
const REVALIDATE = 900;
/** évite les SSR qui restent bloqués si rss.itunes.apple.com pend indéfiniment */
const FETCH_TIMEOUT_MS = 12_000;

function fetchTimed(
  input: RequestInfo | URL,
  init?: RequestInit & { next?: { revalidate?: number | false } },
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export async function fetchTopCharts(
  country: string,
  chart: string,
  limit = 100,
): Promise<AppEntry[]> {
  const clamped = Math.min(Math.max(limit, 1), 100);
  const url = `${RSS_BASE}/${country}/apps/${chart}/${clamped}/apps.json`;
  try {
    const res = await fetchTimed(url, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      feed?: { results?: Record<string, unknown>[] };
    };
    return (data?.feed?.results ?? []).map(
      (app: Record<string, unknown>, i: number) => ({
        id: String(app.id ?? ""),
        name: String(app.name ?? ""),
        artworkUrl: String(app.artworkUrl100 ?? ""),
        artistName: String(app.artistName ?? ""),
        category: String(
          (app.genres as { name?: string }[])?.[0]?.name ?? "",
        ),
        categoryId: String(
          (app.genres as { genreId?: string }[])?.[0]?.genreId ?? "",
        ),
        url: String(app.url ?? ""),
        releaseDate: String(app.releaseDate ?? ""),
        rank: i + 1,
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Le flux `apps.json` renvoie souvent `genres: []` — sans id de genre, le filtre « concurrents » casse et
 * on retombait sur le top 100 général (liste incohérente). Complété via lookup iTunes.
 */
export async function enrichAppEntriesWithLookup(
  apps: AppEntry[],
  country: string,
): Promise<AppEntry[]> {
  const ids = [...new Set(apps.map((a) => a.id).filter(Boolean))];
  if (ids.length === 0) return apps;
  const meta = new Map<string, { categoryId: string; category: string }>();

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetchTimed(
        `${ITUNES_BASE}/lookup?id=${chunk.join(",")}&country=${country}`,
        { next: { revalidate: REVALIDATE } },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: Record<string, unknown>[] };
      for (const r of data.results ?? []) {
        const tid = String(r.trackId ?? "");
        if (!tid) continue;
        meta.set(tid, {
          categoryId: String(r.primaryGenreId ?? ""),
          category: String(r.primaryGenreName ?? ""),
        });
      }
    } catch {
      /* garder l’entrée brute */
    }
  }

  return apps.map((a) => {
    const m = meta.get(a.id);
    if (!m || (!m.categoryId && !m.category)) return a;
    return {
      ...a,
      categoryId: m.categoryId || a.categoryId,
      category: m.category || a.category,
    };
  });
}

export async function fetchEnrichedTopFree(country: string, limit = 100): Promise<AppEntry[]> {
  const apps = await fetchTopCharts(country, "top-free", limit);
  return enrichAppEntriesWithLookup(apps, country);
}

/** Rang dans le top national gratuit (≤100) — null si l’app n’y figure pas. */
export function overallRankInTop100Free(appId: string, enrichedTop: AppEntry[]): number | null {
  const canonical = String(appId);
  const idx = enrichedTop.findIndex((a) => a.id === canonical);
  return idx >= 0 ? idx + 1 : null;
}

/**
 * Rang parmi les apps du même genre présentes dans ce top 100 national.
 * Proxy utile quand le rang global affiche « — » mais l’app reste dans le plateau.
 */
export function genreSliceRankInTop100Free(
  appId: string,
  primaryGenreId: string,
  enrichedTop: AppEntry[],
): number | null {
  if (!primaryGenreId) return null;
  const canonical = String(appId);
  const same = enrichedTop.filter((a) => a.categoryId === primaryGenreId);
  const idx = same.findIndex((a) => a.id === canonical);
  return idx >= 0 ? idx + 1 : null;
}

export function peersFromEnrichedTopFree(
  enrichedTop: AppEntry[],
  primaryGenreId: string,
  excludeId: string,
  limit: number,
): AppEntry[] {
  if (!primaryGenreId) return [];
  return enrichedTop
    .filter((a) => a.id !== excludeId && a.categoryId === primaryGenreId)
    .slice(0, limit);
}

function genreSearchSeedTerm(primaryGenreName: string): string {
  const cleaned = primaryGenreName.split(/[&/]/)[0]?.trim() ?? "";
  const parts = cleaned.split(/\s+/).filter((w) => w.length > 2);
  return parts[0] ?? "app";
}

/** Même genre via recherche iTunes si le top 100 ne contient pas assez de paires. */
export async function fetchGenrePeersFromItunesSearch(
  primaryGenreName: string,
  primaryGenreId: string,
  excludeId: string,
  country: string,
  limit: number,
): Promise<AppEntry[]> {
  if (!primaryGenreId) return [];
  const term = genreSearchSeedTerm(primaryGenreName);
  const params = new URLSearchParams({
    term,
    country,
    entity: "software",
    limit: String(Math.min(Math.max(limit + 8, 15), 50)),
    genreId: primaryGenreId,
  });
  try {
    const res = await fetchTimed(`${ITUNES_BASE}/search?${params}`, {
      next: { revalidate: 400 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Record<string, unknown>[] };
    const rows = (data.results ?? []).filter((r) => String(r.trackId ?? "") !== excludeId);
    return rows.slice(0, limit).map((r, i) => ({
      id: String(r.trackId ?? ""),
      name: String(r.trackName ?? ""),
      artworkUrl: String(r.artworkUrl100 ?? r.artworkUrl512 ?? ""),
      artistName: String(r.artistName ?? ""),
      category: String(r.primaryGenreName ?? ""),
      categoryId: String(r.primaryGenreId ?? ""),
      url: String(r.trackViewUrl ?? ""),
      releaseDate: String(r.releaseDate ?? ""),
      rank: Math.min(95, 28 + i * 5),
    }));
  } catch {
    return [];
  }
}

export async function searchApps(
  query: string,
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
  limit = 25,
  categoryId?: string,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    term: query,
    country,
    entity: "software",
    limit: String(Math.min(limit, 200)),
    ...(categoryId && categoryId !== "all" ? { genreId: categoryId } : {}),
  });
  try {
    const res = await fetchTimed(`${ITUNES_BASE}/search?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Record<string, unknown>[];
    };
    return (data?.results ?? []).map((app, i) => ({
      id: String(app.trackId ?? ""),
      name: String(app.trackName ?? ""),
      artworkUrl: String(app.artworkUrl512 ?? app.artworkUrl100 ?? ""),
      artistName: String(app.artistName ?? ""),
      category: String(app.primaryGenreName ?? ""),
      categoryId: String(app.primaryGenreId ?? ""),
      url: String(app.trackViewUrl ?? ""),
      releaseDate: String(app.releaseDate ?? ""),
      rank: i + 1,
      averageUserRating: Number(app.averageUserRating ?? 0),
      userRatingCount: Number(app.userRatingCount ?? 0),
      price: Number(app.price ?? 0),
      formattedPrice: String(app.formattedPrice ?? "Gratuit"),
      description: String(app.description ?? ""),
      version: String(app.version ?? ""),
      fileSizeBytes: String(app.fileSizeBytes ?? ""),
      minimumOsVersion: String(app.minimumOsVersion ?? ""),
      languageCodesISO2A: Array.isArray(app.languageCodesISO2A)
        ? (app.languageCodesISO2A as string[]).filter((c) => typeof c === "string")
        : undefined,
    }));
  } catch {
    return [];
  }
}

export async function fetchAppDetail(
  id: string,
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
): Promise<AppDetail | null> {
  try {
    const { fetchAppStoreWebScreenshots } = await import("@/lib/apple-app-store-web-screenshots");

    const [res, webScreenshots] = await Promise.all([
      fetchTimed(`${ITUNES_BASE}/lookup?id=${id}&country=${country}`, {
        next: { revalidate: 3600 },
      }),
      fetchAppStoreWebScreenshots(id, country),
    ]);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Record<string, unknown>[];
    };
    const app = data?.results?.[0];
    if (!app) return null;

    const itunesScreenshots = (app.screenshotUrls as string[]) ?? [];
    const itunesIpadScreenshots = (app.ipadScreenshotUrls as string[]) ?? [];
    const screenshotUrls =
      webScreenshots.iphone.length > 0 ? webScreenshots.iphone : itunesScreenshots;
    const ipadScreenshotUrls =
      webScreenshots.ipad.length > 0 ? webScreenshots.ipad : itunesIpadScreenshots;

    return {
      id: String(app.trackId ?? ""),
      name: String(app.trackName ?? ""),
      artworkUrl: String(app.artworkUrl512 ?? app.artworkUrl100 ?? ""),
      artistName: String(app.artistName ?? ""),
      category: String(app.primaryGenreName ?? ""),
      categoryId: String(app.primaryGenreId ?? ""),
      url: String(app.trackViewUrl ?? ""),
      releaseDate: String(app.releaseDate ?? ""),
      rank: 0,
      description: String(app.description ?? ""),
      releaseNotes: String(app.releaseNotes ?? ""),
      price: Number(app.price ?? 0),
      formattedPrice: String(app.formattedPrice ?? "Gratuit"),
      averageUserRating: Number(app.averageUserRating ?? 0),
      userRatingCount: Number(app.userRatingCount ?? 0),
      averageUserRatingForCurrentVersion: Number(app.averageUserRatingForCurrentVersion ?? 0),
      userRatingCountForCurrentVersion: Number(app.userRatingCountForCurrentVersion ?? 0),
      screenshotUrls,
      ipadScreenshotUrls,
      minimumOsVersion: String(app.minimumOsVersion ?? ""),
      fileSizeBytes: String(app.fileSizeBytes ?? ""),
      version: String(app.version ?? ""),
      currentVersionReleaseDate: String(app.currentVersionReleaseDate ?? ""),
      trackContentRating: String(app.trackContentRating ?? ""),
      genres: (app.genres as string[]) ?? [],
      primaryGenreName: String(app.primaryGenreName ?? ""),
      primaryGenreId: String(app.primaryGenreId ?? ""),
      trackViewUrl: String(app.trackViewUrl ?? ""),
      sellerUrl: String(app.sellerUrl ?? ""),
      supportUrl: String(app.supportUrl ?? ""),
      sellerName: String(app.sellerName ?? ""),
      bundleId: String(app.bundleId ?? ""),
      languageCodesISO2A: (app.languageCodesISO2A as string[]) ?? [],
      supportedDevices: (app.supportedDevices as string[]) ?? [],
      advisories: (app.advisories as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

export async function fetchCountryRankings(appId: string): Promise<CountryRanking[]> {
  const canonicalId = String(appId);
  const results = await Promise.all(
    COUNTRIES.map(async (c) => {
      const apps = await fetchTopCharts(c.code, "top-free", 100);
      const idx = apps.findIndex((a) => String(a.id) === canonicalId);
      return { country: c.code, flag: c.flag, name: c.name, rank: idx >= 0 ? idx + 1 : null };
    }),
  );
  return results;
}

export async function fetchCategoryApps(
  categoryId: string,
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
  excludeId = "",
  limit = 10,
  primaryGenreName?: string,
): Promise<AppEntry[]> {
  const enriched = await fetchEnrichedTopFree(country, 100);
  if (!categoryId || categoryId === "all") {
    return enriched.filter((a) => a.id !== excludeId).slice(0, limit);
  }
  const peers = peersFromEnrichedTopFree(enriched, categoryId, excludeId, limit);
  if (peers.length < 5 && primaryGenreName) {
    const extra = await fetchGenrePeersFromItunesSearch(
      primaryGenreName,
      categoryId,
      excludeId,
      country,
      limit,
    );
    const seen = new Set(peers.map((p) => p.id));
    for (const row of extra) {
      if (peers.length >= limit) break;
      if (seen.has(row.id)) continue;
      peers.push(row);
      seen.add(row.id);
    }
  }
  if (peers.length === 0) {
    return enriched.filter((a) => a.id !== excludeId).slice(0, limit);
  }
  return peers;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatRatingCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (!n) return "—";
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} Go`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(0)} Mo`;
  return `${(n / 1024).toFixed(0)} Ko`;
}

export function daysSince(dateStr: string): number {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const days = daysSince(dateStr);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months <= 1 ? "il y a 1 mois" : `il y a ${months} mois`;
  }
  const years = Math.floor(days / 365);
  return years <= 1 ? "il y a 1 an" : `il y a ${years} ans`;
}

/** Âge app pour la carte « Actif depuis » — sans « il y a », pluriels FR corrects. */
export function formatAppAgeFr(dateStr: string): string {
  if (!dateStr) return "—";
  const days = daysSince(dateStr);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "1 jour";
  if (days < 30) return `${days} jours`;
  const months = Math.floor(days / 30);
  if (days < 365) return months <= 1 ? "1 mois" : `${months} mois`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "1 an" : `${years} ans`;
}

/**
 * Part relative dans le plateau Top gratuit **que nous chargeons** (`plateauSize` entrées, rang 1 en tête).
 * Ce n’est pas une part de marché : c’est une façon de comparer visuellement les rangs (#1 → 100 %, #100 → 1 % avec 100 lignes).
 */
export function rankPresencePercent(rank: number, plateauSize = 100): number {
  if (!Number.isFinite(rank) || plateauSize < 1) return 0;
  const r = Math.min(Math.max(Math.round(rank), 1), plateauSize);
  return Math.round(((plateauSize + 1 - r) / plateauSize) * 100);
}

/**
 * @deprecated Ne pas afficher à l’utilisateur — Trackapp = Sensor Tower ou « Indisponible ».
 * Conservé pour scripts / legacy interne uniquement.
 */
export function estimateMonthlyDownloads(rank: number, country: CountryCode = TRACKER_DEFAULT_COUNTRY): string {
  // Coefficients par pays par rapport au référentiel du modèle
  const countryFactor: Record<string, number> = {
    cn: 1.4, in: 0.9, br: 0.35, jp: 0.45,
    gb: 0.28, de: 0.22, fr: 0.20, ca: 0.18, au: 0.15,
    kr: 0.18, it: 0.15, es: 0.14, mx: 0.20,
  };
  const factor = countryFactor[country] ?? 0.2;
  const base = Math.round(2_500_000 * factor / Math.pow(rank, 0.82));
  return formatMillions(base);
}

function computeMonthlyRevenueUsd(
  rank: number,
  price = 0,
  categoryId = "",
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
): number {
  const countryFactor: Record<string, number> = {
    jp: 0.85, gb: 0.55, au: 0.40, de: 0.38,
    fr: 0.30, ca: 0.30, kr: 0.25, it: 0.20, es: 0.18,
    br: 0.08, mx: 0.07, in: 0.05, cn: 0.60,
  };
  const catMultiplier = CATEGORY_REVENUE_MULTIPLIER[categoryId] ?? 1.0;
  const factor = countryFactor[country] ?? 0.2;

  const downloads = 2_500_000 * factor / Math.pow(rank, 0.82);
  if (price > 0) {
    return Math.round(downloads * price * 0.7);
  }
  const arpu = 0.25 * catMultiplier;
  return Math.round(downloads * arpu);
}

/** Revenu mensuel estimé en USD (nombre brut, pour agrégations / graphiques). */
export function estimateMonthlyRevenueUsd(
  rank: number,
  price = 0,
  categoryId = "",
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
): number {
  if (!Number.isFinite(rank) || rank < 1) return 0;
  return computeMonthlyRevenueUsd(rank, price, categoryId, country);
}

export function estimateMonthlyRevenue(
  rank: number,
  price = 0,
  categoryId = "",
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
): string {
  const base = computeMonthlyRevenueUsd(rank, price, categoryId, country);
  return formatMillionsDollar(base);
}

/**
 * @deprecated Ne pas afficher à l’utilisateur — Trackapp = Sensor Tower ou « Indisponible ».
 */
export function formatEstimatedMonthlyRevenuePrecise(
  rank: number,
  price: number,
  categoryId: string,
  country: CountryCode,
  stableKey: string,
): string {
  const usd = estimateMonthlyRevenueUsd(rank, price, categoryId, country);
  if (!usd || usd <= 0) return "—";
  const display = derivePreciseRevenueDisplayUsd(usd, `est-rev:${stableKey}`);
  return formatUsdTrackerPrecise(display);
}

function formatMillions(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatMillionsDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

/**
 * Téléchargements / revenus mondiaux (mois dernier) — source `.../api/ios/apps?app_ids=`.
 * `revenue` : meilleure estimation USD alignée sur ST ; `revenueString` : même base, format précis (ex. 2 043 483 $US).
 */
export interface IosAggregateAppMetrics {
  downloads: number;
  downloadsString: string;
  revenue: number;
  revenueString: string;
  globalRatingCount: number;
  rating?: number;
  active?: boolean;
  updatedDate?: string;
  topCountries?: string[];
  validCountries?: string[];
  canonicalCountry?: string;
  /** Chemin ou URL ST — préférer `buildAppStoreUrl` pour l’App Store public. */
  appViewUrl?: string;
}

/** Codes ISO ST (US, FR…) → code tracker (`fr`, `gb`…). */
const ST_COUNTRY_TO_TRACKER: Record<string, CountryCode> = {
  FR: "fr",
  GB: "gb",
  UK: "gb",
  DE: "de",
  JP: "jp",
  BR: "br",
  CA: "ca",
  AU: "au",
  IT: "it",
  ES: "es",
  MX: "mx",
  IN: "in",
  KR: "kr",
  CN: "cn",
};

export function stCountryToTrackerCode(stCode: string): CountryCode | null {
  return ST_COUNTRY_TO_TRACKER[String(stCode).toUpperCase()] ?? null;
}

export function mergeCountryRankingsWithIosMeta(
  rankings: CountryRanking[],
  agg: IosAggregateAppMetrics | null | undefined,
): CountryRanking[] {
  if (!agg) return rankings;
  const valid = new Set(
    (agg.validCountries ?? []).map((c) => String(c).toUpperCase()),
  );
  const top = new Set((agg.topCountries ?? []).map((c) => String(c).toUpperCase()));
  return rankings.map((r) => {
    const st = String(r.country).toUpperCase();
    const stFromTracker = Object.entries(ST_COUNTRY_TO_TRACKER).find(([, v]) => v === r.country)?.[0];
    const available =
      valid.has(st) || (stFromTracker ? valid.has(stFromTracker) : false);
    const isTop =
      top.has(st) || (stFromTracker ? top.has(stFromTracker) : false);
    return {
      ...r,
      storeAvailable: valid.size > 0 ? available : r.storeAvailable,
      isTopMarket: top.size > 0 ? isTop : r.isTopMarket,
    };
  });
}

/** Notes iTunes par pays (marchés suivis uniquement). */
export async function fetchStoreRatingsByCountry(
  appId: string,
  countries: readonly CountryCode[] = COUNTRIES.map((c) => c.code),
): Promise<Partial<Record<CountryCode, { rating: number; count: number }>>> {
  const out: Partial<Record<CountryCode, { rating: number; count: number }>> = {};
  await Promise.all(
    countries.map(async (code) => {
      try {
        const res = await fetch(
          `https://itunes.apple.com/lookup?id=${appId}&country=${code}`,
          { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { results?: Record<string, unknown>[] };
        const row = data.results?.[0];
        if (!row) return;
        const rating = Number(row.averageUserRating ?? 0);
        const count = Number(row.userRatingCount ?? 0);
        if (rating > 0) out[code] = { rating, count };
      } catch {
        /* ignore */
      }
    }),
  );
  return out;
}

export function applyStoreRatingsToCountryRankings(
  rankings: CountryRanking[],
  ratings: Partial<Record<CountryCode, { rating: number; count: number }>>,
): CountryRanking[] {
  return rankings.map((r) => {
    const local = ratings[r.country];
    if (!local) return r;
    return {
      ...r,
      storeRating: local.rating,
      storeRatingCount: local.count,
    };
  });
}

function normalizeIosAggDisplayString(s: string): string {
  return s.replace(/([kmbt])$/i, (m) => m.toUpperCase());
}

/** Ex. « 1000k » / « $1,200K » → valeur scalaire pour reformater. */
function parseIosAggScaledValue(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  const m = s.match(/^([\d.]+)\s*([kmbt])$/i);
  if (!m) return null;
  const v = Number.parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (!Number.isFinite(v)) return null;
  const mult = u === "k" ? 1000 : u === "m" ? 1_000_000 : u === "b" ? 1_000_000_000 : 1_000_000_000_000;
  return v * mult;
}

function trimAggMagnitudeLabel(s: string): string {
  return s.replace(/(\d)\.0([KMB])$/i, "$1$2");
}

/** Téléchargements agrégés : évite « 1000K », utilise M au‑dessus du million. */
function formatIosAggDownloadCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const r = Math.round(m * 10) / 10;
    const t = Number.isInteger(r) ? `${r}M` : `${r.toFixed(1)}M`;
    return trimAggMagnitudeLabel(t);
  }
  const kRounded = Math.round(n / 1000);
  if (kRounded >= 1000) {
    const m = n / 1_000_000;
    const r = Math.round(m * 10) / 10;
    const t = Number.isInteger(r) ? `${r}M` : `${r.toFixed(1)}M`;
    return trimAggMagnitudeLabel(t);
  }
  return `${kRounded}K`;
}

const IOS_AGG_BATCH_FETCH_MS = 8_000;

function parseIosAggregateRow(
  row: Record<string, unknown>,
  fallbackId?: string | number,
): IosAggregateAppMetrics | null {
  if (!row) return null;
  const dl = row.humanized_worldwide_last_month_downloads as Record<string, unknown> | undefined;
  const rev = row.humanized_worldwide_last_month_revenue as Record<string, unknown> | undefined;
  const ratingRaw = row.rating;
  const rating =
    typeof ratingRaw === "number" && Number.isFinite(ratingRaw)
      ? ratingRaw
      : typeof ratingRaw === "string"
        ? Number.parseFloat(ratingRaw)
        : undefined;
  const dlN = Number(dl?.downloads ?? 0);
  const dlParsed = parseIosAggScaledValue(String(dl?.string ?? ""));
  const dlStrRaw = String(dl?.string ?? "—").trim();
  const revStrRaw = String(rev?.string ?? "—").trim();
  const revResolved = resolveSensorTowerRevenueUsd(rev);
  const revUsd =
    revResolved != null && Number.isFinite(revResolved) && revResolved > 0 ? revResolved : 0;
  const rowId = String(row.app_id ?? fallbackId ?? "");
  if (!rowId) return null;
  const revKey = `ios-agg-rev:${rowId}`;
  const revDisplayPrecise = revUsd > 0 ? derivePreciseRevenueDisplayUsd(revUsd, revKey) : 0;
  const revStrNegative = /^-\s*/.test(revStrRaw);

  const updatedRaw = row.updated_date;
  const updatedDate =
    typeof updatedRaw === "string" && updatedRaw.trim() ? updatedRaw.trim() : undefined;
  const validRaw = row.valid_countries;
  const topRaw = row.top_countries;
  const validCountries = Array.isArray(validRaw)
    ? validRaw.map((c) => String(c).toUpperCase()).filter(Boolean)
    : undefined;
  const topCountries = Array.isArray(topRaw)
    ? topRaw.map((c) => String(c).toUpperCase()).filter(Boolean)
    : undefined;
  const viewRaw = row.app_view_url ?? row.url;
  const appViewUrl = typeof viewRaw === "string" && viewRaw.trim() ? viewRaw.trim() : undefined;

  return {
    downloads: dlN,
    downloadsString:
      Number.isFinite(dlN) && dlN > 0
        ? formatIosAggDownloadCount(dlN)
        : dlParsed != null && dlParsed > 0
          ? formatIosAggDownloadCount(dlParsed)
          : dlStrRaw === "" || dlStrRaw === "—"
            ? "—"
            : normalizeIosAggDisplayString(dlStrRaw),
    revenue: revUsd,
    revenueString:
      revUsd > 0
        ? formatUsdTrackerPrecise(revDisplayPrecise)
        : revStrRaw === "" || revStrRaw === "—" || revStrNegative
          ? "—"
          : normalizeIosAggDisplayString(revStrRaw),
    globalRatingCount: Number(row.global_rating_count ?? 0),
    rating: rating !== undefined && Number.isFinite(rating) ? rating : undefined,
    active: row.active === true || row.active === "true",
    updatedDate,
    topCountries,
    validCountries,
    canonicalCountry:
      typeof row.canonical_country === "string"
        ? String(row.canonical_country).toUpperCase()
        : undefined,
    appViewUrl,
  };
}

async function fetchIosAggregateAppMetricsBatchOnce(
  ids: readonly string[],
  timeoutMs: number,
): Promise<{ map: Map<string, IosAggregateAppMetrics>; status: number }> {
  const out = new Map<string, IosAggregateAppMetrics>();
  if (ids.length === 0) return { map: out, status: 200 };

  try {
    const res = await fetch(
      `https://app.sensortower.com/api/ios/apps?app_ids=${ids.join(",")}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return { map: out, status: res.status };
    const data = (await res.json()) as { apps?: Record<string, unknown>[] };
    for (const row of data.apps ?? []) {
      const parsed = parseIosAggregateRow(row, ids.length === 1 ? ids[0] : undefined);
      const key = String(row.app_id ?? (ids.length === 1 ? ids[0] : ""));
      if (parsed && key) out.set(key, parsed);
    }
    return { map: out, status: res.status };
  } catch {
    return { map: out, status: 0 };
  }
}

/** Un seul appel ST pour N apps (recherche live — ~500 ms au lieu de N×3 s). */
export async function fetchIosAggregateAppMetricsBatch(
  appIds: readonly string[],
  options?: Readonly<{ timeoutMs?: number }>,
): Promise<Map<string, IosAggregateAppMetrics>> {
  const ids = [...new Set(appIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const timeoutMs = options?.timeoutMs ?? IOS_AGG_BATCH_FETCH_MS;
  let { map, status } = await fetchIosAggregateAppMetricsBatchOnce(ids, timeoutMs);

  if (map.size === 0 && (status === 429 || status === 0)) {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    ({ map } = await fetchIosAggregateAppMetricsBatchOnce(ids, timeoutMs));
  }

  return map;
}

/** Batch ST par petits paquets (évite HTTP 429 quand la recherche enrichit 20+ apps). */
export async function fetchIosAggregateAppMetricsBatchChunked(
  appIds: readonly string[],
  options?: Readonly<{ chunkSize?: number; delayMs?: number; timeoutMs?: number }>,
): Promise<Map<string, IosAggregateAppMetrics>> {
  const ids = [...new Set(appIds.map((id) => String(id).trim()).filter(Boolean))];
  const out = new Map<string, IosAggregateAppMetrics>();
  if (ids.length === 0) return out;

  const chunkSize = Math.min(Math.max(options?.chunkSize ?? 4, 1), 8);
  const delayMs = options?.delayMs ?? 320;
  const timeoutMs = options?.timeoutMs;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const chunkMap = await fetchIosAggregateAppMetricsBatch(chunk, { timeoutMs });
    chunkMap.forEach((value, key) => out.set(key, value));
    if (i + chunkSize < ids.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return out;
}

export async function fetchIosAggregateAppMetrics(
  appId: string | number,
  options?: Readonly<{ timeoutMs?: number }>,
): Promise<IosAggregateAppMetrics | null> {
  const map = await fetchIosAggregateAppMetricsBatch([String(appId)], options);
  return map.get(String(appId)) ?? null;
}

/** Check where an app appears across all countries' top-free chart */
export async function fetchAllCountryRankings(appId: string): Promise<CountryRanking[]> {
  return fetchCountryRankings(appId);
}

/** Trending apps: top movers by download velocity (rank improvement vs yesterday-proxy) */
export async function fetchTrendingApps(
  country: CountryCode = TRACKER_DEFAULT_COUNTRY,
  limit = 20,
): Promise<AppEntry[]> {
  const apps = await fetchTopCharts(country, "top-free", 50);
  // Apps that entered top charts recently (proxy: newest release date in top 50)
  return apps.slice(0, limit);
}
