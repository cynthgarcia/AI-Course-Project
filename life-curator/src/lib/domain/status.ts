// Status transitions reflect what the user actually did. Nothing here is inferred:
// copying an invitation, saving or planning never imply sending, booking or attending.
import type { LocalStatus, TravelStatus } from "./types";

const LOCAL_TRANSITIONS: Record<LocalStatus | "none", LocalStatus[]> = {
  none: ["interested", "saved", "planned", "not_for_me", "skipped"],
  interested: ["saved", "invited", "planned", "skipped", "not_for_me"],
  saved: ["interested", "invited", "planned", "skipped", "not_for_me"],
  invited: ["saved", "planned", "skipped", "not_for_me"],
  planned: ["saved", "invited", "attended", "skipped"],
  attended: ["planned"], // allow correcting a mistaken confirmation
  skipped: ["interested", "saved", "planned"],
  not_for_me: ["interested", "saved"],
};

export function canTransition(from: LocalStatus | null, to: LocalStatus): boolean {
  return LOCAL_TRANSITIONS[from ?? "none"].includes(to);
}

export function nextLocalStatuses(from: LocalStatus | null): LocalStatus[] {
  return LOCAL_TRANSITIONS[from ?? "none"];
}

/** Statuses that require an explicit user confirmation step in the UI. */
export const NEEDS_CONFIRMATION: LocalStatus[] = ["attended", "invited"];

const TRAVEL_TRANSITIONS: Record<TravelStatus | "none", TravelStatus[]> = {
  none: ["interested", "researching", "worth_considering", "not_for_me"],
  interested: ["researching", "worth_considering", "planned", "not_for_me"],
  researching: ["interested", "worth_considering", "planned", "not_for_me"],
  worth_considering: ["researching", "planned", "not_for_me"],
  planned: ["worth_considering", "attended", "not_for_me"],
  attended: ["planned"],
  not_for_me: ["interested", "researching"],
};

export function canTransitionTrip(from: TravelStatus | null, to: TravelStatus): boolean {
  return TRAVEL_TRANSITIONS[from ?? "none"].includes(to);
}

export function nextTravelStatuses(from: TravelStatus | null): TravelStatus[] {
  return TRAVEL_TRANSITIONS[from ?? "none"];
}

/** Whether an event's start has passed — attendance can only be confirmed afterwards. */
export function canConfirmAttendance(start: number, now: number): boolean {
  return start <= now;
}
