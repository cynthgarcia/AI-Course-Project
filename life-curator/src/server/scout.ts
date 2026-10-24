// AI scout: Claude searches the web for upcoming events that match the interest brief.
// Claude only proposes candidates — every event is then read from the organiser's own
// page by the app (schema.org data, robots.txt respected) and kept only if that page
// confirms it. Nothing Claude says is shown as fact. Off unless SCOUT_ENABLED=1.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DEFAULT_PREFERENCES } from "@/lib/data/defaults";
import { CATEGORY_LABELS, type Category, type CuratorEvent } from "@/lib/domain/types";
import type { EventSourceAdapter } from "@/lib/sources/types";
import { eventsFromPage, fetchText, type FetchTextOptions } from "./importEvent";
import { robotsAllows } from "./robots";

const MODEL = "claude-opus-5-5";
const MAX_CANDIDATES = 25;
const MATCH_WINDOW_MS = 36 * 3_600_000;

const Candidate = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  starts_at: z.string().max(40),
  venue: z.string().max(200),
  why: z.string().max(300),
});
const Report = z.object({ events: z.array(Candidate).max(MAX_CANDIDATES) });
export type ScoutCandidate = z.infer<typeof Candidate>;

const REPORT_TOOL = {
  name: "report_events",
  description: "Report the specific upcoming events you found. Call this once, at the end.",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Event name as the organiser writes it" },
            url: { type: "string", description: "The event's own page (organiser, venue or ticketing), not a listings article" },
            starts_at: { type: "string", description: "Start date and time, ISO 8601 with offset, e.g. 2026-11-14T19:30:00+00:00" },
            venue: { type: "string" },
            why: { type: "string", description: "One sentence on why it fits the brief" },
          },
          required: ["title", "url", "starts_at", "venue", "why"],
          additionalProperties: false,
        },
      },
    },
    required: ["events"],
    additionalProperties: false,
  },
};

/** The interest brief sent to Claude: categories and keywords only, never personal data. */
export function defaultBrief(): string {
  const p = DEFAULT_PREFERENCES;
  const loved = (Object.entries(p.interests) as [Category, number][]).filter(([, w]) => w >= 2).map(([c]) => CATEGORY_LABELS[c]);
  return [
    `Interests: ${loved.join("; ")}.`,
    `Especially: ${p.interestKeywords.join(", ")}.`,
    "Also: galas, charity receptions and cultural openings that sell tickets to the public; beginner-friendly classes (acting, public speaking, pottery, painting); author talks; founder and angel-investing events; distinctive one-offs.",
  ].join(" ");
}

type CreateFn = (body: Anthropic.Beta.MessageCreateParamsNonStreaming, opts: { timeout: number; maxRetries: number }) => Promise<Anthropic.Beta.BetaMessage>;

/** Asks Claude (with web search) for candidate events. Returns unverified candidates. */
export async function findCandidates(create: CreateFn, brief: string, now: number, maxSearches = 6): Promise<ScoutCandidate[]> {
  const today = new Date(now).toISOString().slice(0, 10);
  const until = new Date(now + 42 * 86_400_000).toISOString().slice(0, 10);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Find specific upcoming events in London between ${today} and ${until} that suit this person.\n\n${brief}\n\nSearch event sites such as Eventbrite, DICE, Fever, venue and organiser websites, and ticketing pages. Prefer events that are distinctive or easy to miss. For each, give the event's own page — not a "things to do" article. Only include events whose page you actually saw, with an exact date and start time. Then call report_events once with up to ${MAX_CANDIDATES} events.`,
    },
  ];
  for (let round = 0; round < 4; round++) {
    const res = await create(
      {
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: maxSearches,
            user_location: { type: "approximate", city: "London", country: "GB", timezone: "Europe/London" },
          },
          REPORT_TOOL,
        ],
        tool_choice: { type: "auto" },
        messages,
      },
      { timeout: 55_000, maxRetries: 0 },
    );
    if (res.stop_reason === "refusal") throw new Error("The scout declined this search.");
    const report = res.content.find((b) => b.type === "tool_use" && b.name === "report_events");
    if (report && report.type === "tool_use") {
      const parsed = Report.safeParse(report.input);
      if (!parsed.success) throw new Error("The scout returned an unreadable list.");
      return parsed.data.events;
    }
    if (res.stop_reason !== "pause_turn") break;
    // Server-side search paused: send the turn back unchanged so it resumes.
    messages.push({ role: "assistant", content: res.content });
  }
  return [];
}

/**
 * Keeps a candidate only if its own page publishes a matching event (start within 36h).
 * The event shown is built from the page, not from what Claude said.
 */
export async function verifyCandidates(candidates: ScoutCandidate[], now: number, opts: Pick<FetchTextOptions, "fetchImpl" | "resolve"> = {}): Promise<CuratorEvent[]> {
  const robots = new Map<string, Promise<(p: string) => boolean>>();
  const allowedFor = (origin: string) => {
    if (!robots.has(origin)) {
      robots.set(
        origin,
        fetchText(`${origin}/robots.txt`, { ...opts, accept: /.*/, acceptHeader: "text/plain" })
          .then((r) => (r.status >= 400 && r.status < 500 ? () => true : r.status >= 500 ? () => false : (p: string) => robotsAllows(r.text, p)))
          .catch(() => () => false),
      );
    }
    return robots.get(origin)!;
  };
  const out: CuratorEvent[] = [];
  const queue = [...candidates];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const u = new URL(c.url);
        if (u.protocol !== "https:" || !(await allowedFor(u.origin))(u.pathname + u.search)) continue;
        const page = await fetchText(c.url, opts);
        if (page.status >= 400) continue;
        const claimed = Date.parse(c.starts_at);
        const host = new URL(page.url).hostname.replace(/^www\./, "");
        const match = eventsFromPage(page.text, page.url, { now, mode: "source", sourceId: "scout" }).find(
          (e) => Number.isFinite(claimed) && Math.abs(Date.parse(e.start) - claimed) <= MATCH_WINDOW_MS,
        );
        if (match) out.push({ ...match, verification: { ...match.verification, sourceName: `${host} · found by AI scout` } });
      } catch {
        // Unreachable or unreadable pages are simply skipped.
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}

export function scoutAdapter(config: { apiKey: string; brief?: string; maxSearches?: number; create?: CreateFn } & Pick<FetchTextOptions, "fetchImpl" | "resolve">): EventSourceAdapter {
  const create: CreateFn =
    config.create ??
    ((body, opts) => {
      const client = new Anthropic({ apiKey: config.apiKey });
      return client.beta.messages.create(body, opts) as Promise<Anthropic.Beta.BetaMessage>;
    });
  return {
    id: "scout",
    name: "AI scout",
    kind: "api",
    isDemo: false,
    refreshHours: 72,
    backgroundOnly: true,
    async fetchEvents(range, now) {
      const candidates = await findCandidates(create, config.brief ?? defaultBrief(), now, config.maxSearches);
      const verified = await verifyCandidates(candidates, now, config);
      return verified.filter((e) => Date.parse(e.start) >= range.from && Date.parse(e.start) <= range.to);
    },
  };
}
