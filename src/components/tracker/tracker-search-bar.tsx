"use client";

import { TrackerAppArtwork } from "@/components/tracker/tracker-app-artwork";
import { TrackerNavLink, useTrackerNavStart } from "@/components/tracker/tracker-navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import "@/styles/tracker-search-bar.css";

import { abortInFlightRequest, isAbortError } from "@/lib/abort-signal";
import { COUNTRY_MAP, TRACKER_DEFAULT_COUNTRY, type CountryCode } from "@/lib/apple-charts";
import {
  TRACKAPP_METRICS_UNAVAILABLE_LABEL,
  type SearchResultWithTrackappMetrics,
} from "@/lib/trackapp-app-display-metrics";
import { trackappAccueilAppHref, trackappAccueilHref, trackappApercuAppHref } from "@/lib/trackapp-apptracker-paths";
import { finalizeTrackappRevenueEurLabel } from "@/lib/trackapp-revenue-display";
import {
  TRACKAPP_SEARCH_SORT_OPTIONS,
  type TrackappSearchSort,
} from "@/lib/trackapp-smart-search/rank-results";

export type TrackerSearchSurface = "dark" | "light";


export type FeaturedAppLite = {
  id: string;
  name: string;
  artistName: string;
  category: string;
  categoryId: string;
  artworkUrl: string;
  rank: number;
  releaseDate: string;
  dlEst: string;
};

type SearchHit = {
  id: string;
  name: string;
  artistName: string;
  category: string;
  categoryId: string;
  artworkUrl: string;
  rank: number;
  releaseDate: string;
  dlEst: string;
  releaseLine: string;
  rating: number;
  langLabel: string;
  /** Revenus ST (EUR) — recherche Trackapp smart-search. */
  revenueDisplay?: string;
  metricSource?: string;
  sortRevenueUsd?: number;
  sortDownloads?: number;
};

function applySearchMetricsToHits(
  hits: SearchHit[],
  metrics: Record<
    string,
    {
      revenueDisplay: string;
      metricSource: string;
      sortRevenueUsd: number;
      sortDownloads: number;
    }
  >,
  sort: TrackappSearchSort,
): SearchHit[] {
  const merged = hits.map((h) => {
    const m = metrics[h.id];
    if (!m) {
      return {
        ...h,
        revenueDisplay: h.revenueDisplay === "…" ? "—" : (h.revenueDisplay ?? "—"),
      };
    }
    return {
      ...h,
      revenueDisplay: m.revenueDisplay,
      metricSource: m.metricSource,
      sortRevenueUsd: m.sortRevenueUsd,
      sortDownloads: m.sortDownloads,
    };
  });
  if (sort === "revenue") {
    merged.sort((a, b) => (b.sortRevenueUsd ?? 0) - (a.sortRevenueUsd ?? 0));
  } else if (sort === "downloads") {
    merged.sort((a, b) => (b.sortDownloads ?? 0) - (a.sortDownloads ?? 0));
  }
  return merged;
}

function langChip(codes: string[] | undefined): string {
  if (!codes?.length) return "";
  const first = codes[0]?.toUpperCase() ?? "";
  const extra = codes.length - 1;
  return extra > 0 ? `${first} +${String(extra)}` : first;
}

function smartSearchAppToHit(app: SearchResultWithTrackappMetrics): SearchHit {
  const rev = app.trackappMetrics.revenueDisplay;
  const revenueDisplay =
    rev === TRACKAPP_METRICS_UNAVAILABLE_LABEL ? "—" : finalizeTrackappRevenueEurLabel(rev || "—");
  return {
    id: app.id,
    name: app.name,
    artistName: app.artistName,
    category: app.category,
    categoryId: app.categoryId,
    artworkUrl: app.artworkUrl,
    rank: app.rank,
    releaseDate: app.releaseDate,
    dlEst: app.trackappMetrics.downloadsDisplay ?? "—",
    releaseLine: formatReleaseMeta(app.releaseDate),
    rating: app.averageUserRating,
    langLabel: langChip(app.languageCodesISO2A),
    revenueDisplay,
    metricSource: app.trackappMetrics.metricSource,
    sortRevenueUsd: app.trackappMetrics.sortRevenueUsd,
    sortDownloads: app.trackappMetrics.sortDownloads,
  };
}

function formatReleaseMeta(raw: string) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days >= 0 && days < 14) {
    if (days === 0) return "Màj récente";
    if (days === 1) return "Il y a 1 jour";
    return `Il y a ${String(days)} jours`;
  }
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

function categorySlug(cat: string) {
  if (!cat) return "";
  const c = cat.toLowerCase();
  return c.length > 26 ? `${c.slice(0, 24)}…` : c;
}

/** Libellé catégorie lisible (recherche Trackapp). */
function formatSearchCategoryLabel(cat: string) {
  const c = cat.trim();
  if (!c) return "";
  return c.length > 32 ? `${c.slice(0, 30)}…` : c;
}

function searchRevenuePending(revenueDisplay: string | undefined): boolean {
  return revenueDisplay === "…" || revenueDisplay === undefined;
}

function SearchRevenueValue({ revenueDisplay }: Readonly<{ revenueDisplay?: string }>) {
  if (searchRevenuePending(revenueDisplay)) {
    return (
      <span className="tracker-search-revenue tracker-search-revenue--pending tabular-nums" aria-busy="true">
        …
      </span>
    );
  }
  return (
    <span
      className="tracker-search-revenue tabular-nums"
      title="Revenus mensuels estimés"
    >
      {revenueDisplay ?? "—"}
    </span>
  );
}

function calendarShort(raw: string) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

const SEARCH_DEBOUNCE_MS = 200;
const SKELETON_ROWS = 6;

export function TrackerSearchBar({
  searchSurface = "dark",
  isOpen,
  onClose,
  onOpen,
  embedded = false,
  hideFeaturedWhenEmpty = false,
  trackappLiveMetrics = true,
  guestPreview = false,
  country,
  initialQuery = "",
  onNavigateToApp,
}: {
  searchSurface?: TrackerSearchSurface;
  isOpen: boolean;
  onClose: () => void;
  /** Ouvre le panneau (desktop : au focus de l’input). */
  onOpen?: () => void;
  /** Page Accueil workspace : même UX que la landing, liens vers `/trackapp/accueil/[id]`. */
  embedded?: boolean;
  /** Accueil : pas de suggestions « top apps » quand le champ est vide — historique en dessous. */
  hideFeaturedWhenEmpty?: boolean;
  /** Accueil SaaS : revenus Sensor Tower dans les résultats (API `/api/trackapp/live-search`). */
  trackappLiveMetrics?: boolean;
  /** Landing / aperçu invité : liens vers `/trackapp/apercu/[id]`. */
  guestPreview?: boolean;
  country?: CountryCode;
  initialQuery?: string;
  /** Enregistre l’app dans l’historique Accueil avant navigation. */
  onNavigateToApp?: (app: Readonly<{
    id: string;
    name: string;
    artistName: string;
    artworkUrl: string;
    category: string;
  }>) => void;
}) {
  const router = useRouter();
  const isLg = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useReducedMotion();
  const isCoarseMobile = useMediaQuery("(max-width: 1023px)");
  const motionLite = Boolean(reduceMotion || isCoarseMobile);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const startTrackerNav = useTrackerNavStart();

  const storeCountry = country ?? TRACKER_DEFAULT_COUNTRY;
  const storeCc = storeCountry.toUpperCase();
  const storeCountryName = COUNTRY_MAP[storeCountry].name;

  const useTrackappAccueilRoutes = embedded || trackappLiveMetrics;

  const appDetailHref = useCallback(
    (appId: string) => {
      if (guestPreview) return trackappApercuAppHref(appId, storeCountry);
      if (useTrackappAccueilRoutes) return trackappAccueilAppHref(appId, storeCountry);
      return `/tracker/apps/${appId}?country=${storeCountry}`;
    },
    [guestPreview, useTrackappAccueilRoutes, storeCountry],
  );

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery.trim());

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQ(initialQuery.trim());
    if (!initialQuery.trim()) {
      setSearchHits([]);
      setSearchLoading(false);
    }
  }, [initialQuery]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featured, setFeatured] = useState<FeaturedAppLite[]>([]);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [sort, setSort] = useState<TrackappSearchSort>("revenue");

  /** Tri visible uniquement sur l’Accueil workspace — pas sur la landing. */
  const showSearchSort = trackappLiveMetrics && embedded;
  const searchSort: TrackappSearchSort = showSearchSort ? sort : "relevance";

  const featuredSorted = useMemo(
    () => [...featured].sort((a, b) => a.rank - b.rank),
    [featured],
  );

  const trimmed = query.trim();
  const panelOpen = isOpen || (embedded && !hideFeaturedWhenEmpty);
  const showSearchPanel = hideFeaturedWhenEmpty ? trimmed.length >= 1 : panelOpen;

  const notifyAppNavigate = useCallback(
    (app: SearchHit | FeaturedAppLite) => {
      onNavigateToApp?.({
        id: app.id,
        name: app.name,
        artistName: app.artistName,
        artworkUrl: app.artworkUrl,
        category: app.category,
      });
    },
    [onNavigateToApp],
  );

  const debounceWaiting =
    trimmed.length >= 1 && trimmed !== debouncedQ;
  const showSearchSkeleton =
    trimmed.length >= 1 && (debounceWaiting || searchLoading);
  const showSearchResults =
    trimmed.length >= 1 && !showSearchSkeleton;
  const showEmptySearch =
    showSearchResults && searchHits.length === 0;

  const navigIds = useMemo(() => {
    if (trimmed.length >= 1) {
      if (showSearchSkeleton || showEmptySearch) return [];
      return searchHits.map((h) => h.id);
    }
    return featuredSorted.map((a) => a.id);
  }, [
    trimmed.length,
    showSearchSkeleton,
    showEmptySearch,
    searchHits,
    featuredSorted,
  ]);

  const navigIdsKey = navigIds.join("|");

  const loadFeatured = useCallback(async () => {
    setFeaturedLoading(true);
    try {
      const res = await fetch("/api/tracker/featured-apps", {
        cache: "force-cache",
      });
      const data = (await res.json()) as { apps?: FeaturedAppLite[] };
      setFeatured(Array.isArray(data.apps) ? data.apps : []);
    } catch {
      setFeatured([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hideFeaturedWhenEmpty) return;
    if (!panelOpen && featured.length === 0) return;
    if (featured.length > 0) return;
    void loadFeatured();
  }, [featured.length, hideFeaturedWhenEmpty, panelOpen, loadFeatured]);

  useEffect(() => {
    const t = trimmed;
    if (!t) {
      setDebouncedQ("");
      return;
    }
    const id = window.setTimeout(() => setDebouncedQ(t), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query, trimmed]);

  useEffect(() => {
    if (!debouncedQ) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    const ac = new AbortController();
    setSearchLoading(true);
    void (async () => {
      try {
        if (trackappLiveMetrics) {
          const res = await fetch(
            `/api/trackapp/search?q=${encodeURIComponent(debouncedQ)}&country=${storeCountry}&limit=12&sort=${searchSort}`,
            { signal: ac.signal, cache: "no-store" },
          );
          const data = (await res.json()) as { apps?: SearchResultWithTrackappMetrics[] };
          if (ac.signal.aborted) return;
          const hits = (Array.isArray(data.apps) ? data.apps : []).map(smartSearchAppToHit);
          setSearchHits(hits);
        } else {
          const quickPath = `/api/trackapp/live-search?q=${encodeURIComponent(debouncedQ)}&country=${storeCountry}&limit=12&sort=${searchSort}&quick=1`;
          const quickRes = await fetch(quickPath, { signal: ac.signal, cache: "no-store" });
          const quickData = (await quickRes.json()) as { apps?: SearchHit[] };
          const quickHits = Array.isArray(quickData.apps) ? quickData.apps : [];
          if (ac.signal.aborted) return;
          setSearchHits(quickHits);
          setSearchLoading(false);

          const ids = quickHits.map((a) => a.id).filter(Boolean);
          if (ids.length === 0) return;

          try {
            const metricsRes = await fetch("/api/trackapp/search-metrics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appIds: ids, country: storeCountry }),
              signal: ac.signal,
              cache: "no-store",
            });
            const metricsData = (await metricsRes.json()) as {
              metrics?: Record<
                string,
                {
                  revenueDisplay: string;
                  metricSource: string;
                  sortRevenueUsd: number;
                  sortDownloads: number;
                }
              >;
            };
            if (ac.signal.aborted) return;
            setSearchHits((prev) =>
              applySearchMetricsToHits(prev, metricsData.metrics ?? {}, searchSort),
            );
          } catch (metricsErr) {
            if (isAbortError(metricsErr) || ac.signal.aborted) return;
            setSearchHits((prev) => applySearchMetricsToHits(prev, {}, searchSort));
          }
          return;
        }
      } catch (e) {
        if (isAbortError(e) || ac.signal.aborted) return;
        setSearchHits([]);
      } finally {
        if (!ac.signal.aborted) setSearchLoading(false);
      }
    })().catch(() => undefined);
    return () => abortInFlightRequest(ac);
  }, [debouncedQ, storeCountry, searchSort, trackappLiveMetrics]);

  useEffect(() => {
    setHighlight(0);
  }, [navigIdsKey, trimmed, showSearchSkeleton, showEmptySearch]);

  useEffect(() => {
    if (navigIds.length === 0) return;
    if (highlight > navigIds.length - 1) {
      setHighlight(Math.max(0, navigIds.length - 1));
    }
  }, [navigIds.length, highlight]);

  useEffect(() => {
    if (!panelOpen) return;
    let el: HTMLElement | null = null;
    if (trimmed.length >= 1 && !showSearchSkeleton && !showEmptySearch && searchHits.length > 0) {
      el = document.getElementById(`${listId}-nav-s-${String(highlight)}`);
    } else if (trimmed.length < 1 && !featuredLoading && featuredSorted.length > 0) {
      el = document.getElementById(`${listId}-nav-f-${String(highlight)}`);
    }
    el?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [
    highlight,
    listId,
    panelOpen,
    trimmed,
    showSearchSkeleton,
    showEmptySearch,
    searchHits.length,
    featuredLoading,
    featuredSorted.length,
  ]);

  useEffect(() => {
    if (!panelOpen || embedded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen, embedded, onClose]);

  useEffect(() => {
    if (!panelOpen || embedded) return;
    function onDocMouseDown(e: MouseEvent) {
      const root = isLg ? stackRef.current : mobileSheetRef.current;
      if (!root?.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [panelOpen, embedded, onClose, isLg]);

  useEffect(() => {
    if (isLg || !panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isLg, panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [panelOpen]);

  function submitSearch() {
    const q = trimmed;
    if (embedded) {
      if (!q) return;
      if (searchHits.length > 0) {
        goHit(appDetailHref(searchHits[highlight]?.id ?? searchHits[0].id));
      }
      return;
    }
    if (!q) {
      startTrackerNav?.();
      router.push(
        useTrackappAccueilRoutes
          ? trackappAccueilHref({ country: storeCountry })
          : `/tracker/search?country=${storeCountry}`,
      );
      onClose();
      return;
    }
    startTrackerNav?.();
    router.push(
      useTrackappAccueilRoutes
        ? trackappAccueilHref({ country: storeCountry, q })
        : `/tracker/search?q=${encodeURIComponent(q)}&country=${storeCountry}`,
    );
    onClose();
  }

  function goHit(href: string) {
    if (!embedded) onClose();
    startTrackerNav?.();
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!panelOpen) return;
    const n = navigIds.length;
    if (n === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, n - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (trimmed.length >= 1 && !showSearchSkeleton && !showEmptySearch) {
        const hit = searchHits[highlight];
        if (hit) goHit(appDetailHref(hit.id));
      } else if (trimmed.length < 1) {
        const app = featuredSorted[highlight];
        if (app) goHit(appDetailHref(app.id));
      } else {
        submitSearch();
      }
    }
  }

  if (!embedded && !isLg && !panelOpen) {
    return null;
  }

  const searchStack = (
        <div
          ref={isLg ? stackRef : undefined}
          className={
            isLg
              ? "tracker-search-stack tracker-search-stack--desktop tracker-switcher-host w-full"
              : cn(
                  "tracker-search-stack tracker-search-stack--mobile-takeover tracker-switcher-host",
                  "w-full min-h-0",
                )
          }
          data-search-surface={searchSurface}
        >
          <form
            role="search"
            className="tracker-search-pill"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            onMouseDown={(e) => {
              if (!isLg || e.button !== 0) return;
              const t = e.target as HTMLElement;
              if (t.closest("input")) return;
              e.preventDefault();
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <svg
              className="tracker-search-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              ref={inputRef}
              id="tracker-search-combobox"
              type="text"
              name="tracker-app-search"
              inputMode="search"
              enterKeyHint="search"
              role="combobox"
              className="tracker-search-input"
              placeholder={
                hideFeaturedWhenEmpty
                  ? "Rechercher une app…"
                  : isLg && !panelOpen
                    ? "Rechercher…"
                    : "Rechercher une app…"
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-expanded={panelOpen}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-controls={panelOpen ? "tracker-search-panel" : undefined}
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (v.trim().length >= 1) setSearchLoading(true);
                else {
                  setSearchHits([]);
                  setSearchLoading(false);
                }
              }}
              onFocus={() => {
                onOpen?.();
              }}
              onKeyDown={onInputKeyDown}
            />
            {showSearchSort ? (
              <>
                <span className="tracker-search-pill-divider" aria-hidden />
                <label className="sr-only" htmlFor="tracker-search-sort">
                  Trier les résultats
                </label>
                <select
                  id="tracker-search-sort"
                  className="tracker-search-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as TrackappSearchSort)}
                  aria-label="Trier les résultats"
                >
                  {TRACKAPP_SEARCH_SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {query.trim() && (embedded || !isLg) ? (
              <button
                type="button"
                className="tracker-search-pill-dismiss"
                onClick={() => {
                  setQuery("");
                  setSearchHits([]);
                  setSearchLoading(false);
                }}
                aria-label="Effacer la recherche"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
            {!isLg && !embedded ? (
              <button
                type="button"
                className="tracker-search-pill-dismiss"
                onClick={() => onClose()}
                aria-label="Fermer la recherche"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </form>

          {showSearchPanel ? (
          <div
            id="tracker-search-panel"
            role="region"
            aria-label="Recherche App Store"
            className="tracker-search-panel tracker-search-panel--dark"
          >
              <div role="list" className="min-h-0">
                {showSearchSkeleton
                  ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                      <div
                        key={`sk-${String(i)}`}
                        role="presentation"
                        className="tracker-search-row tracker-search-row--skeleton"
                      >
                        <div className="tracker-search-row-art tracker-search-skel-icon" />
                        <div className="tracker-search-row-main flex-1 space-y-2 py-0.5">
                          <div className="tracker-search-skel-line w-[72%]" />
                          <div className="tracker-search-skel-line w-[48%] opacity-70" />
                          <div className="flex gap-2 pt-1">
                            <div className="tracker-search-skel-pill w-14" />
                            <div className="tracker-search-skel-pill w-24 opacity-80" />
                          </div>
                          <div className="tracker-search-skel-line w-[55%] opacity-50" />
                        </div>
                        <div className="tracker-search-stat-col items-end gap-1.5 py-0.5">
                          <div className="tracker-search-skel-line w-14" />
                          <div className="tracker-search-skel-line w-10 opacity-60" />
                        </div>
                      </div>
                    ))
                  : null}

                {showEmptySearch ? (
                  <p className="px-4 py-10 text-center text-sm text-zinc-500">
                    Aucun résultat pour « {trimmed} »
                  </p>
                ) : null}

                {!showSearchSkeleton &&
                showSearchResults &&
                searchHits.map((app, idx) => {
                  const selected = idx === highlight;
                  const categoryLabel = formatSearchCategoryLabel(app.category);

                  return (
                    <TrackerNavLink
                      key={app.id}
                      id={`${listId}-nav-s-${String(idx)}`}
                      role="listitem"
                      href={appDetailHref(app.id)}
                      className={`tracker-search-row tracker-search-row--dark tracker-search-row--live tracker-touch ${selected ? "tracker-search-row--active" : "tracker-rise"}`}
                      style={
                        selected
                          ? undefined
                          : { animationDelay: `${Math.min(idx, 12) * 22}ms` }
                      }
                      prefetchOnHover={idx < 6}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => {
                        notifyAppNavigate(app);
                        if (!embedded) onClose();
                      }}
                    >
                      <div className="tracker-search-row-art relative bg-zinc-800">
                        <TrackerAppArtwork
                          url={app.artworkUrl}
                          name={app.name}
                          sizes="52px"
                          letterClassName="text-lg text-zinc-500"
                        />
                      </div>

                      <div className="tracker-search-row-main tracker-search-row-main--live min-w-0 flex-1">
                        <div className="tracker-search-row-title tracker-search-row-title--dark line-clamp-2">
                          {app.name}
                        </div>
                        {categoryLabel ? (
                          <span className="tracker-search-chip tracker-search-chip--dark tracker-search-chip--category mt-1.5 inline-block max-w-full truncate">
                            {categoryLabel}
                          </span>
                        ) : null}
                      </div>

                      <div className="tracker-search-stat-col tracker-search-stat-col--live shrink-0 self-center">
                        <SearchRevenueValue revenueDisplay={app.revenueDisplay} />
                      </div>

                      <span className="tracker-search-chevron tracker-search-chevron--dark" aria-hidden>
                        ›
                      </span>
                    </TrackerNavLink>
                  );
                })}

                {!hideFeaturedWhenEmpty && !showSearchSkeleton && trimmed.length < 1 ? (
                  <>
                    {featuredLoading && featuredSorted.length === 0
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={`fsk-${String(i)}`}
                            role="presentation"
                            className="tracker-search-row tracker-search-row--skeleton"
                          >
                            <div className="tracker-search-row-art tracker-search-skel-icon" />
                            <div className="tracker-search-row-main flex-1 space-y-2 py-0.5">
                              <div className="tracker-search-skel-line w-[68%]" />
                              <div className="tracker-search-skel-line w-[44%] opacity-70" />
                            </div>
                          </div>
                        ))
                      : null}

                    {!featuredLoading && featuredSorted.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-zinc-500">
                        Aucune suggestion pour le moment.
                      </p>
                    ) : null}

                    {featuredSorted.map((app, idx) => {
                      const categoryLabel = formatSearchCategoryLabel(app.category);
                      const selected = idx === highlight;

                      return (
                        <TrackerNavLink
                          key={`${app.id}-f-${String(idx)}`}
                          id={`${listId}-nav-f-${String(idx)}`}
                          role="listitem"
                          href={appDetailHref(app.id)}
                          className={`tracker-search-row tracker-search-row--dark tracker-search-row--live tracker-touch ${selected ? "tracker-search-row--active" : "tracker-rise"}`}
                          style={
                            selected
                              ? undefined
                              : { animationDelay: `${Math.min(idx, 12) * 28}ms` }
                          }
                          prefetchOnHover={idx < 4}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => {
                            if (!embedded) onClose();
                          }}
                        >
                          <div className="tracker-search-row-art relative bg-zinc-800">
                            <TrackerAppArtwork url={app.artworkUrl} name={app.name} sizes="52px" letterClassName="text-lg text-zinc-500" />
                          </div>

                          <div className="tracker-search-row-main tracker-search-row-main--live min-w-0 flex-1">
                            <div className="tracker-search-row-title tracker-search-row-title--dark line-clamp-2">
                              {app.name}
                            </div>
                            <span className="tracker-search-chip tracker-search-chip--dark tracker-search-chip--category mt-1.5 inline-block">
                              {`${storeCc} · #${String(app.rank)}`}
                              {categoryLabel ? ` · ${categoryLabel}` : ""}
                            </span>
                          </div>

                          <span className="tracker-search-chevron tracker-search-chevron--dark" aria-hidden>
                            ›
                          </span>
                        </TrackerNavLink>
                      );
                    })}
                  </>
                ) : null}
              </div>

              {!embedded ? (
                <div className="tracker-search-panel-footer tracker-search-panel-footer--dark">
                  <div className="tracker-search-kbd-hints hidden lg:flex">
                    <span className="tracker-kbd-group">
                      <kbd className="tracker-kbd">↑</kbd>
                      <kbd className="tracker-kbd">↓</kbd>
                      <span>naviguer</span>
                    </span>
                    <span className="tracker-kbd-group">
                      <kbd className="tracker-kbd">ret</kbd>
                      <span>ouvrir</span>
                    </span>
                    <span className="tracker-kbd-group">
                      <kbd className="tracker-kbd">esc</kbd>
                      <span>fermer</span>
                    </span>
                  </div>
                  <TrackerNavLink
                    href={
                      useTrackappAccueilRoutes
                        ? trackappAccueilHref({ country: storeCountry })
                        : `/tracker/search?country=${storeCountry}`
                    }
                    className="tracker-search-advanced-link"
                    onClick={() => onClose()}
                  >
                    Recherche avancée →
                  </TrackerNavLink>
                </div>
              ) : null}
          </div>
          ) : null}
        </div>
  );

  if (embedded || isLg) {
    return <div className="tracker-search-desktop-host w-full">{searchStack}</div>;
  }

  const sheetEase = motionLite
    ? { duration: 0.14 }
    : { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.78 };
  const sheetEnter = motionLite ? { opacity: 1, y: 0 } : { opacity: 0, y: -26, scale: 0.966 };
  const sheetExit = motionLite ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.978 };
  const fadeEase = motionLite
    ? { duration: 0.12 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  return createPortal(
    <AnimatePresence mode="sync">
      {panelOpen ? (
        <>
          <motion.button
            key="tracker-msearch-backdrop"
            type="button"
            aria-hidden
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeEase}
            className="tracker-mobile-search-backdrop-fixed"
            onClick={() => onClose()}
          />

          <motion.div
            ref={mobileSheetRef}
            key="tracker-msearch-sheet"
            id="tracker-search-popover"
            role="dialog"
            aria-modal="true"
            aria-label="Rechercher dans le tracker"
            layout={false}
            initial={sheetEnter}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={sheetExit}
            transition={sheetEase}
            className="tracker-mobile-search-sheet-fixed"
          >
            <div className="tracker-mobile-search-body">{searchStack}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
