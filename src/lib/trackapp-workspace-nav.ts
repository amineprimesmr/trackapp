import { isTrackappCreerDepuisAppPath } from "@/lib/trackapp-app-clone-paths";
import { isTrackappCreerUneAppPath } from "@/lib/trackapp-applab-create/paths";
import { TRACKAPP_LANDING_PATH } from "@/lib/trackapp-landing-paths";
import { isTrackappApplabAppPath } from "@/lib/trackapp-applab-paths";
import {
  isTrackappAccueilAppDetailPath,
  TRACKAPP_ACCUEIL_BASE,
} from "@/lib/trackapp-apptracker-paths";
import {
  isTrackappAdsPath,
  isTrackappApptrackerPath,
  isTrackappMarketingPath,
  isTrackappOrganiquePath,
  TRACKAPP_APPTRACKER_PATH,
} from "@/lib/trackapp-tools-paths";

export type TrackappNavItem = Readonly<{
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
  soon?: boolean;
}>;

/** Navigation legacy — le menu studio n'utilise plus cette liste. */
export const TRACKAPP_NAV_ITEMS: readonly TrackappNavItem[] = [];

export const TRACKAPP_NAV_GROUPS = [
  {
    id: "main",
    label: "Trackapp",
    defaultOpen: true,
    items: TRACKAPP_NAV_ITEMS,
  },
] as const;

export type TrackappBreadcrumb = Readonly<{
  sectionLabel: string;
  pageLabel: string;
  hubLabel?: string;
  hubHref?: string;
}>;

export function resolveTrackappBreadcrumb(pathname: string): TrackappBreadcrumb {
  if (isTrackappAccueilAppDetailPath(pathname)) {
    return {
      sectionLabel: "Outils",
      hubLabel: "Apptracker",
      hubHref: TRACKAPP_APPTRACKER_PATH,
      pageLabel: "Fiche app",
    };
  }

  if (isTrackappApplabAppPath(pathname)) {
    return {
      sectionLabel: "AppLAB",
      hubLabel: "AppLAB",
      hubHref: TRACKAPP_LANDING_PATH,
      pageLabel: "App",
    };
  }

  if (isTrackappCreerUneAppPath(pathname) || pathname.startsWith("/trackapp/creer-mon-app")) {
    return { sectionLabel: "Trackapp", pageLabel: "App Studio" };
  }

  if (isTrackappCreerDepuisAppPath(pathname)) {
    return {
      sectionLabel: "AppLAB",
      hubLabel: "AppLAB",
      hubHref: TRACKAPP_LANDING_PATH,
      pageLabel: "Export",
    };
  }

  if (isTrackappApptrackerPath(pathname)) {
    return { sectionLabel: "Outils", pageLabel: "Apptracker" };
  }

  if (pathname === TRACKAPP_ACCUEIL_BASE) {
    return { sectionLabel: "Outils", pageLabel: "Apptracker" };
  }

  if (pathname.startsWith("/trackapp/gagner-240")) {
    return { sectionLabel: "Trackapp", pageLabel: "Affiliation" };
  }

  if (isTrackappMarketingPath(pathname) || isTrackappAdsPath(pathname) || isTrackappOrganiquePath(pathname)) {
    return { sectionLabel: "Outils", pageLabel: "Marketing Studio" };
  }

  if (pathname.startsWith("/trackapp/logiciels")) {
    return { sectionLabel: "Outils", pageLabel: "Logiciels" };
  }

  return { sectionLabel: "Trackapp", pageLabel: "App Studio" };
}

export function isNavItemActive(pathname: string, item: TrackappNavItem): boolean {
  if (item.soon) return false;
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
