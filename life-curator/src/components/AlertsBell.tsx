"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store/AppStore";

/** Header link to the alert list, with an unread count. */
export function AlertsBell() {
  const { mode } = useStore();
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (mode !== "server") return;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { unread?: number } | null) => setUnread(b?.unread ?? 0))
      .catch(() => undefined);
  }, [mode, path]);
  if (mode !== "server") return null;
  return (
    <Link
      href="/alerts"
      aria-label={unread ? `Alerts, ${unread} new` : "Alerts"}
      aria-current={path.startsWith("/alerts") ? "page" : undefined}
      className={`relative rounded-full px-2 py-1 text-lg ${path.startsWith("/alerts") ? "text-accent" : "text-muted hover:text-ink"}`}
    >
      <span aria-hidden>🔔︎</span>
      {unread > 0 && (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-medium leading-4 text-accent-ink">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
