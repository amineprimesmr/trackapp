import {
  fetchEnrichedTopFree,
  normalizeTrackerCountryParam,
  searchApps,
  type AppEntry,
  type CountryCode,
  type SearchResult,
} from "@/lib/apple-charts";
import {
  enrichSearchResultsWithTrackappMetrics,
  type SearchResultWithTrackappMetrics,
} from "@/lib/trackapp-app-display-metrics";
import { pickMonetizingSearchResults } from "@/lib/trackapp-smart-search/filter-monetizing-apps";
import { expandSearchQueries, isGenericDiscoveryQuery } from "@/lib/trackapp-smart-search/keyword-expansion";
import {
  relevanceScore,
  sortSearchResults,
  type TrackappSearchSort,
} from "@/lib/trackapp-smart-search/rank-results";

export type SmartSearchResult = Readonly<{
  apps: SearchResultWithTrackappMetrics[];
  queriesUsed: string[];
  sort: TrackappSearchSort;
  expanded: boolean;
}>;

function appEntryToSearchResult(app: AppEntry): SearchResult {
  return {
    ...app,
    averageUserRating: 0,
    userRatingCount: 0,
    price: 0,
    formattedPrice: "Gratuit",
    description: "",
    version: "",
    fileSizeBytes: "",
    minimumOsVersion: "",
  };
}

/** Top 100 national : apps du domaine avec CA réel quand iTunes ne suffit pas. */
async function backfillMonetizingFromNationalTop(
  query: string,
  country: CountryCode,
  excludeIds: ReadonlySet<string>,
  need: number,
): Promise<SearchResult[]> {
  if (need <= 0) return [];
  const top = await fetchEnrichedTopFree(country, 100);
  return top
    .filter((app) => !excludeIds.has(app.id))
    .map(appEntryToSearchResult)
    .filter((app) => relevanceScore(query, app) >= 12)
    .sort((a, b) => relevanceScore(query, b) - relevanceScore(query, a))
    .slice(0, Math.min(need * 3, 36));
}

async function runSmartSearchUncached(
  q: string,
  country: CountryCode,
  limit: number,
  sort: TrackappSearchSort,
): Promise<SmartSearchResult> {
  const trimmed = q.trim();
  if (!trimmed) {
    return { apps: [], queriesUsed: [], sort, expanded: false };
  }

  const expanded = isGenericDiscoveryQuery(trimmed);
  const queries = expanded ? expandSearchQueries(trimmed) : [trimmed];
  const perQueryLimit = Math.min(Math.max(Math.ceil((limit * 3) / queries.length) + 6, 12), 25);

  const buckets = await Promise.all(
    queries.map((term) => searchApps(term, country, perQueryLimit).catch(() => [] as SearchResult[])),
  );

  const byId = new Map<string, SearchResult>();
  for (const bucket of buckets) {
    for (const app of bucket) {
      if (!byId.has(app.id)) byId.set(app.id, app);
    }
  }

  const poolCap = Math.min(limit * 3, 36);
  const merged = [...byId.values()].slice(0, poolCap);
  const enriched = await enrichSearchResultsWithTrackappMetrics(merged, country);
  const sorted = sortSearchResults(enriched, sort, trimmed, country);
  const picked = pickMonetizingSearchResults(sorted, limit);

  if (picked.length < limit && expanded) {
    const exclude = new Set(picked.map((a) => a.id));
    const backfillRaw = await backfillMonetizingFromNationalTop(
      trimmed,
      country,
      exclude,
      limit - picked.length,
    );
    if (backfillRaw.length > 0) {
      const backfillEnriched = await enrichSearchResultsWithTrackappMetrics(backfillRaw, country);
      const backfillSorted = sortSearchResults(backfillEnriched, "revenue", trimmed, country);
      const extra = pickMonetizingSearchResults(backfillSorted, limit - picked.length);
      for (const app of extra) {
        if (picked.length >= limit) break;
        if (!exclude.has(app.id)) {
          picked.push(app);
          exclude.add(app.id);
        }
      }
    }
  }

  return {
    apps: picked.slice(0, limit),
    queriesUsed: queries,
    sort,
    expanded,
  };
}

export async function runTrackappSmartSearch(
  q: string,
  options?: { country?: string; limit?: number; sort?: TrackappSearchSort },
): Promise<SmartSearchResult> {
  const country = normalizeTrackerCountryParam(options?.country) as CountryCode;
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 40);
  const trimmed = q.trim();
  const sort = options?.sort ?? (isGenericDiscoveryQuery(trimmed) ? "revenue" : "relevance");
  return runSmartSearchUncached(trimmed, country, limit, sort);
}
