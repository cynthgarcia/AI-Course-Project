// "Add to calendar" without any calendar permission: a pre-filled Google Calendar page the
// user saves themselves, or an .ics file for Apple Calendar / Outlook. Nothing is written
// to anyone's calendar by the app.
import { ASSUMED_DURATION_MINUTES } from "@/lib/domain/availability";
import type { CuratorEvent } from "@/lib/domain/types";

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function times(e: CuratorEvent): { start: number; end: number; assumedEnd: boolean } {
  const start = Date.parse(e.start);
  const end = e.end ? Date.parse(e.end) : start + ASSUMED_DURATION_MINUTES * 60_000;
  return { start, end, assumedEnd: !e.end };
}

function details(e: CuratorEvent, assumedEnd: boolean): string {
  return [
    e.officialUrl ? `Event page: ${e.officialUrl}` : null,
    e.bookingUrl && e.bookingUrl !== e.officialUrl ? `Tickets: ${e.bookingUrl}` : null,
    e.dressCode ? `Dress code: ${e.dressCode}` : null,
    assumedEnd ? "End time not published — about 2 hours assumed." : null,
    "Added from Off Hours.",
  ]
    .filter(Boolean)
    .join("\n");
}

function location(e: CuratorEvent): string {
  return [e.venue.name, e.venue.address ?? (e.venue.neighborhood ? `${e.venue.neighborhood}, ${e.venue.city}` : e.venue.city)].filter(Boolean).join(", ");
}

export function googleCalendarUrl(e: CuratorEvent): string {
  const t = times(e);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(t.start)}/${stamp(t.end)}`,
    details: details(e, t.assumedEnd),
    location: location(e),
    ctz: e.timezone,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function outlookWebUrl(e: CuratorEvent): string {
  const t = times(e);
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(t.start).toISOString(),
    enddt: new Date(t.end).toISOString(),
    body: details(e, t.assumedEnd),
    location: location(e),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Folds lines to 75 octets (UTF-8 bytes) as RFC 5545 requires, never splitting a character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

export function eventToIcs(e: CuratorEvent, now = Date.now()): string {
  const t = times(e);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Off Hours//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id.replace(/[^A-Za-z0-9_.-]/g, "")}@offhours`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(t.start)}`,
    `DTEND:${stamp(t.end)}`,
    `SUMMARY:${icsText(e.title)}`,
    `LOCATION:${icsText(location(e))}`,
    `DESCRIPTION:${icsText(details(e, t.assumedEnd))}`,
    ...(e.officialUrl ? [`URL:${e.officialUrl}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsFileName(e: CuratorEvent): string {
  return `${e.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event"}.ics`;
}
