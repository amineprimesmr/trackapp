import { NextResponse } from "next/server";

import { normalizeTrackerCountryParam, type CountryCode } from "@/lib/apple-charts";
import { TRACKAPP_METRICS_UNAVAILABLE_LABEL } from "@/lib/trackapp-app-display-metrics";
import { finalizeTrackappRevenueEurLabel } from "@/lib/trackapp-revenue-display";
import { runTrackappSmartSearch } from "@/lib/trackapp-smart-search/run-smart-search";
import type { TrackappSearchSort } from "@/lib/trackapp-smart-search/rank-results";

function parseSortParam(raw: string | null): TrackappSearchSort {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "revenue" || s === "downloads" || s === "rating" || s === "recent") return s;
  return "revenue";
}

export const maxDuration = 60;

function langChip(codes: string[] | undefined): string {
  if (!codes?.length) return "";
  const first = codes[0]?.toUpperCase() ?? "";
  const extra = codes.length - 1;
  return extra > 0 ? `${first} +${String(extra)}` : first;
}

function revenueForSearchRow(revenueDisplay: string): string {
  if (revenueDisplay === TRACKAPP_METRICS_UNAVAILABLE_LABEL) return "—";
  const raw = revenueDisplay || "—";
  return raw === "—" ? raw : finalizeTrackappRevenueEurLabel(raw);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const country = normalizeTrackerCountryParam(searchParams.get("country")) as CountryCode;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "12") || 12, 1), 12);
  const sort = parseSortParam(searchParams.get("sort"));

  if (!q) {
    return NextResponse.json({ apps: [] }, { status: 200 });
  }

  try {
    const result = await runTrackappSmartSearch(q, { country, limit, sort });
    const apps = result.apps.map((app) => ({
      id: app.id,
      name: app.name,
      artistName: app.artistName,
      category: app.category,
      categoryId: app.categoryId,
      artworkUrl: app.artworkUrl,
      rank: app.rank,
      releaseDate: app.releaseDate,
      rating: app.averageUserRating,
      langLabel: langChip(app.languageCodesISO2A),
      revenueDisplay: revenueForSearchRow(app.trackappMetrics.revenueDisplay),
      metricSource: app.trackappMetrics.metricSource,
    }));

    return NextResponse.json(
      { apps },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json({ apps: [] }, { status: 200 });
  }
}
