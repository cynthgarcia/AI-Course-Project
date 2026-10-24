// Hobby discovery and tracking. Deterministic: recommendations come from the user's
// interests, stated goals, ratings of past experiences, and hobbies they already do.
// The catalogue describes kinds of activity, not specific providers, so nothing here
// claims a particular class exists — matching real events are shown separately.
import { normalizeTag } from "./taste";
import { CATEGORY_LABELS, type Category, type CuratorEvent, type Experience, type Preferences } from "./types";

export type GoalKey =
  | "confidence_speaking"
  | "public_profile"
  | "creativity"
  | "fitness"
  | "new_friends"
  | "calm"
  | "learn_skill"
  | "career_network";

export const GOAL_LABELS: Record<GoalKey, string> = {
  confidence_speaking: "Speak confidently in public",
  public_profile: "Build a public profile",
  creativity: "Be more creative",
  fitness: "Move more",
  new_friends: "Meet new people",
  calm: "Feel calmer",
  learn_skill: "Learn a new skill",
  career_network: "Grow my network",
};

export interface Hobby {
  id: string;
  name: string;
  blurb: string;
  categories: Category[];
  /** Used to find matching events and past experiences. */
  tags: string[];
  goals: GoalKey[];
  social: "group" | "solo" | "either";
  commitment: string;
  /** Relative cost of getting started — a rough guide, not a price. */
  cost: "Low" | "Medium" | "Higher";
  waysToTry: string[];
  nextSteps: string[];
}

export const HOBBIES: Hobby[] = [
  { id: "acting", name: "Acting", blurb: "Scene work, character and presence — a classic way back into performing.", categories: ["creative", "theatre"], tags: ["acting", "drama", "theatre", "scene"], goals: ["confidence_speaking", "public_profile", "creativity", "new_friends"], social: "group", commitment: "Weekly class over a term", cost: "Medium", waysToTry: ["A drop-in or taster class", "A short evening course", "A weekend intensive"], nextSteps: ["improv", "voice", "public_speaking"] },
  { id: "improv", name: "Improv comedy", blurb: "Thinking on your feet, in a room that's on your side.", categories: ["creative", "theatre"], tags: ["improv", "comedy", "acting"], goals: ["confidence_speaking", "new_friends", "creativity"], social: "group", commitment: "Weekly class, or one-off jams", cost: "Low", waysToTry: ["A beginners' jam", "A taster workshop", "A level-one course"], nextSteps: ["public_speaking", "storytelling", "acting"] },
  { id: "public_speaking", name: "Public speaking", blurb: "Structure, nerves and delivery — practised in a supportive group.", categories: ["literature", "investing"], tags: ["public speaking", "speaking", "presentation", "toastmasters", "keynote"], goals: ["confidence_speaking", "public_profile", "career_network"], social: "group", commitment: "A short course, then a regular practice club", cost: "Low", waysToTry: ["A speaking club's guest night", "A one-day presentation workshop", "A short course with filmed practice"], nextSteps: ["storytelling", "panel_hosting", "voice"] },
  { id: "storytelling", name: "Storytelling nights", blurb: "Five minutes, true story, no notes. A great bridge from class to stage.", categories: ["literature", "theatre"], tags: ["storytelling", "open mic", "spoken word"], goals: ["confidence_speaking", "public_profile", "creativity"], social: "group", commitment: "Monthly nights", cost: "Low", waysToTry: ["Go and listen first", "Sign up for an open slot", "A storytelling workshop"], nextSteps: ["panel_hosting", "podcasting"] },
  { id: "voice", name: "Voice & presence coaching", blurb: "Breath, projection and how you hold a room.", categories: ["theatre", "creative"], tags: ["voice", "presence", "vocal"], goals: ["confidence_speaking", "public_profile"], social: "either", commitment: "A few sessions", cost: "Higher", waysToTry: ["A group voice workshop", "A one-to-one session"], nextSteps: ["public_speaking", "podcasting"] },
  { id: "panel_hosting", name: "Hosting & moderating", blurb: "Run a salon, chair a panel or host a supper — being the person who convenes.", categories: ["social", "investing"], tags: ["host", "panel", "salon", "moderator", "fireside"], goals: ["public_profile", "career_network", "confidence_speaking"], social: "group", commitment: "One event at a time", cost: "Low", waysToTry: ["Volunteer to moderate at a meetup", "Host a small salon with friends", "Co-host with an organiser you know"], nextSteps: ["podcasting"] },
  { id: "podcasting", name: "Podcasting & video", blurb: "Share ideas on your own terms — useful if you want to be more visible.", categories: ["tech", "creative"], tags: ["podcast", "content", "video", "creator"], goals: ["public_profile", "creativity", "learn_skill"], social: "either", commitment: "A regular slot you choose", cost: "Low", waysToTry: ["Record a pilot with a friend", "A creator or audio workshop"], nextSteps: ["panel_hosting"] },
  { id: "writing", name: "Creative writing", blurb: "Short fiction, essays or poetry, with deadlines that keep you going.", categories: ["literature", "creative"], tags: ["writing", "creative writing", "poetry"], goals: ["creativity", "calm", "public_profile"], social: "either", commitment: "Weekly workshop", cost: "Low", waysToTry: ["A one-off workshop", "A writing group", "A short course"], nextSteps: ["storytelling"] },
  { id: "pottery", name: "Pottery", blurb: "Wheel or hand-building — absorbing, tactile, and you get a bowl.", categories: ["creative"], tags: ["pottery", "ceramics", "clay"], goals: ["creativity", "calm", "learn_skill"], social: "either", commitment: "Taster, then a short course", cost: "Medium", waysToTry: ["A wheel taster", "A date-night class", "A six-week course"], nextSteps: ["painting"] },
  { id: "painting", name: "Painting & watercolour", blurb: "Low-stakes making, alone or at a social class.", categories: ["creative", "art"], tags: ["painting", "watercolour", "art class"], goals: ["creativity", "calm"], social: "either", commitment: "One evening to start", cost: "Low", waysToTry: ["A social paint-and-sip", "A beginners' course"], nextSteps: ["life_drawing"] },
  { id: "life_drawing", name: "Life drawing", blurb: "Quick poses, quiet focus, fast improvement.", categories: ["creative", "art"], tags: ["life drawing", "drawing"], goals: ["creativity", "calm", "learn_skill"], social: "either", commitment: "Drop-in sessions", cost: "Low", waysToTry: ["A drop-in session"], nextSteps: ["painting"] },
  { id: "photography", name: "Photography", blurb: "Learn to see — street, portrait or travel.", categories: ["creative", "art"], tags: ["photography", "photo walk"], goals: ["creativity", "learn_skill", "public_profile"], social: "either", commitment: "A photo walk, then practice", cost: "Medium", waysToTry: ["A guided photo walk", "A camera basics workshop"], nextSteps: [] },
  { id: "dance", name: "Dance classes", blurb: "Salsa, swing or contemporary — movement with music and people.", categories: ["sports", "music"], tags: ["dance", "salsa", "swing", "ballroom"], goals: ["fitness", "new_friends", "confidence_speaking"], social: "group", commitment: "Weekly drop-in", cost: "Low", waysToTry: ["A beginners' drop-in", "A social dance night with a lesson first"], nextSteps: [] },
  { id: "padel", name: "Padel", blurb: "Easy to start, very social, quick to get hooked.", categories: ["sports"], tags: ["padel"], goals: ["fitness", "new_friends"], social: "group", commitment: "Weekly games", cost: "Medium", waysToTry: ["A social mixer", "A beginners' clinic"], nextSteps: ["tennis"] },
  { id: "tennis", name: "Tennis", blurb: "A lifelong sport with clubs and leagues at every level.", categories: ["sports"], tags: ["tennis"], goals: ["fitness", "new_friends", "learn_skill"], social: "group", commitment: "Weekly lessons or games", cost: "Medium", waysToTry: ["An adult beginners' session", "Social tennis at a club"], nextSteps: [] },
  { id: "volleyball", name: "Volleyball", blurb: "Team sport, mixed abilities, easy social circle.", categories: ["sports"], tags: ["volleyball"], goals: ["fitness", "new_friends"], social: "group", commitment: "Weekly drop-in", cost: "Low", waysToTry: ["An indoor drop-in", "Summer beach sessions"], nextSteps: [] },
  { id: "pilates", name: "Pilates", blurb: "Strength and posture — calm but demanding.", categories: ["sports", "wellness"], tags: ["pilates", "reformer"], goals: ["fitness", "calm"], social: "solo", commitment: "One or two classes a week", cost: "Medium", waysToTry: ["An intro class", "A starter pack of classes"], nextSteps: [] },
  { id: "choir", name: "Choir & singing", blurb: "Singing with others — great for voice, breath and community.", categories: ["music", "faith"], tags: ["choir", "choral", "singing"], goals: ["new_friends", "calm", "confidence_speaking"], social: "group", commitment: "Weekly rehearsal", cost: "Low", waysToTry: ["A come-and-sing day", "A community choir's open rehearsal"], nextSteps: ["voice"] },
  { id: "piano", name: "An instrument", blurb: "Piano, guitar or something you always wanted to play.", categories: ["music"], tags: ["piano", "guitar", "music lessons"], goals: ["learn_skill", "calm", "creativity"], social: "solo", commitment: "Weekly lessons and practice", cost: "Higher", waysToTry: ["A trial lesson", "A group beginners' course"], nextSteps: [] },
  { id: "wine", name: "Wine tasting", blurb: "Learn what you like and why — sociable and useful at dinners.", categories: ["food"], tags: ["wine", "tasting", "sommelier"], goals: ["learn_skill", "new_friends"], social: "group", commitment: "One evening, or a short course", cost: "Medium", waysToTry: ["A tasting evening", "An introductory course"], nextSteps: ["cooking"] },
  { id: "cooking", name: "Cooking classes", blurb: "A cuisine you love, taught hands-on.", categories: ["food", "creative"], tags: ["cooking", "chef", "cookery"], goals: ["learn_skill", "new_friends"], social: "group", commitment: "One evening", cost: "Medium", waysToTry: ["A one-off class", "A supper club that teaches"], nextSteps: [] },
  { id: "book_club", name: "Book club", blurb: "A reason to read, and good conversation monthly.", categories: ["literature"], tags: ["book club", "books", "reading"], goals: ["new_friends", "calm"], social: "group", commitment: "Monthly", cost: "Low", waysToTry: ["Join a bookshop's club", "Start one with friends"], nextSteps: ["writing"] },
  { id: "angel_investing", name: "Angel investing education", blurb: "Learn how early-stage deals work before putting money in.", categories: ["investing"], tags: ["angel", "investing", "venture", "founder"], goals: ["career_network", "learn_skill"], social: "group", commitment: "A course or a syndicate's events", cost: "Medium", waysToTry: ["An educational evening", "Observe a syndicate's pitch night"], nextSteps: ["panel_hosting"] },
  { id: "charity_committee", name: "Charity committee volunteering", blurb: "Helping run a gala or fundraiser is how many people get into them.", categories: ["social"], tags: ["charity", "gala", "fundraiser", "volunteer"], goals: ["public_profile", "career_network", "new_friends"], social: "group", commitment: "A few hours a month", cost: "Low", waysToTry: ["Volunteer at one fundraiser", "Join a young patrons or events committee"], nextSteps: ["panel_hosting"] },
  { id: "meditation", name: "Meditation", blurb: "A short daily practice, with a group session to anchor it.", categories: ["wellness", "faith"], tags: ["meditation", "mindfulness", "retreat"], goals: ["calm"], social: "either", commitment: "Daily minutes, weekly group", cost: "Low", waysToTry: ["A guided evening", "A day retreat"], nextSteps: [] },
  { id: "language", name: "A language", blurb: "French or Italian for weekends away — or something new.", categories: ["other", "food"], tags: ["language", "french", "italian", "spanish"], goals: ["learn_skill", "new_friends"], social: "group", commitment: "Weekly class", cost: "Medium", waysToTry: ["A conversation meetup", "A term-long evening class"], nextSteps: [] },
];

export const HOBBY_BY_ID = new Map(HOBBIES.map((h) => [h.id, h]));

export type HobbyStatus = "curious" | "signed_up" | "trying" | "ongoing" | "paused" | "not_for_me";

export const HOBBY_STATUS_LABELS: Record<HobbyStatus, string> = {
  curious: "Curious",
  signed_up: "Signed up",
  trying: "Trying it",
  ongoing: "Part of my life",
  paused: "Paused",
  not_for_me: "Not for me",
};

export interface UserHobby {
  id: string;
  /** Catalogue id, or null for a hobby the user named themselves. */
  hobbyId: string | null;
  name: string;
  status: HobbyStatus;
  /** "I've done this before" — e.g. acting years ago. */
  pastExperience: boolean;
  /** Next class or session, "YYYY-MM-DD", when the user has one booked. */
  nextSession: string | null;
  rating: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface HobbyRecommendation {
  hobby: Hobby;
  score: number;
  reasons: string[];
  tryEvents: CuratorEvent[];
}

function eventMatches(e: CuratorEvent, h: Hobby): boolean {
  const tags = new Set(e.tags.map(normalizeTag));
  const title = e.title.toLowerCase();
  return h.tags.some((t) => tags.has(normalizeTag(t)) || title.includes(t.toLowerCase()));
}

/** Upcoming events that are a concrete way to try a hobby. */
export function eventsForHobby(h: Hobby, events: CuratorEvent[], now: number, limit = 3): CuratorEvent[] {
  return events.filter((e) => Date.parse(e.start) > now && eventMatches(e, h)).slice(0, limit);
}

function experienceMatches(x: Experience, h: Hobby): boolean {
  const tags = new Set(x.tags.map(normalizeTag));
  const title = x.title.toLowerCase();
  return h.tags.some((t) => tags.has(normalizeTag(t)) || title.includes(t.toLowerCase()));
}

export interface HobbyInput {
  prefs: Preferences;
  goals: string[];
  experiences: Experience[];
  hobbies: UserHobby[];
  events: CuratorEvent[];
  now: number;
}

export function recommendHobbies(input: HobbyInput, limit = 6): HobbyRecommendation[] {
  const { prefs, goals, experiences, hobbies, events, now } = input;
  const tracked = new Map(hobbies.filter((h) => h.hobbyId).map((h) => [h.hobbyId!, h]));
  const goalKeys = new Set(goals.filter((g): g is GoalKey => g in GOAL_LABELS));
  const freeGoals = goals.filter((g) => !(g in GOAL_LABELS)).map((g) => g.toLowerCase());
  // Hobbies the user enjoys or is committed to unlock their natural next steps.
  const active = hobbies.filter((h) => h.hobbyId && (["signed_up", "trying", "ongoing"].includes(h.status) || (h.rating ?? 0) >= 4 || h.pastExperience));

  const recs: HobbyRecommendation[] = [];
  for (const h of HOBBIES) {
    if (tracked.has(h.id)) continue; // already in the user's tracker
    const reasons: string[] = [];

    const interest = Math.max(...h.categories.map((c) => (prefs.interests[c] ?? 0) / 3));

    const goalHits = h.goals.filter((g) => goalKeys.has(g));
    const freeHits = freeGoals.filter((g) => [h.name, ...h.tags].some((t) => g.includes(t.toLowerCase()) || t.toLowerCase().includes(g)));
    const goal = Math.min(1, (goalHits.length + freeHits.length) / 2);
    if (goalHits.length) reasons.push(`Supports your goal${goalHits.length > 1 ? "s" : ""}: ${goalHits.map((g) => GOAL_LABELS[g].toLowerCase()).join(", ")}.`);
    else if (freeHits.length) reasons.push(`Fits what you said you want: "${freeHits[0]}".`);

    const related = experiences.filter((x) => x.source !== "sample" && experienceMatches(x, h));
    const rated = related.filter((x) => x.rating !== null);
    const avg = rated.length ? rated.reduce((a, x) => a + x.rating!, 0) / rated.length : null;
    const history = avg === null ? (related.length ? 0.6 : 0) : Math.max(0, (avg - 2) / 3);
    if (avg !== null && avg >= 4) reasons.push(`You rated ${rated.length === 1 ? `"${rated[0]!.title}"` : `${rated.length} related experiences`} ${avg.toFixed(1)}★.`);

    const from = active.find((a) => HOBBY_BY_ID.get(a.hobbyId!)?.nextSteps.includes(h.id));
    const progression = from ? 1 : 0;
    if (from) reasons.push(`A natural next step from ${from.name.toLowerCase()}.`);

    const novelty = related.length === 0 && !from ? prefs.explorationLevel / 3 : 0;
    const tryEvents = eventsForHobby(h, events, now);
    if (tryEvents.length) reasons.push(`${tryEvents.length} upcoming way${tryEvents.length === 1 ? "" : "s"} to try it.`);
    if (!reasons.length && interest >= 0.66) reasons.push(`Builds on your interest in ${CATEGORY_LABELS[h.categories[0]!].toLowerCase()}.`);

    const score = 25 * interest + 30 * goal + 20 * history + 20 * progression + 5 * novelty + (tryEvents.length ? 5 : 0);
    recs.push({ hobby: h, score: Math.round(score * 10) / 10, reasons, tryEvents });
  }
  return recs.sort((a, b) => b.score - a.score || a.hobby.name.localeCompare(b.hobby.name)).slice(0, limit);
}

/** Rated hobbies feed the taste profile the same way rated experiences do. */
export function hobbyTasteEntries(hobbies: UserHobby[]): Experience[] {
  return hobbies.flatMap((u) => {
    const h = u.hobbyId ? HOBBY_BY_ID.get(u.hobbyId) : undefined;
    if (!h || u.rating === null) return [];
    return [
      {
        id: `hobby-${u.id}`,
        eventId: null,
        title: u.name,
        category: h.categories[0]!,
        tags: h.tags,
        venueName: null,
        neighborhood: null,
        city: null,
        date: u.updatedAt.slice(0, 10),
        rating: u.rating,
        cost: null,
        withWhom: null,
        wasNew: null,
        notes: "",
        source: "manual" as const,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    ];
  });
}
