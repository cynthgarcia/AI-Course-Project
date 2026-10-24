// Which event sources are live, from server configuration. Keys never leave the server.
import { demoSources } from "@/lib/sources/demo";
import { eventbriteAdapter } from "@/lib/sources/eventbrite";
import { ticketmasterAdapter } from "@/lib/sources/ticketmaster";
import type { EventSourceAdapter } from "@/lib/sources/types";

const COUNTRY: Record<string, string> = {
  paris: "FR", brussels: "BE", antwerp: "BE", amsterdam: "NL", berlin: "DE", munich: "DE", copenhagen: "DK",
  lisbon: "PT", porto: "PT", madrid: "ES", barcelona: "ES", milan: "IT", rome: "IT", vienna: "AT", prague: "CZ",
};

export interface SourceStatus {
  id: string;
  name: string;
  configured: boolean;
  note: string;
}

export function configuredSources(env: NodeJS.ProcessEnv = process.env): { sources: EventSourceAdapter[]; status: SourceStatus[] } {
  const sources: EventSourceAdapter[] = [];
  const tmKey = env.TICKETMASTER_API_KEY?.trim();
  if (tmKey) {
    const cities = env.TICKETMASTER_EUROPE === "0" ? [] : Object.entries(COUNTRY).map(([id, countryCode]) => ({ city: id[0]!.toUpperCase() + id.slice(1), countryCode }));
    sources.push(ticketmasterAdapter(tmKey, cities));
  }
  const ebToken = env.EVENTBRITE_TOKEN?.trim();
  const ebOrgs = (env.EVENTBRITE_ORGANIZER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ebToken && ebOrgs.length) sources.push(eventbriteAdapter(ebToken, ebOrgs));

  const real = sources.length > 0;
  const demo = env.DEMO_EVENTS === "1" || (!real && env.DEMO_EVENTS !== "0");
  if (demo) sources.push(...demoSources);

  return {
    sources,
    status: [
      { id: "ticketmaster", name: "Ticketmaster", configured: !!tmKey, note: tmKey ? "London plus European destinations" : "Add TICKETMASTER_API_KEY (free from developer.ticketmaster.com)" },
      {
        id: "eventbrite",
        name: "Eventbrite",
        configured: !!(ebToken && ebOrgs.length),
        note: ebToken && ebOrgs.length ? `${ebOrgs.length} organiser${ebOrgs.length === 1 ? "" : "s"} followed` : "Add EVENTBRITE_TOKEN and EVENTBRITE_ORGANIZER_IDS (Eventbrite has no public search)",
      },
      { id: "demo", name: "Sample events (fictional)", configured: demo, note: demo ? "Shown until real sources are set up" : "Off" },
    ],
  };
}
