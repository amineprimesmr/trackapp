import "server-only";

import { unstable_cache } from "next/cache";

import { fetchIosAggregateAppMetricsBatch, type IosAggregateAppMetrics } from "@/lib/apple-charts";
import type { AppShowcaseVideoItem } from "@/lib/selection-app/types";
import { isSelectionAppStoreId, listSelectionAppItemsFromManifest } from "@/lib/selection-app/items";
import { scanSelectionAppItems } from "@/lib/selection-app/scan.server";
import type { AppShowcaseVideoItemEnriched } from "@/lib/showcase-app-videos-types";
import {
  deriveShowcaseMonthlyRevenueEUR,
  formatShowcaseEurMonthlyLabel,
  showcaseMonthlyRevenueCanonicalKey,
} from "@/lib/showcase-revenue-display";
import { sensorTowerShowcaseMonthlyLabel } from "@/lib/trackapp-real-metrics-only";

export type { AppShowcaseVideoItemEnriched } from "@/lib/showcase-app-videos-types";

const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";

function itunesArtwork512(url: string): string {
  return url.replace(/(\d+)x(\d+)bb(\.jpg)$/i, "512x512bb$3");
}

async function fetchItunesArtworkMap(appIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(appIds.map((id) => id.trim()).filter(isSelectionAppStoreId))];
  if (ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch(`${ITUNES_LOOKUP}?id=${chunk.join(",")}&country=fr`, {
        next: { revalidate: 86_400 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: Record<string, unknown>[] };
      for (const row of data.results ?? []) {
        const id = String(row.trackId ?? "");
        const raw = String(row.artworkUrl512 ?? row.artworkUrl100 ?? "");
        if (id && raw) out.set(id, itunesArtwork512(raw));
      }
    } catch {
      /* ignore */
    }
  }

  return out;
}

function resolveShowcaseArtwork(
  item: AppShowcaseVideoItem,
  itunesArtwork: Map<string, string>,
): Pick<AppShowcaseVideoItemEnriched, "artworkUrl" | "iconSrc"> {
  const localPoster = item.posterSrc?.trim() || "";
  const localArtwork = item.artworkUrl?.trim() || "";
  const storeArtwork = itunesArtwork.get(item.appStoreId) ?? "";
  const artworkUrl = localArtwork || localPoster || storeArtwork;
  const iconSrc = localPoster || localArtwork || storeArtwork;

  return { artworkUrl, iconSrc };
}

function manifestFallbackMonthlyLabel(item: AppShowcaseVideoItem): string | null {
  if (!item.approxMonthlyRevenueEUR || item.approxMonthlyRevenueEUR <= 0) return null;
  const eur = deriveShowcaseMonthlyRevenueEUR(
    item.approxMonthlyRevenueEUR,
    showcaseMonthlyRevenueCanonicalKey(item.displayName, item.src),
  );
  return formatShowcaseEurMonthlyLabel(eur);
}

function resolveMonthlyRevenueLabel(
  item: AppShowcaseVideoItem,
  agg: IosAggregateAppMetrics | null | undefined,
): string | null {
  if (!isSelectionAppStoreId(item.appStoreId)) return null;
  return (
    sensorTowerShowcaseMonthlyLabel(agg ?? null, item.appStoreId) ?? manifestFallbackMonthlyLabel(item)
  );
}

async function enrichShowcaseItems(items: readonly AppShowcaseVideoItem[]): Promise<AppShowcaseVideoItemEnriched[]> {
  const realIds = [...new Set(items.map((i) => i.appStoreId).filter(isSelectionAppStoreId))];
  const [aggMap, artworkMap] = await Promise.all([
    realIds.length > 0
      ? fetchIosAggregateAppMetricsBatch(realIds, { timeoutMs: 12_000 })
      : Promise.resolve(new Map()),
    fetchItunesArtworkMap(realIds),
  ]);

  return items.map((item) => {
    const visuals = resolveShowcaseArtwork(item, artworkMap);
    return {
      ...item,
      ...visuals,
      monthlyRevenueLabel: resolveMonthlyRevenueLabel(item, aggMap.get(item.appStoreId)),
    };
  });
}

/** Sans appels réseau — pas de CA inventé. */
export function listAppShowcaseVideoItemsFallbackEnriched(): AppShowcaseVideoItemEnriched[] {
  return listSelectionAppItemsFromManifest().map((item) => ({
    ...item,
    monthlyRevenueLabel: manifestFallbackMonthlyLabel(item),
  }));
}

async function listAppShowcaseVideoItemsEnrichedCore(): Promise<AppShowcaseVideoItemEnriched[]> {
  const items = await scanSelectionAppItems();
  if (items.length === 0) return listAppShowcaseVideoItemsFallbackEnriched();
  return enrichShowcaseItems(items);
}

export const listAppShowcaseVideoItemsEnriched = unstable_cache(
  listAppShowcaseVideoItemsEnrichedCore,
  ["selection-app-showcase-enriched-v3-manifest-fallback"],
  { revalidate: 3600 },
);
