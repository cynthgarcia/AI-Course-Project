// Keyword-based category and tag inference for events from external sources.
// Deterministic; used only when a source's own classification is missing or too coarse.
import type { Category } from "@/lib/domain/types";

const RULES: [Category, RegExp][] = [
  ["faith", /\b(mass|church|cathedral|catholic|choral evensong|retreat|prayer|parish)\b/i],
  ["investing", /\b(investor|investing|angel|venture|vc\b|startup|start-up|founder|entrepreneur|fundrais(?:e|ing) round|wealth)\b/i],
  ["tech", /\b(ai|artificial intelligence|machine learning|tech|developer|product|data science|hackathon|llm|robotics)\b/i],
  ["social", /\b(gala|ball|charity (?:dinner|reception)|reception|fundraiser|soir[ée]e|networking|black tie)\b/i],
  ["literature", /\b(author|book|poetry|reading|literary|novel|writer|writing)\b/i],
  ["creative", /\b(workshop|class|pottery|ceramics|painting|drawing|life drawing|acting|improv|photography|craft|calligraphy)\b/i],
  ["wellness", /\b(yoga|meditation|mindfulness|wellness|breathwork|sound bath|retreat)\b/i],
  ["sports", /\b(padel|tennis|volleyball|pilates|run club|football|rugby|cricket|marathon|climbing|fitness)\b/i],
  ["film", /\b(film|cinema|screening|premiere|movie)\b/i],
  ["theatre", /\b(theatre|theater|musical|play|opera|ballet|dance|comedy|stand-up)\b/i],
  ["art", /\b(exhibition|gallery|museum|art fair|private view|design week|installation)\b/i],
  ["food", /\b(supper club|tasting|wine|dinner|food|chef|cocktail)\b/i],
  ["music", /\b(concert|gig|live music|jazz|orchestra|symphony|classical|dj|festival|band|recital|choir)\b/i],
];

export function classify(text: string, fallback: Category = "other"): Category {
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return fallback;
}

const TAG_WORDS = [
  "jazz", "classical", "orchestra", "opera", "musical theatre", "comedy", "padel", "tennis", "pilates", "yoga",
  "pottery", "painting", "photography", "acting", "improv", "public speaking", "poetry", "book", "AI", "founder",
  "angel", "gala", "charity", "networking", "exhibition", "film", "wine", "festival", "workshop", "beginner",
];

export function inferTags(text: string, extra: string[] = []): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found = TAG_WORDS.filter((t) => new RegExp(`\\b${t.toLowerCase().replace(/ /g, "\\s+")}\\b`).test(lower));
  return [...new Set([...extra.map((t) => t.trim()).filter(Boolean), ...found])].slice(0, 12);
}
