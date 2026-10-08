"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 8 1.27-1.73A2 2 0 0 1 8.72 5h6.56a2 2 0 0 1 1.45.63L18 8" />
    <path d="M20 19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
  </svg>
);

const IconFolderSmall = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
    <path d="m6 9 1.13-1.55A1.74 1.74 0 0 1 8.26 6h7.48c.52 0 1.02.24 1.35.64L18 9" />
    <path d="M19 18.25A1.75 1.75 0 0 1 17.25 20H6.75A1.75 1.75 0 0 1 5 18.25V9.75A1.75 1.75 0 0 1 6.75 8h10.5A1.75 1.75 0 0 1 19 9.75Z" />
  </svg>
);

const IconChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const SUBLINKS = [
  { href: "/trackapp/favoris/apps", label: "Apps" },
] as const;

export function TrackappSidebarFavoritesGroup({
  pathname,
  onNavigate,
}: Readonly<{
  pathname: string;
  onNavigate?: () => void;
}>) {
  const inFavorites = pathname.startsWith("/trackapp/favoris");
  const [open, setOpen] = useState(inFavorites);

  useEffect(() => {
    if (inFavorites) setOpen(true);
  }, [inFavorites]);

  return (
    <div className="trackapp-sidebar-favorites border-t border-white/[0.08] pt-2">
      <button
        type="button"
        className="app-sidebar-link flex w-full items-center gap-2 rounded-[var(--app-radius-sm)] px-2 py-2 text-left text-[var(--app-sidebar-text-muted)] transition-colors duration-200 hover:bg-[var(--app-sidebar-hover)] hover:text-[var(--app-sidebar-text)]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="app-sidebar-icon flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-[1.1rem] [&>svg]:w-[1.1rem]">
          <IconFolder />
        </span>
        <span className="app-sidebar-link-text min-w-0 flex-1 truncate whitespace-nowrap font-medium">Favoris</span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center text-[var(--app-sidebar-text-muted)] opacity-80 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        >
          <IconChevronDown />
        </span>
      </button>

      {open ? (
        <div className="relative mt-0.5 pl-2">
          <div className="absolute bottom-1 left-[15px] top-1 w-px bg-white/14" aria-hidden />
          <ul className="relative z-[1] m-0 list-none space-y-px py-0.5 pl-4">
            {SUBLINKS.map((s) => {
              const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    data-section="favoris"
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "app-sidebar-link flex items-center gap-2 rounded-[var(--app-radius-sm)] px-2 py-2 pr-1 text-[0.74rem] text-[var(--app-sidebar-text-muted)] transition-colors duration-200",
                      "hover:bg-[var(--app-sidebar-hover)] hover:text-[var(--app-sidebar-text)]",
                      active &&
                        "app-sidebar-link-active bg-[var(--app-sidebar-active)] font-semibold text-[var(--app-sidebar-text)]",
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center opacity-85 [&>svg]:h-[0.95rem] [&>svg]:w-[0.95rem]">
                      <IconFolderSmall />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center opacity-50" aria-hidden>
                      <IconChevronRight />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
