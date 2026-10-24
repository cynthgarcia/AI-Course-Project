// "Wrapped": a deterministic summary of a year of experiences. Pure function of the
// user's own records — nothing is estimated or invented. Unknown costs stay unknown.
import { toBudgetAmount, round2 } from "./budget";
import { CATEGORY_LABELS, type Category, type Experience, type Preferences } from "./types";

export interface WrappedSummary {
  year: number;
  count: number;
  ratedCount: number;
  avgRating: number | null;
  newCount: number;
  categories: { category: Category; count: number; avgRating: number | null }[];
  topRated: Experience[];
  monthly: number[]; // 12 counts, Jan..Dec
  busiestMonth: { month: number; count: number } | null;
  spent: number;
  unknownCostCount: number;
  withWhom: { solo: number; friends: number; new_people: number; unknown: number };
  places: string[];
  persona: { title: string; line: string };
  includesSamples: boolean;
}

const PERSONAS: Record<Category, string> = {
  music: "The Front-Row Listener",
  theatre: "The Curtain-Call Regular",
  art: "The Gallery Wanderer",
  film: "The Big-Screen Devotee",
  sports: "The Social Mover",
  literature: "The Well-Read Night Owl",
  tech: "The Future Watcher",
  investing: "The Deal-Curious Builder",
  social: "The Gracious Guest",
  creative: "The Hands-On Maker",
  wellness: "The Restorer",
  faith: "The Community Keeper",
  food: "The Curious Palate",
  other: "The Explorer",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function yearsWithExperiences(exps: Experience[]): number[] {
  return [...new Set(exps.map((x) => Number(x.date.slice(0, 4))))].filter(Number.isFinite).sort((a, b) => b - a);
}

const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function computeWrapped(all: Experience[], year: number, prefs: Preferences): WrappedSummary {
  const exps = all.filter((x) => x.date.startsWith(`${year}-`));
  const rated = exps.filter((x) => x.rating !== null);

  const byCat = new Map<Category, Experience[]>();
  for (const x of exps) byCat.set(x.category, [...(byCat.get(x.category) ?? []), x]);
  const categories = [...byCat]
    .map(([category, xs]) => ({ category, count: xs.length, avgRating: avg(xs.flatMap((x) => (x.rating === null ? [] : [x.rating]))) }))
    .sort((a, b) => b.count - a.count || (b.avgRating ?? 0) - (a.avgRating ?? 0));

  const monthly = Array.from({ length: 12 }, () => 0);
  for (const x of exps) {
    const m = Number(x.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) monthly[m]!++;
  }
  const peak = Math.max(0, ...monthly);
  const busiestMonth = peak > 0 ? { month: monthly.indexOf(peak), count: peak } : null;

  let spent = 0;
  let unknownCostCount = 0;
  for (const x of exps) {
    const v = toBudgetAmount(x.cost, prefs);
    if (v === null) unknownCostCount++;
    else spent += v;
  }

  const withWhom = { solo: 0, friends: 0, new_people: 0, unknown: 0 };
  for (const x of exps) withWhom[x.withWhom ?? "unknown"]++;

  const places = [...new Set(exps.map((x) => (x.city && x.city !== "London" ? x.city : x.neighborhood ?? x.city)).filter((p): p is string => !!p))];

  const top = categories[0];
  const persona =
    exps.length < 3 || !top
      ? { title: "Just getting started", line: "Add a few more experiences and your year will take shape." }
      : {
          title: PERSONAS[top.category],
          line: `${CATEGORY_LABELS[top.category]} made up ${Math.round((top.count / exps.length) * 100)}% of your year${
            top.avgRating !== null ? `, rated ${top.avgRating.toFixed(1)}★ on average` : ""
          }.`,
        };

  return {
    year,
    count: exps.length,
    ratedCount: rated.length,
    avgRating: avg(rated.map((x) => x.rating!)),
    newCount: exps.filter((x) => x.wasNew === true).length,
    categories,
    topRated: [...rated].sort((a, b) => b.rating! - a.rating! || b.date.localeCompare(a.date)).slice(0, 5),
    monthly,
    busiestMonth,
    spent: round2(spent),
    unknownCostCount,
    withWhom,
    places,
    persona,
    includesSamples: exps.some((x) => x.source === "sample"),
  };
}
