import { localDate } from "@/lib/domain/time";
import type { CostItem, CuratorEvent, Experience } from "@/lib/domain/types";

export function newId(): string {
  return crypto.randomUUID();
}

/** History entry for an event the user has just confirmed attending. */
export function experienceFromEvent(event: CuratorEvent, cost: CostItem | null): Experience {
  const at = new Date().toISOString();
  return {
    id: newId(),
    eventId: event.id,
    title: event.title,
    category: event.category,
    tags: event.tags.slice(0, 20),
    venueName: event.venue.name,
    neighborhood: event.venue.neighborhood,
    city: event.venue.city,
    date: localDate(Date.parse(event.start), event.timezone),
    rating: null,
    cost,
    withWhom: null,
    wasNew: null,
    notes: "",
    source: "app",
    createdAt: at,
    updatedAt: at,
  };
}
