// Invitation drafts are templates the user edits and copies. Nothing is ever sent.
import { describePrice } from "./budget";
import { formatDay, formatTime } from "./time";
import type { CuratorEvent } from "./types";

export function draftInvitation(event: CuratorEvent, tz: string): string {
  const start = Date.parse(event.start);
  const when = `${formatDay(start, event.timezone || tz)} at ${formatTime(start, event.timezone || tz)}`;
  const where = [event.venue.name, event.venue.neighborhood ?? event.venue.city].filter(Boolean).join(", ");
  const lines = [
    `Hey! I found ${event.title} on ${when} at ${where} and thought it could be fun. Would you be up for going?`,
  ];
  // Only mention price when it's actually verified.
  if (!event.isDemo && event.verification.status === "verified" && event.price.status !== "unknown") {
    lines.push(`Tickets are ${describePrice(event)}.`);
  }
  const link = event.officialUrl ?? event.bookingUrl;
  if (link) lines.push(`Here's the link: ${link}`);
  return lines.join(" ");
}
