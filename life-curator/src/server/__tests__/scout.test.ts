import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { findCandidates, scoutAdapter, verifyCandidates } from "@/server/scout";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const range = { from: NOW, to: NOW + 120 * 86_400_000 };
const publicDns = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;

const report = (events: unknown[]) =>
  ({
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "t1", name: "report_events", input: { events } }],
  }) as unknown as Anthropic.Beta.BetaMessage;

const candidates = [
  { title: "Gala for the Arts", url: "https://tickets.example/gala", starts_at: "2026-11-28T19:00:00+00:00", venue: "Guildhall", why: "Gala, open sale" },
  { title: "Made-up Jazz Night", url: "https://tickets.example/jazz", starts_at: "2026-11-20T20:00:00+00:00", venue: "Somewhere", why: "Jazz" },
  { title: "Wrong date", url: "https://tickets.example/talk", starts_at: "2026-11-02T19:00:00+00:00", venue: "RI", why: "Talk" },
];

const fetchImpl = (async (u: URL | string) => {
  const path = new URL(String(u)).pathname;
  const page = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });
  if (path === "/robots.txt") return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
  if (path === "/gala")
    return page(`<script type="application/ld+json">{"@type":"Event","name":"Winter Gala for the Arts","startDate":"2026-11-28T19:00:00+00:00","location":{"name":"Guildhall","address":{"addressLocality":"London"}},"offers":{"price":"120","priceCurrency":"GBP"}}</script>`);
  if (path === "/talk")
    return page(`<script type="application/ld+json">{"@type":"Event","name":"A talk","startDate":"2026-12-09T19:00:00+00:00"}</script>`);
  return new Response("gone", { status: 404, headers: { "content-type": "text/html" } });
}) as unknown as typeof fetch;

describe("AI scout", () => {
  it("resumes paused searches and reads the reported candidates", async () => {
    const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const replies = [
      { stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "london galas" } }] } as unknown as Anthropic.Beta.BetaMessage,
      report(candidates),
    ];
    const create = async (body: Anthropic.Beta.MessageCreateParamsNonStreaming) => {
      calls.push(structuredClone(body));
      return replies.shift()!;
    };
    const found = await findCandidates(create, "Interests: galas", NOW);
    expect(found).toHaveLength(3);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.model).toBe("claude-opus-5-5");
    expect(calls[0]!.tools?.map((t) => ("type" in t && t.type) || t.name)).toEqual(["web_search_20260209", "report_events"]);
    expect(calls[1]!.messages.at(-1)!.role).toBe("assistant"); // resumed without an extra user message
  });

  it("keeps only events their own pages confirm, built from the page's data", async () => {
    const events = await verifyCandidates(candidates, NOW, { fetchImpl, resolve: publicDns });
    expect(events.map((e) => e.title)).toEqual(["Winter Gala for the Arts"]);
    expect(events[0]!.price.min).toBe(120);
    expect(events[0]!.verification.sourceName).toBe("tickets.example · found by AI scout");
  });

  it("treats a refusal as a failed run, not as events", async () => {
    const create = async () => ({ stop_reason: "refusal", content: [] }) as unknown as Anthropic.Beta.BetaMessage;
    const a = scoutAdapter({ apiKey: "test", create, fetchImpl, resolve: publicDns });
    await expect(a.fetchEvents(range, NOW)).rejects.toThrow(/declined/);
  });

  it("runs end to end as an event source", async () => {
    const a = scoutAdapter({ apiKey: "test", create: async () => report(candidates), fetchImpl, resolve: publicDns });
    expect(a.backgroundOnly).toBe(true);
    expect((await a.fetchEvents(range, NOW)).map((e) => e.title)).toEqual(["Winter Gala for the Arts"]);
  });
});
