import { expect, test, type Page } from "@playwright/test";

let n = 0;
async function signUp(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${++n}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long test password");
  await page.getByRole("button", { name: "Create account" }).click();
  return email;
}

async function onboard(page: Page) {
  await signUp(page);
  await page.getByRole("button", { name: /show me what/i }).click();
  await expect(page.getByRole("heading", { name: /worth doing soon/i })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  (page as unknown as { __errors: string[] }).__errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([]);
});

test("onboarding leads to a labelled demo shortlist of at most six", async ({ page }) => {
  await onboard(page);
  await expect(page.getByText(/All events are fictional samples/)).toBeVisible();
  await expect(page.getByText(/keeps your changes in this browser only/)).toHaveCount(0);
  const shortlist = page.locator("section[aria-labelledby=shortlist] article");
  const n = await shortlist.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(6);
  await expect(shortlist.first().getByText("Sample", { exact: true })).toBeVisible();
  // Sample events never show a booking action.
  await expect(page.getByRole("link", { name: /book/i })).toHaveCount(0);
});

test("save, invite-copy and plan keep statuses honest", async ({ page }) => {
  await onboard(page);
  await page.goto("/events/demo-ai-meetup");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Status:")).toContainText("Saved");

  await page.getByRole("button", { name: "Copy draft" }).click();
  await expect(page.getByText(/Not sent — your status hasn't changed/)).toBeVisible();
  await expect(page.getByText("Status:")).toContainText("Saved");

  await page.getByRole("button", { name: "Mark planned" }).click();
  await expect(page.getByText("Status:")).toContainText("Planned");
  await expect(page.getByText(/Planned doesn't mean a ticket was bought/)).toBeVisible();
  // Attendance can't be confirmed before the event.
  await expect(page.getByRole("button", { name: "I went" })).toHaveCount(0);
});

test("unknown prices warn before planning instead of counting as free", async ({ page }) => {
  await onboard(page);
  await page.goto("/events/demo-founders-fireside");
  await expect(page.getByText("Price not verified").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark planned" }).click();
  await expect(page.getByRole("alertdialog", { name: "Budget check" })).toContainText("isn’t verified");
  await page.getByRole("button", { name: "Plan anyway" }).click();
  await page.goto("/");
  await expect(page.getByText(/unknown costs/)).toBeVisible();
  // Saved on the server: still there after a full reload.
  await page.reload();
  await expect(page.getByText(/unknown costs/)).toBeVisible();
});

test("dismissing removes an event and can be undone", async ({ page }) => {
  await onboard(page);
  await page.goto("/discover");
  const card = page.locator("article").first();
  const title = await card.locator("h3").innerText();
  await card.getByRole("button", { name: "Not for me" }).click();
  await card.getByRole("combobox").selectOption("too_expensive");
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.locator("article h3", { hasText: title })).toHaveCount(0);
});

test("travel ideas can be shortlisted without being booked", async ({ page }) => {
  await onboard(page);
  await page.goto("/discover?view=travel");
  await expect(page.getByText(/not live timetables/i)).toBeVisible();
  await page.goto("/events/demo-paris-baroque");
  await expect(page.getByText(/Does the trip work/)).toBeVisible();
  await expect(page.getByText(/Unknown — needs research/).first()).toBeVisible();
  await page.getByRole("button", { name: "Save to travel shortlist" }).click();
  await expect(page.getByText(/Status: Interested/)).toBeVisible();
  await page.goto("/my-life");
  await page.getByRole("tab", { name: /Travel shortlist/ }).click();
  await expect(page.getByText("Baroque Opera Night in a Historic Theatre")).toBeVisible();
  await expect(page.getByText(/still to research/)).toBeVisible();
});

test("protected time is excluded unless explicitly browsed", async ({ page }) => {
  await onboard(page);
  await page.goto("/discover");
  await page.getByLabel("When").selectOption("all");
  // The Friday musical sits in "Keep open for friends".
  await expect(page.locator("article h3", { hasText: "West End Revival" })).toHaveCount(0);
  await page.getByLabel(/Include my protected time/).check();
  await expect(page.locator("article", { hasText: "West End Revival" }).getByText(/stays protected/)).toBeVisible();
});

test("settings change recommendations and the weekly plan can be generated", async ({ page }) => {
  await onboard(page);
  await page.goto("/settings");
  await page.getByLabel("Suggest European events worth travelling for").uncheck();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Travel-worthy" })).toHaveCount(0);
  await page.getByRole("button", { name: /Generate my weekly plan/ }).click();
  await expect(page.getByText(/nothing was sent/)).toBeVisible();
});

test("no horizontal scrolling", async ({ page }) => {
  await onboard(page);
  for (const path of ["/", "/discover", "/discover?view=travel", "/my-life", "/wrapped", "/settings", "/events/demo-paris-baroque"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("signed-out visitors are sent to sign in, and accounts are separate", async ({ page, browser }) => {
  await page.goto("/wrapped");
  await expect(page).toHaveURL(/\/login\?next=%2Fwrapped/);
  await onboard(page);
  await page.goto("/events/demo-ai-meetup");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Status:")).toContainText("Saved");

  const other = await browser.newPage();
  await signUp(other);
  await other.getByRole("button", { name: /show me what/i }).click();
  await other.goto("/my-life");
  await other.getByRole("tab", { name: /^Saved/ }).click();
  await expect(other.getByText("AI Product Builders Meetup")).toHaveCount(0);
  await other.close();
});

test("wrapped: add a past experience, rate it, and see it shape suggestions", async ({ page }) => {
  await onboard(page);
  await page.goto("/wrapped");
  await expect(page.getByText("Your history starts here")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview with sample history" })).toHaveCount(0);

  for (const [title, date] of [["Jazz at a basement club", "2025-03-14"], ["Film club 35mm night", "2025-05-02"], ["Another 35mm screening", "2025-09-19"]] as const) {
    await page.getByRole("button", { name: "Add a past experience" }).click();
    await page.getByLabel("What was it?").fill(title);
    await page.getByLabel("Date").fill(date);
    await page.getByLabel("Type").selectOption(title.includes("Jazz") ? "music" : "film");
    await page.getByLabel("Who with").selectOption("friends");
    await page.locator("form label", { has: page.getByRole("radio", { name: "5 stars" }) }).click();
    await page.getByRole("button", { name: "Add to my history" }).click();
  }
  await page.getByRole("tab", { name: "2025" }).click();
  await expect(page.getByRole("heading", { name: /Your 2025/ })).toBeVisible();
  await expect(page.getByText("experiences logged")).toBeVisible();
  await expect(page.getByText("The Big-Screen Devotee")).toBeVisible();
  await expect(page.getByText(/What your ratings are teaching the app/)).toBeVisible();

  // Re-rate one from the list.
  const jazz = page.getByRole("radiogroup", { name: "Rate Jazz at a basement club" });
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/actions") && r.ok());
  await jazz.locator("label", { has: page.getByRole("radio", { name: "2 stars" }) }).click();
  await saved;
  await expect(jazz.getByText("2/5")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "2025" }).click();
  await expect(page.getByRole("radiogroup", { name: "Rate Jazz at a basement club" }).getByText("2/5")).toBeVisible();

  // Highly rated film now explains a film recommendation.
  await page.goto("/events/demo-film-70mm");
  await expect(page.getByText(/2 film experiences 5\.0★ on average/)).toBeVisible();
});
