import { unstable_cache } from "next/cache";

import {
  fetchAppDetail,
  fetchEnrichedTopFree,
  fetchIosAggregateAppMetrics,
  genreSliceRankInTop100Free,
  overallRankInTop100Free,
  type AppDetail,
  type CountryCode,
  type IosAggregateAppMetrics,
  type SearchResult,
} from "@/lib/apple-charts";
import { applyTrackappAppDisplayOverride } from "@/lib/trackapp-app-display-overrides";
import {
  mergeProdProxyIntoMetrics,
  fetchDisplayMetricsFromProdProxy,
  isTrackappMetricsDevProxyEnabled,
  patchMetricsMapWithDevProdProxy,
  patchMetricsWithDevProdProxy,
} from "@/lib/trackapp-metrics-dev-proxy";
import {
  finalizeTrackappDownloadsLabel,
  finalizeTrackappRevenueEurLabel,
  formatTrackappDownloadsDisplay,
  formatTrackappLiveSearchRevenueEur,
  hasAnyTrackerAggregateSignal,
  parseTrackappDownloadsScalar,
  TRACKAPP_LOW_METRICS_SORT_VALUE,
  TRACKAPP_ZERO_REVENUE_MAX_USD,
} from "@/lib/trackapp-revenue-display";

/** Affiché quand Sensor Tower n’a pas livré téléchargements + revenus agrégés. */
export const TRACKAPP_METRICS_UNAVAILABLE_LABEL = "Indisponible — à corriger";

/**
 * Métriques Trackapp — **données réelles uniquement** (agrégat Sensor Tower).
 * Aucune estimation par rang, formule interne, ni fallback #50.
 * Parité landing quand `useAggregateMetrics` est vrai sur `/tracker/apps/[id]`.
 */
export type TrackappAppDisplayMetrics = Readonly<{
  downloadsDisplay: string;
  revenueDisplay: string;
  metricSource: "agrégé monde / mois" | "donnée à corriger";
  chartRank: number | null;
  sortRevenueUsd: number;
  sortDownloads: number;
}>;

type AppMetricInput = Readonly<{
  id: string;
  price: number;
  categoryId: string;
  primaryGenreId?: string;
}>;

type EnrichedTop = Awaited<ReturnType<typeof fetchEnrichedTopFree>>;

export const METRICS_TO_FIX: TrackappAppDisplayMetrics = {
  downloadsDisplay: TRACKAPP_METRICS_UNAVAILABLE_LABEL,
  revenueDisplay: TRACKAPP_METRICS_UNAVAILABLE_LABEL,
  metricSource: "donnée à corriger",
  chartRank: null,
  sortRevenueUsd: 0,
  sortDownloads: 0,
};

/** @deprecated Utiliser `METRICS_TO_FIX`. */
export const EMPTY_METRICS = METRICS_TO_FIX;

const BATCH_METRICS_CONCURRENCY = 3;
const ST_FETCH_TIMEOUT_MS = 9_000;
const ST_RETRY_ATTEMPTS = 2;
const ST_RETRY_DELAY_MS = 300;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSensorTowerAggregateWithRetry(
  appId: string,
  options?: Readonly<{ timeoutMs?: number }>,
): Promise<IosAggregateAppMetrics | null> {
  const timeoutMs = options?.timeoutMs ?? ST_FETCH_TIMEOUT_MS;
  let last: IosAggregateAppMetrics | null = null;
  for (let attempt = 0; attempt < ST_RETRY_ATTEMPTS; attempt += 1) {
    last = await fetchIosAggregateAppMetrics(appId, { timeoutMs });
    if (last && (isTrackerAggregateDisplayReady(last) || hasAnyTrackerAggregateSignal(last))) {
      return last;
    }
    if (attempt < ST_RETRY_ATTEMPTS - 1) {
      await sleep(ST_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  return last && hasAnyTrackerAggregateSignal(last) ? last : null;
}

const sensorTowerAggregateCached = (appId: string) =>
  unstable_cache(
    async () => {
      const agg = await fetchSensorTowerAggregateWithRetry(appId);
      return agg && hasAnyTrackerAggregateSignal(agg) ? agg : null;
    },
    ["trackapp-sensor-tower-aggregate-v7-no-store", appId],
    { revalidate: 3600 },
  );

function parseDownloadsDisplayToSortValue(label: string, aggregateDownloads: number): number {
  if (aggregateDownloads > TRACKAPP_ZERO_REVENUE_MAX_USD) return aggregateDownloads;
  const fromLabel = parseTrackappDownloadsScalar(label);
  if (fromLabel != null && fromLabel > TRACKAPP_ZERO_REVENUE_MAX_USD) return fromLabel;
  if (
    aggregateDownloads > 0 &&
    aggregateDownloads <= TRACKAPP_ZERO_REVENUE_MAX_USD
  ) {
    return TRACKAPP_LOW_METRICS_SORT_VALUE;
  }
  if (fromLabel != null && fromLabel <= TRACKAPP_ZERO_REVENUE_MAX_USD) {
    return TRACKAPP_LOW_METRICS_SORT_VALUE;
  }
  return 0;
}

/** Même critère que la fiche landing `/tracker/apps/[id]` (téléchargements + revenus agrégés). */
export function isTrackerAggregateDisplayReady(
  agg: IosAggregateAppMetrics | null | undefined,
): agg is IosAggregateAppMetrics {
  return Boolean(
    agg &&
      agg.downloadsString.trim() !== "" &&
      agg.downloadsString !== "—" &&
      agg.revenueString.trim() !== "" &&
      agg.revenueString !== "—",
  );
}

function chartRankForApp(
  appId: string,
  primaryGenreId: string | undefined,
  enrichedNationalTop: EnrichedTop,
): number | null {
  const overallRank = overallRankInTop100Free(appId, enrichedNationalTop);
  const genreSliceRank = genreSliceRankInTop100Free(appId, primaryGenreId ?? "", enrichedNationalTop);
  return overallRank ?? genreSliceRank;
}

/** Uniquement agrégat ST réel ; sinon indisponible (jamais d’estimation). */
export function computeTrackappAppDisplayMetrics(
  app: AppMetricInput,
  country: CountryCode,
  aggregateMetrics: IosAggregateAppMetrics | null,
  chartRank: number | null,
): TrackappAppDisplayMetrics {
  if (aggregateMetrics && hasAnyTrackerAggregateSignal(aggregateMetrics)) {
    const hasDl =
      aggregateMetrics.downloadsString.trim() !== "" &&
      aggregateMetrics.downloadsString !== "—";
    const downloadsDisplay = finalizeTrackappDownloadsLabel(
      formatTrackappDownloadsDisplay(
        aggregateMetrics.downloads,
        hasDl ? aggregateMetrics.downloadsString : "—",
      ),
    );
    const revenueDisplay = finalizeTrackappRevenueEurLabel(
      formatTrackappLiveSearchRevenueEur(aggregateMetrics, app.id),
    );

    return applyTrackappAppDisplayOverride(app.id, {
      downloadsDisplay,
      revenueDisplay,
      metricSource: "agrégé monde / mois",
      chartRank,
      sortRevenueUsd:
        aggregateMetrics.revenue > TRACKAPP_ZERO_REVENUE_MAX_USD
          ? aggregateMetrics.revenue
          : TRACKAPP_LOW_METRICS_SORT_VALUE,
      sortDownloads: parseDownloadsDisplayToSortValue(
        downloadsDisplay,
        aggregateMetrics.downloads,
      ),
    });
  }

  return applyTrackappAppDisplayOverride(app.id, { ...METRICS_TO_FIX, chartRank });
}

async function getEnrichedNationalTopCached(country: CountryCode): Promise<EnrichedTop> {
  return unstable_cache(
    async () => fetchEnrichedTopFree(country, 100),
    ["trackapp-enriched-top-free-v3", country],
    { revalidate: 900 },
  )();
}

async function resolveTrackappAppDisplayMetricsForApp(
  appId: string,
  country: CountryCode,
  enrichedNationalTop: EnrichedTop,
): Promise<TrackappAppDisplayMetrics> {
  const [app, aggregateMetrics] = await Promise.all([
    fetchAppDetail(appId, country),
    sensorTowerAggregateCached(appId)(),
  ]);

  if (!app) return METRICS_TO_FIX;

  const chartRank = chartRankForApp(app.id, app.primaryGenreId, enrichedNationalTop);
  return computeTrackappAppDisplayMetrics(app, country, aggregateMetrics, chartRank);
}

async function resolveTrackappAppDisplayMetricsCanonical(
  appId: string,
  country: CountryCode,
): Promise<TrackappAppDisplayMetrics> {
  const enrichedNationalTop = await getEnrichedNationalTopCached(country);
  return resolveTrackappAppDisplayMetricsForApp(appId, country, enrichedNationalTop);
}

/** Cache cross-requêtes (recherche, favoris…) — Sensor Tower direct. */
export function getTrackappAppDisplayMetricsCached(appId: string, country: CountryCode) {
  return unstable_cache(
    () => resolveTrackappAppDisplayMetricsCanonical(appId, country),
    ["trackapp-display-metrics-canonical-v9", appId, country],
    { revalidate: 3600 },
  )();
}

export async function resolveTrackappAppDisplayMetrics(
  appId: string,
  country: CountryCode,
): Promise<TrackappAppDisplayMetrics | null> {
  const metrics = await getTrackappAppDisplayMetricsCached(appId, country);
  return metrics.metricSource === "donnée à corriger" ? null : metrics;
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }

  const workers = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
  return results;
}

/** Batch (favoris, sélection…) : top 100 pays + Sensor Tower par app. */
export async function resolveTrackappAppsDisplayMetricsBatch(
  appIds: readonly string[],
  country: CountryCode,
): Promise<Map<string, TrackappAppDisplayMetrics>> {
  const uniqueIds = [...new Set(appIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const enrichedNationalTop = await getEnrichedNationalTopCached(country);

  const rows = await mapPool(uniqueIds, BATCH_METRICS_CONCURRENCY, async (appId) => {
    const metrics = await resolveTrackappAppDisplayMetricsForApp(
      appId,
      country,
      enrichedNationalTop,
    );
    return [appId, metrics] as const;
  });

  return new Map(rows);
}

/** Batch favoris : réutilise les AppDetail déjà fetchés + un seul batch Sensor Tower. */
export async function resolveTrackappAppsDisplayMetricsFromDetails(
  details: readonly AppDetail[],
  country: CountryCode,
): Promise<Map<string, TrackappAppDisplayMetrics>> {
  if (details.length === 0) return new Map();

  const { fetchIosAggregateAppMetricsBatch } = await import("@/lib/apple-charts");
  const enrichedNationalTop = await getEnrichedNationalTopCached(country);
  const aggMap = await fetchIosAggregateAppMetricsBatch(
    details.map((d) => d.id),
    { timeoutMs: 8_000 },
  );

  const out = new Map<string, TrackappAppDisplayMetrics>();
  for (const detail of details) {
    out.set(
      detail.id,
      metricsFromAppDetail(detail, country, aggMap.get(detail.id) ?? null, enrichedNationalTop),
    );
  }
  return out;
}

export function metricsFromAppDetail(
  detail: AppDetail,
  country: CountryCode,
  aggregateMetrics: IosAggregateAppMetrics | null,
  enrichedNationalTop: EnrichedTop,
): TrackappAppDisplayMetrics {
  const chartRank = chartRankForApp(detail.id, detail.primaryGenreId, enrichedNationalTop);
  return computeTrackappAppDisplayMetrics(detail, country, aggregateMetrics, chartRank);
}

export type SearchResultWithTrackappMetrics = SearchResult & {
  trackappMetrics: TrackappAppDisplayMetrics;
};

export async function enrichSearchResultsWithTrackappMetrics(
  apps: readonly SearchResult[],
  country: CountryCode,
): Promise<SearchResultWithTrackappMetrics[]> {
  if (apps.length === 0) return [];

  const { fetchIosAggregateAppMetricsBatchChunked } = await import("@/lib/apple-charts");
  const enrichedNationalTop = await getEnrichedNationalTopCached(country);
  const aggMap = await fetchIosAggregateAppMetricsBatchChunked(
    apps.map((a) => a.id),
    { chunkSize: 3, delayMs: 650, timeoutMs: 14_000 },
  );

  let results = apps.map((app) => ({
    ...app,
    trackappMetrics: computeTrackappAppDisplayMetrics(
      {
        id: app.id,
        price: 0,
        categoryId: app.categoryId,
        primaryGenreId: app.categoryId,
      },
      country,
      aggMap.get(app.id) ?? null,
      chartRankForApp(app.id, app.categoryId, enrichedNationalTop),
    ),
  }));

  if (isTrackappMetricsDevProxyEnabled()) {
    const missingIds = results
      .filter((r) => r.trackappMetrics.metricSource === "donnée à corriger")
      .map((r) => r.id);
    if (missingIds.length > 0) {
      const proxy = await fetchDisplayMetricsFromProdProxy(missingIds, country);
      if (proxy.size > 0) {
        results = results.map((app) => ({
          ...app,
          trackappMetrics: mergeProdProxyIntoMetrics(
            app.trackappMetrics,
            proxy.get(app.id),
          ),
        }));
      }
    }
  }

  return results;
}

/**
 * Recherche live Accueil : batch Sensor Tower par paquets + rang Top 100.
 */
export async function enrichSearchResultsWithTrackappMetricsForLiveSearch(
  apps: readonly SearchResult[],
  country: CountryCode,
): Promise<SearchResultWithTrackappMetrics[]> {
  return enrichSearchResultsWithTrackappMetrics(apps, country);
}

/** Métriques batch pour enrichissement client (2ᵉ phase recherche). */
export async function resolveTrackappMetricsForAppIds(
  appIds: readonly string[],
  country: CountryCode,
): Promise<Map<string, TrackappAppDisplayMetrics>> {
  const unique = [...new Set(appIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { fetchIosAggregateAppMetricsBatchChunked } = await import("@/lib/apple-charts");
  const aggMap = await fetchIosAggregateAppMetricsBatchChunked(unique, {
    chunkSize: 4,
    delayMs: 280,
    timeoutMs: 10_000,
  });

  const out = new Map<string, TrackappAppDisplayMetrics>();
  for (const id of unique) {
    out.set(
      id,
      computeTrackappAppDisplayMetrics(
        { id, price: 0, categoryId: "", primaryGenreId: "" },
        country,
        aggMap.get(id) ?? null,
        null,
      ),
    );
  }
  return patchMetricsMapWithDevProdProxy(out, country);
}

/** Fiche détail — cache ST (pas d’estimation). */
export async function metricsForApptrackerDetailPage(
  appId: string,
  country: CountryCode,
): Promise<TrackappAppDisplayMetrics> {
  const metrics = await getTrackappAppDisplayMetricsCached(appId, country);
  return patchMetricsWithDevProdProxy(metrics, appId, country);
}

/** Même agrégat ST que `loadTrackerAppEmbedContext` (fiche Accueil). */
export function metricsFromEmbedContext(
  app: AppMetricInput,
  country: CountryCode,
  aggregateMetrics: IosAggregateAppMetrics | null,
  overallRank: number | null,
  genreSliceRank: number | null,
): TrackappAppDisplayMetrics {
  const chartRank = overallRank ?? genreSliceRank;
  return computeTrackappAppDisplayMetrics(app, country, aggregateMetrics, chartRank);
}
