"use client";

import { Space_Grotesk } from "next/font/google";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import { isTrackappCreerUneAppPath } from "@/lib/trackapp-applab-create/paths";
import { isTrackappLiteFullscreenPath } from "@/lib/trackapp-lite-paths";
import { TrackerLiquidGlassFilterSvg } from "@/components/tracker/tracker-liquid-glass-filter-svg";
import { TrackappBodyClass } from "@/components/trackapp/trackapp-body-class";
import { TrackappFidelitySidebar } from "@/components/trackapp/trackapp-fidelity-sidebar";
import { TrackappLandingTopNav } from "@/components/trackapp/trackapp-landing-top-nav";
import { cn } from "@/lib/utils";

import "@/styles/trackapp-lab-nav.css";
import "@/styles/trackapp-landing-top-nav.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

function readStoredSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem("trackapp:sidebar-collapsed") === "1";
  } catch {
    return false;
  }
}

function landingSidebarCollapsed(pathname: string): boolean {
  return isTrackappCreerUneAppPath(pathname);
}

export function TrackappFidelityWorkspaceShell({
  children,
  loggedIn,
  email,
  signOutHref,
}: Readonly<{
  children: React.ReactNode;
  loggedIn: boolean;
  email?: string | undefined;
  signOutHref: string;
}>) {
  const pathname = usePathname() ?? "";
  const isApplabCreatePage = isTrackappCreerUneAppPath(pathname);
  const isLiteFullscreen = isTrackappLiteFullscreenPath(pathname);
  /** Landing `/trackapp` — jamais de sidebar workspace (connecté ou non). */
  const isLandingPage = isApplabCreatePage;
  const hideWorkspaceChrome = isLiteFullscreen || isLandingPage;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    if (landingSidebarCollapsed(window.location.pathname)) return true;
    return readStoredSidebarCollapsed();
  });

  useLayoutEffect(() => {
    if (landingSidebarCollapsed(pathname)) {
      setSidebarCollapsed(true);
      return;
    }
    setSidebarCollapsed(readStoredSidebarCollapsed());
  }, [pathname]);

  useLayoutEffect(() => {
    const el = document.getElementById("app-app");
    if (!el) return;
    el.classList.remove(
      "app-saas-welcome-active",
      "app-saas-trial-chrome-active",
      "app-settings-sheet-open",
      "app-settings-sheet-closing",
    );
    document.querySelectorAll<HTMLElement>(".app-settings-backdrop.is-open").forEach((node) => {
      node.classList.remove("is-open");
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const closeMobile = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    if (mobileMenuOpen) document.body.classList.add("app-mobile-menu-open");
    else document.body.classList.remove("app-mobile-menu-open");
    return () => document.body.classList.remove("app-mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("trackapp:sidebar-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  const effectiveCollapsed = isMobile ? false : sidebarCollapsed;

  return (
    <>
      <TrackappBodyClass active />
      <div
        id="app-app"
        className={cn("app-unified-shell", spaceGrotesk.variable)}
        data-mobile-section="dashboard"
        data-sidebar-expanded={effectiveCollapsed ? "false" : "true"}
        data-route-kind={
          isLandingPage ? "landing-guest"
          : isLiteFullscreen ? "lite-fullscreen"
          : "workspace"
        }
      >
        <TrackerLiquidGlassFilterSvg />

        {!hideWorkspaceChrome ? (
          <>
            <button
              type="button"
              className={mobileMenuOpen ? "app-sidebar-overlay is-open" : "app-sidebar-overlay"}
              id="app-sidebar-overlay"
              aria-label="Fermer le menu"
              aria-hidden={!mobileMenuOpen}
              onClick={closeMobile}
            />

            <TrackappFidelitySidebar
              pathname={pathname}
              mobileMenuOpen={mobileMenuOpen}
              onNavigate={closeMobile}
              email={email}
              signOutHref={signOutHref}
              loggedIn={loggedIn}
              collapsed={effectiveCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
            />

            <button
              type="button"
              className={cn("trackapp-mobile-menu-btn", mobileMenuOpen && "is-open")}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span aria-hidden />
              <span aria-hidden />
              <span aria-hidden />
            </button>
          </>
        ) : null}

        {isLandingPage ? (
          <TrackappLandingTopNav loggedIn={loggedIn} signOutHref={signOutHref} />
        ) : null}

        <main className="app-main">
          <div className="app-content">{children}</div>
        </main>
      </div>
    </>
  );
}
