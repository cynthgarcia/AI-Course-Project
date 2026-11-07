"use client";

import { useState } from "react";
import type { CuratorEvent } from "@/lib/domain/types";
import { eventToIcs, googleCalendarUrl, icsFileName, outlookWebUrl } from "@/lib/ui/calendarLinks";
import { btn } from "./ui";

/** Offers to put an event in the user's own calendar. The user saves it there themselves. */
export function AddToCalendar({ event, prompt = false }: { event: CuratorEvent; prompt?: boolean }) {
  const [open, setOpen] = useState(prompt);
  if (event.isDemo) {
    return prompt ? <p className="text-xs text-muted">Sample events can&rsquo;t be added to your calendar.</p> : null;
  }
  const downloadIcs = () => {
    const blob = new Blob([eventToIcs(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(event);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!open) {
    return (
      <button type="button" className={btn.secondary} onClick={() => setOpen(true)}>
        Add to calendar
      </button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-lg border border-line bg-card p-3 text-sm" role="group" aria-label="Add to calendar">
      <p className="font-medium">{prompt ? "Add it to your calendar?" : "Add to calendar"}</p>
      <div className="flex flex-wrap gap-2">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={btn.primary}>
          Google Calendar
        </a>
        <button type="button" className={btn.secondary} onClick={downloadIcs}>
          Apple / Outlook (.ics)
        </button>
        <a href={outlookWebUrl(event)} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
          Outlook.com
        </a>
        {prompt && (
          <button type="button" className={btn.quiet} onClick={() => setOpen(false)}>
            Not now
          </button>
        )}
      </div>
      <p className="text-xs text-muted">Your calendar opens with the details filled in — you choose whether to save it.</p>
    </div>
  );
}
