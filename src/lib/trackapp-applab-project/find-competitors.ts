import type { CountryCode } from "@/lib/apple-charts";
import type { SearchResultWithTrackappMetrics } from "@/lib/trackapp-app-display-metrics";
import {
  enrichSearchResultsWithTrackappMetricsForLiveSearch,
  TRACKAPP_METRICS_UNAVAILABLE_LABEL,
} from "@/lib/trackapp-app-display-metrics";
import { finalizeTrackappRevenueEurLabel } from "@/lib/trackapp-revenue-display";
import { buildReferenceSearchQueries } from "@/lib/trackapp-applab-create/build-reference-query";
import {
  APPLAB_COMPETITOR_TARGET,
  appMatchesSectorKeywords,
  appPassesSectorGate,
  buildCompetitorSearchHints,
  categoryMatchesSector,
  inferCompetitorSector,
  isOffTopicApp,
  isProjectBrandHomonym,
  revenueSortKey,
  sanitizeCompetitorSearchQueries,
} from "@/lib/trackapp-applab-project/competitor-sector";
import { APPLAB_COMPETITOR_RANK_JSON_SCHEMA } from "@/lib/trackapp-applab-project/schema";
import { callApplabProjectOpenAi } from "@/lib/trackapp-applab-project/openai";
import type {
  ApplabConceptAssessment,
  ApplabConceptUnderstanding,
  ApplabReferenceMatch,
} from "@/lib/trackapp-applab-project/types";
import { runTrackappSmartSearch } from "@/lib/trackapp-smart-search/run-smart-search";

const RANK_SYSTEM = `Tu es un analyste marché App Store pour Trackapp AppLAB. Tu sélectionne les concurrents du MÊME PRODUIT — apps qui font la même chose pour le même utilisateur, pas des homonymes ni des apps du même mot-clé générique.

Règles CRITIQUES (tous secteurs):
- Même job utilisateur / même type d'app (ex: tracker fitness ≠ streaming DAZN ; app langue ≠ TikTok ; budget perso ≠ Bloomberg News).
- Même catégorie App Store ET même usage concret (Education pour langue, Health & Fitness pour tracking, Finance pour budget, Photo & Video pour éditeur…).
- EXCLURE homonymes du nom du projet si secteur différent (ex: "kotcha" arabe ≠ "Kotcha running").
- EXCLURE apps hors job : média/news/jeux/réseaux sociaux si le concept est outil métier.
- INCLURE apps généralistes du secteur si pertinentes (Duolingo pour langues, Strava pour fitness…) avec score modéré.
- Objectif: identifier exactement ${APPLAB_COMPETITOR_TARGET} concurrents pertinents si le marché le permet.
- relevance_score 0-100: 90+ = concurrent direct, 70-89 = très proche, 55-69 = partiel, <55 = exclure.
- Raison courte en français pour chaque app incluse.
- search_queries: 4-8 requêtes App Store spécifiques au job produit — pas un mot générique seul ("sport", "finance", "photo").
- exclude_app_names: homonymes, hors secteur, apps hors job.

Réponds UNIQUEMENT en JSON conforme au schéma.`;

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isExcludedByName(appName: string, excludeNames: readonly string[]): boolean {
  const n = normalizeName(appName);
  return excludeNames.some((ex) => {
    const e = normalizeName(ex);
    return e.length >= 3 && (n.includes(e) || e.includes(n));
  });
}

function revenueLabel(app: SearchResultWithTrackappMetrics): string {
  return finalizeTrackappRevenueEurLabel(app.trackappMetrics.revenueDisplay);
}

async function collectCandidates(
  queries: string[],
  country: CountryCode,
): Promise<Map<string, SearchResultWithTrackappMetrics>> {
  const byId = new Map<string, SearchResultWithTrackappMetrics>();

  await Promise.all(
    queries.map(async (q) => {
      const result = await runTrackappSmartSearch(q, {
        country,
        limit: 12,
        sort: "revenue",
      });
      for (const app of result.apps) {
        const existing = byId.get(app.id);
        if (!existing || app.trackappMetrics.sortRevenueUsd > existing.trackappMetrics.sortRevenueUsd) {
          byId.set(app.id, app);
        }
      }
    }),
  );

  if (byId.size === 0) return byId;

  const enriched = await enrichSearchResultsWithTrackappMetricsForLiveSearch([...byId.values()], country);
  const next = new Map<string, SearchResultWithTrackappMetrics>();
  for (const app of enriched) next.set(app.id, app);
  return next;
}

function scoreHeuristic(
  app: SearchResultWithTrackappMetrics,
  understanding: ApplabConceptUnderstanding,
  sector: ReturnType<typeof inferCompetitorSector>,
): number {
  const haystack = normalizeName(`${app.name} ${app.description ?? ""} ${app.category ?? ""}`);
  let score = 30;

  for (const term of [...understanding.must_match, understanding.specific_subject, understanding.niche]) {
    const t = normalizeName(term);
    if (t.length >= 3 && haystack.includes(t)) score += 14;
  }

  for (const q of understanding.search_queries) {
    const t = normalizeName(q);
    if (t.length >= 4 && haystack.includes(t)) score += 10;
  }

  if (categoryMatchesSector(app.category ?? "", sector)) score += 18;
  else score -= 25;

  if (appMatchesSectorKeywords(app, sector)) score += 12;
  else score -= 15;

  for (const ex of understanding.not_competitors) {
    if (isExcludedByName(app.name, [ex])) score -= 40;
  }

  return Math.max(0, Math.min(100, score));
}

type ScoredRow = Readonly<{
  app: SearchResultWithTrackappMetrics;
  relevanceScore: number;
  reason: string;
  include: boolean;
  hardExclude: boolean;
  sectorOk: boolean;
}>;

function buildScoredRows(
  apps: readonly SearchResultWithTrackappMetrics[],
  input: {
    name: string;
    concept: string;
    understanding: ApplabConceptUnderstanding;
    excludeNames: readonly string[];
    rankMap: Map<string, { score: number; include: boolean; reason: string }>;
  },
  sector: ReturnType<typeof inferCompetitorSector>,
): ScoredRow[] {
  return apps.map((app) => {
    const rank = input.rankMap.get(app.id);
    const excludedByName = isExcludedByName(app.name, input.excludeNames);
    const homonym = isProjectBrandHomonym(
      app,
      input.name,
      input.concept,
      input.understanding,
      sector,
    );
    const offTopic = isOffTopicApp(app, sector);
    const sectorOk = !offTopic && appPassesSectorGate(app, sector);
    const heuristicScore = scoreHeuristic(app, input.understanding, sector);

    let relevanceScore = rank?.score ?? heuristicScore;
    if (excludedByName || homonym || offTopic) relevanceScore = Math.min(relevanceScore, 20);
    if (!sectorOk) relevanceScore = Math.min(relevanceScore, 45);
    if (rank?.include === false) relevanceScore = Math.min(relevanceScore, 40);

    const include =
      !excludedByName &&
      !homonym &&
      !offTopic &&
      relevanceScore >= 55 &&
      sectorOk &&
      (rank?.include !== false || (!rank && heuristicScore >= 58));

    let reason = rank?.reason || "";
    if (homonym) reason = "Homonyme du nom du projet — secteur différent, exclu.";
    else if (offTopic) reason = "Hors job produit — pas un concurrent direct.";
    else if (!sectorOk) reason = "Hors secteur par rapport au concept.";
    else if (excludedByName) reason = "App trop généraliste ou hors niche pour ce concept.";
    else if (!reason) reason = "Concurrent du même secteur.";

    const hardExclude = excludedByName || homonym || offTopic;

    return { app, relevanceScore, reason, include, hardExclude, sectorOk };
  });
}

function sortCompetitorRows(a: ScoredRow, b: ScoredRow): number {
  if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
  const revA = revenueSortKey(a.app.trackappMetrics.sortRevenueUsd, a.app.trackappMetrics.revenueDisplay);
  const revB = revenueSortKey(b.app.trackappMetrics.sortRevenueUsd, b.app.trackappMetrics.revenueDisplay);
  return revB - revA;
}

function pickTopCompetitors(rows: ScoredRow[]): ScoredRow[] {
  const included = [...rows.filter((row) => row.include)].sort(sortCompetitorRows);
  const usedIds = new Set(included.map((row) => row.app.id));
  const pool = [...included];

  if (pool.length < APPLAB_COMPETITOR_TARGET) {
    const soft = rows
      .filter((row) => !usedIds.has(row.app.id))
      .filter((row) => !row.hardExclude)
      .filter((row) => row.sectorOk || row.relevanceScore >= 58)
      .filter((row) => row.relevanceScore >= 48)
      .sort(sortCompetitorRows);

    for (const row of soft) {
      if (pool.length >= APPLAB_COMPETITOR_TARGET) break;
      pool.push(row);
      usedIds.add(row.app.id);
    }
  }

  return pool.slice(0, APPLAB_COMPETITOR_TARGET);
}

export async function findPreciseApplabCompetitors(input: {
  name: string;
  concept: string;
  understanding: ApplabConceptUnderstanding;
  assessment?: ApplabConceptAssessment | null;
  country: CountryCode;
}): Promise<
  Readonly<{
    apps: readonly ApplabReferenceMatch[];
    queriesUsed: readonly string[];
    failure?: string;
    failureDetail?: string;
    aiRanked?: boolean;
  }>
> {
  const sector = inferCompetitorSector(input.concept, input.understanding);
  const hints = buildCompetitorSearchHints(input.concept, input.understanding.niche);
  const heuristicQueries = buildReferenceSearchQueries(input.concept);
  const queries = sanitizeCompetitorSearchQueries(
    [
      ...(sector.searchQueries ?? hints.searchQueries),
      ...input.understanding.search_queries,
      ...heuristicQueries,
    ],
    input.name,
    input.concept,
  ).slice(0, 8);

  if (queries.length === 0) {
    return { apps: [], queriesUsed: [] };
  }

  const byId = await collectCandidates(queries, input.country);

  if (byId.size < 6) {
    await Promise.all(
      queries.slice(0, 4).map(async (q) => {
        const result = await runTrackappSmartSearch(q, {
          country: input.country,
          limit: 15,
          sort: "revenue",
        });
        for (const app of result.apps) {
          if (!byId.has(app.id)) byId.set(app.id, app);
        }
      }),
    );
    const enriched = await enrichSearchResultsWithTrackappMetricsForLiveSearch([...byId.values()], input.country);
    byId.clear();
    for (const app of enriched) byId.set(app.id, app);
  }

  const candidates = [...byId.values()].slice(0, 60);
  if (candidates.length === 0) {
    return { apps: [], queriesUsed: queries };
  }

  const rankMap = new Map<string, { score: number; include: boolean; reason: string }>();
  let extraQueries: string[] = [];
  let aiExcludeNames: string[] = [];
  let failure: string | undefined;
  let failureDetail: string | undefined;

  const skipAiRank = !process.env.OPENAI_API_KEY?.trim();

  if (!skipAiRank) {
    const candidatePayload = candidates.map((app) => ({
      id: app.id,
      name: app.name,
      category: app.category,
      artist: app.artistName,
      description: (app.description ?? "").slice(0, 280),
      revenue_usd: app.trackappMetrics.sortRevenueUsd,
      revenue_display: app.trackappMetrics.revenueDisplay,
    }));

    const rankInput = JSON.stringify(
      {
        project_name: input.name,
        concept: input.concept,
        understanding: input.understanding,
        sector_categories: sector.categories,
        assessment_summary: input.assessment?.summary ?? null,
        candidates: candidatePayload,
      },
      null,
      2,
    );

    const rankResult = await callApplabProjectOpenAi<{
      search_queries: string[];
      exclude_app_names: string[];
      ranked: Array<{
        id: string;
        relevance_score: number;
        include: boolean;
        reason: string;
      }>;
    }>({
      instructions: RANK_SYSTEM,
      input: rankInput,
      schemaName: "applab_competitor_rank",
      schema: APPLAB_COMPETITOR_RANK_JSON_SCHEMA as unknown as Record<string, unknown>,
      timeoutMs: 58_000,
    });

    failure = rankResult.failure;
    failureDetail = rankResult.failureDetail;
    extraQueries = rankResult.data?.search_queries ?? [];
    aiExcludeNames = rankResult.data?.exclude_app_names ?? [];

    for (const row of rankResult.data?.ranked ?? []) {
      if (!row?.id) continue;
      rankMap.set(String(row.id), {
        score: Math.max(0, Math.min(100, Number(row.relevance_score) || 0)),
        include: Boolean(row.include),
        reason: typeof row.reason === "string" ? row.reason.trim() : "",
      });
    }

    if (extraQueries.length > 0) {
      const extra = await collectCandidates(
        sanitizeCompetitorSearchQueries(extraQueries, input.name, input.concept).filter(
          (q) => !queries.includes(q),
        ).slice(0, 4),
        input.country,
      );
      for (const [id, app] of extra) {
        if (!byId.has(id)) byId.set(id, app);
      }
    }
  }

  const excludeNames = [
    ...input.understanding.not_competitors,
    ...(sector.notCompetitors ?? hints.notCompetitors),
    ...aiExcludeNames,
  ];

  const allApps = [...byId.values()];
  const scored = buildScoredRows(
    allApps,
    {
      name: input.name,
      concept: input.concept,
      understanding: input.understanding,
      excludeNames,
      rankMap,
    },
    sector,
  );

  const top = pickTopCompetitors(scored);

  const apps: ApplabReferenceMatch[] = top.map((row, index) => ({
    id: row.app.id,
    name: row.app.name,
    artistName: row.app.artistName,
    category: row.app.category,
    artworkUrl: row.app.artworkUrl,
    revenueDisplay:
      row.app.trackappMetrics.revenueDisplay === TRACKAPP_METRICS_UNAVAILABLE_LABEL ?
        "—"
      : revenueLabel(row.app),
    relevanceScore: Math.round(row.relevanceScore),
    relevanceReason: row.reason,
    rank: index + 1,
  }));

  const allQueries = [...new Set([...queries, ...extraQueries])];

  return {
    apps,
    queriesUsed: allQueries,
    failure,
    failureDetail,
    aiRanked: !skipAiRank && !failure,
  };
}
