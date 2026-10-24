"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store/AppStore";
import { calendarLabel } from "@/lib/ui/calendarLabel";
import { Onboarding } from "./Onboarding";

const NAV = [
  { href: "/", label: "This Week", icon: "☀︎" },
  { href: "/discover", label: "Discover", icon: "✦" },
  { href: "/hobbies", label: "Hobbies", icon: "◐" },
  { href: "/my-life", label: "My Life", icon: "❖" },
  { href: "/wrapped", label: "Wrapped", icon: "★" },
  { href: "/settings", label: "Settings", icon: "⚙︎" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { ready, state, loadError, storageAvailable, snapshot, mode, syncError } = useStore();

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:p-2">
        Skip to content
      </a>
      <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-5 sm:px-6">
        <Link href="/" className="font-serif text-xl tracking-tight sm:text-2xl">
          Your Life <span className="italic text-accent">Curator</span>
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          aria-current={isActive(path, "/settings") ? "page" : undefined}
          className={`rounded-full px-2 py-1 text-lg sm:hidden ${isActive(path, "/settings") ? "text-accent" : "text-muted"}`}
        >
          ⚙︎
        </Link>
        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={isActive(path, n.href) ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 ${isActive(path, n.href) ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="px-4 sm:px-6">
        <p className="rounded-md border border-line bg-warn-soft px-3 py-2 text-xs text-warn" role="note">
          <strong>Sample events.</strong> All events are fictional samples, and {calendarLabel(state.calendarMode, snapshot)}. Nothing here is real or bookable yet.
          {mode === "local" && " This preview keeps your changes in this browser only."}
          {mode === "local" && !storageAvailable && " Your browser storage is unavailable, so changes won't be kept after you leave."}
        </p>
      </div>

      {syncError && (
        <div className="px-4 pt-2 sm:px-6" role="alert">
          <p className="rounded-md bg-bad-soft px-3 py-2 text-xs text-bad">{syncError} Your last change was undone — please try again.</p>
        </div>
      )}

      <main id="main" className="flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pb-12">
        {loadError ? (
          <div role="alert" className="rounded-lg border border-line bg-bad-soft p-4 text-bad">
            {loadError} Please reload to try again.
          </div>
        ) : !ready ? (
          <LoadingState />
        ) : !state.onboarded ? (
          <Onboarding />
        ) : (
          children
        )}
      </main>

      <nav aria-label="Main mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur sm:hidden">
        <ul className="mx-auto flex max-w-md justify-around">
          {NAV.filter((n) => n.href !== "/settings").map((n) => (
            <li key={n.href} className="flex-1">
              <Link
                href={n.href}
                aria-current={isActive(path, n.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${isActive(path, n.href) ? "text-accent" : "text-muted"}`}
              >
                <span aria-hidden className="text-base leading-none">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading your recommendations…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-line/50" />
      ))}
    </div>
  );
}
