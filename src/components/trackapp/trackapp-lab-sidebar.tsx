"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  IconNavSparkle,
  IconPanelClose,
  IconPanelOpen,
  IconSearch,
} from "@/components/trackapp/trackapp-lab-nav-icons";
import { TrackappLogoMark } from "@/components/trackapp/trackapp-logo-mark";
import { TrackappSidebarFooter } from "@/components/trackapp/trackapp-sidebar-footer";
import {
  APPLAB_DRAFT_CHANGE_EVENT,
  defaultApplabCreateDraft,
  readApplabCreateDraft,
  writeApplabCreateDraft,
} from "@/lib/trackapp-applab-create/storage";
import { trackappGuestNavHref, TRACKAPP_LANDING_PATH } from "@/lib/trackapp-landing-paths";
import { TRACKAPP_APPTRACKER_PATH } from "@/lib/trackapp-tools-paths";
import { cn } from "@/lib/utils";

type ProjectEntry = Readonly<{
  name: string;
  inProgress: boolean;
  artworkUrl: string | null;
}>;

function readProjectEntry(): ProjectEntry | null {
  const draft = readApplabCreateDraft();
  const name = draft?.name?.trim() ?? "";
  if (name.length < 2) return null;
  return {
    name,
    inProgress: !draft?.setupComplete,
    artworkUrl: draft?.referenceAppArtworkUrl ?? null,
  };
}

function SidebarLogoToggle({
  collapsed,
  onToggle,
  compact,
}: Readonly<{
  collapsed: boolean;
  onToggle?: () => void;
  compact?: boolean;
}>) {
  return (
    <button
      type="button"
      className={cn("trackapp-studio-sidebar__logo", compact && "trackapp-studio-sidebar__logo--compact")}
      aria-label={collapsed ? "Ouvrir le menu" : "Ranger le menu"}
      aria-pressed={collapsed}
      onClick={onToggle}
    >
      <span className="trackapp-studio-sidebar__logo-face trackapp-studio-sidebar__logo-face--brand" aria-hidden>
        <TrackappLogoMark size="xs" className="trackapp-studio-sidebar__logo-img" decorative />
      </span>
      <span className="trackapp-studio-sidebar__logo-face trackapp-studio-sidebar__logo-face--action" aria-hidden>
        {collapsed ? (
          <IconPanelOpen className="trackapp-studio-sidebar__panel-icon" />
        ) : (
          <IconPanelClose className="trackapp-studio-sidebar__panel-icon" />
        )}
      </span>
    </button>
  );
}

function ToolLink({
  href,
  label,
  icon: Icon,
  tone = "blue",
  collapsed,
  active = false,
  onNavigate,
  loggedIn = true,
}: Readonly<{
  href: string;
  label: string;
  icon: typeof IconNavSparkle;
  tone?: "blue" | "neutral";
  collapsed?: boolean;
  active?: boolean;
  onNavigate?: () => void;
  loggedIn?: boolean;
}>) {
  const resolvedHref = trackappGuestNavHref(href, loggedIn);

  return (
    <Link
      href={resolvedHref}
      className={cn(
        "trackapp-studio-sidebar__tool",
        collapsed && "trackapp-studio-sidebar__tool--collapsed",
        active && "is-active",
      )}
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate?.()}
    >
      <span className={cn("trackapp-studio-sidebar__tool-icon", tone === "blue" && "trackapp-studio-sidebar__tool-icon--blue")}>
        <Icon className="h-[16px] w-[16px]" />
      </span>
      {!collapsed ? <span className="trackapp-studio-sidebar__tool-label">{label}</span> : null}
    </Link>
  );
}

function ToolComingSoon({
  label,
  icon: Icon,
  tone = "blue",
  collapsed,
  hint = "Coming soon",
}: Readonly<{
  label: string;
  icon: typeof IconNavSparkle;
  tone?: "blue" | "neutral";
  collapsed?: boolean;
  hint?: string;
}>) {
  return (
    <span
      tabIndex={0}
      className={cn(
        "trackapp-studio-sidebar__tool trackapp-studio-sidebar__tool--coming-soon",
        collapsed && "trackapp-studio-sidebar__tool--collapsed",
      )}
      role="status"
      aria-label={`${label} — ${hint}`}
      aria-disabled="true"
      title={hint}
    >
      <span className={cn("trackapp-studio-sidebar__tool-icon", tone === "blue" && "trackapp-studio-sidebar__tool-icon--blue")}>
        <Icon className="h-[16px] w-[16px]" />
      </span>
      {!collapsed ? <span className="trackapp-studio-sidebar__tool-label">{label}</span> : null}
      <span className="trackapp-studio-sidebar__tool-hint" aria-hidden>
        {hint}
      </span>
    </span>
  );
}

export function TrackappLabSidebar({
  pathname,
  mobileMenuOpen,
  onNavigate,
  email,
  signOutHref,
  loggedIn = false,
  collapsed = false,
  onToggleCollapse,
}: Readonly<{
  pathname: string;
  mobileMenuOpen: boolean;
  onNavigate?: () => void;
  email?: string;
  signOutHref?: string;
  loggedIn?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}>) {
  const router = useRouter();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [project, setProject] = useState<ProjectEntry | null>(null);

  const refreshProject = useCallback(() => {
    setProject(readProjectEntry());
  }, []);

  useEffect(() => {
    refreshProject();
    window.addEventListener(APPLAB_DRAFT_CHANGE_EVENT, refreshProject);
    window.addEventListener("storage", refreshProject);
    return () => {
      window.removeEventListener(APPLAB_DRAFT_CHANGE_EVENT, refreshProject);
      window.removeEventListener("storage", refreshProject);
    };
  }, [refreshProject, pathname]);

  const startNewProject = useCallback(() => {
    writeApplabCreateDraft(defaultApplabCreateDraft());
    refreshProject();
    if (pathname !== TRACKAPP_LANDING_PATH) {
      router.push(TRACKAPP_LANDING_PATH);
    } else {
      window.location.href = TRACKAPP_LANDING_PATH;
    }
    onNavigate?.();
  }, [onNavigate, pathname, refreshProject, router]);

  const openApptracker = useCallback(() => {
    const target = trackappGuestNavHref(TRACKAPP_APPTRACKER_PATH, Boolean(loggedIn));
    if (pathname !== TRACKAPP_APPTRACKER_PATH || !loggedIn) {
      router.push(target);
    }
    onNavigate?.();
  }, [loggedIn, onNavigate, pathname, router]);

  const isOnStudio =
    pathname === TRACKAPP_LANDING_PATH || pathname.startsWith(`${TRACKAPP_LANDING_PATH}?`);
  const projectActive = isOnStudio && Boolean(project);

  return (
    <>
      <aside
        id="app-sidebar"
        className={cn(
          "app-sidebar trackapp-lab-sidebar trackapp-studio-sidebar hidden md:flex flex-col fixed inset-y-0 left-0 z-[90]",
          mobileMenuOpen && "is-mobile-open",
          collapsed && "trackapp-lab-sidebar--collapsed trackapp-studio-sidebar--collapsed",
        )}
        aria-label="Navigation Trackapp"
      >
        <span id="app-business-name" className="app-business-name-hidden" aria-hidden>
          Trackapp
        </span>

        <div className="trackapp-studio-sidebar__head">
          <div className={cn("trackapp-studio-sidebar__brand", collapsed && "trackapp-studio-sidebar__brand--collapsed")}>
            <SidebarLogoToggle collapsed={collapsed} onToggle={onToggleCollapse} compact={collapsed} />
            {!collapsed ? <p className="trackapp-studio-sidebar__brand-name">Trackapp</p> : null}
          </div>
          {!collapsed ? (
            <button
              type="button"
              className="trackapp-studio-sidebar__head-toggle"
              aria-label="Ranger le menu"
              onClick={onToggleCollapse}
            >
              <IconPanelClose className="h-[18px] w-[18px]" />
            </button>
          ) : null}
        </div>

        <nav className="trackapp-studio-sidebar__nav app-sidebar-nav flex-1 overflow-y-auto overflow-x-hidden" aria-label="Menu principal">
          <div className="trackapp-studio-sidebar__actions">
            <button
              type="button"
              className={cn("trackapp-studio-sidebar__action", collapsed && "trackapp-studio-sidebar__action--icon-only")}
              title="Nouveau projet"
              onClick={startNewProject}
            >
              <span className="trackapp-studio-sidebar__action-plus" aria-hidden>
                +
              </span>
              {!collapsed ? <span>Nouveau projet</span> : null}
            </button>

            <button
              type="button"
              className={cn(
                "trackapp-studio-sidebar__action trackapp-studio-sidebar__action--muted",
                collapsed && "trackapp-studio-sidebar__action--icon-only",
              )}
              title="Chercher une app"
              onClick={openApptracker}
            >
              <IconSearch className="trackapp-studio-sidebar__action-search" />
              {!collapsed ? <span>Chercher une app</span> : null}
            </button>
          </div>

          <div className="trackapp-studio-sidebar__section">
            {!collapsed ? <p className="trackapp-studio-sidebar__section-label">Outils</p> : null}
            <div className="trackapp-studio-sidebar__tools">
              <ToolLink
                href={TRACKAPP_APPTRACKER_PATH}
                label="Apptracker"
                icon={IconSearch}
                collapsed={collapsed}
                active={pathname === TRACKAPP_APPTRACKER_PATH}
                onNavigate={onNavigate}
                loggedIn={loggedIn}
              />
              <ToolComingSoon label="Marketing Studio" icon={IconNavSparkle} collapsed={collapsed} />
            </div>
          </div>

          {project ? (
            <div className="trackapp-studio-sidebar__section">
              {!collapsed ? (
                <button
                  type="button"
                  className="trackapp-studio-sidebar__section-toggle"
                  aria-expanded={projectsOpen}
                  onClick={() => setProjectsOpen((v) => !v)}
                >
                  <span>Projets</span>
                  <span className={cn("trackapp-studio-sidebar__chevron", projectsOpen && "is-open")} aria-hidden>
                    ⌃
                  </span>
                </button>
              ) : null}

              {(collapsed || projectsOpen) && (
                <div className="trackapp-studio-sidebar__projects">
                  <Link
                    href={TRACKAPP_LANDING_PATH}
                    className={cn(
                      "trackapp-studio-sidebar__project",
                      projectActive && "is-active",
                      collapsed && "trackapp-studio-sidebar__project--collapsed",
                    )}
                    title={project.name}
                    onClick={() => onNavigate?.()}
                  >
                    <span className="trackapp-studio-sidebar__project-art" aria-hidden>
                      {project.artworkUrl ? (
                        <Image src={project.artworkUrl} alt="" width={36} height={36} unoptimized />
                      ) : (
                        <span className="trackapp-studio-sidebar__project-art-fallback">✦</span>
                      )}
                    </span>
                    {!collapsed ? (
                      <span className="trackapp-studio-sidebar__project-name">{project.name}</span>
                    ) : null}
                    {!collapsed && project.inProgress ? (
                      <span className="trackapp-studio-sidebar__project-badge">···</span>
                    ) : null}
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </nav>

        <TrackappSidebarFooter
          email={email}
          signOutHref={signOutHref ?? "/trackapp/deconnexion"}
          onNavigate={onNavigate}
          collapsed={collapsed}
          loggedIn={loggedIn}
        />
      </aside>

    </>
  );
}
