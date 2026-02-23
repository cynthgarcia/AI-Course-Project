# Workflow Definition: Weekly Investment Brief

## Scenario Metadata

| Field | Content |
|-------|---------|
| **Workflow name** | Weekly Investment Brief |
| **Description** | A weekly email brief that analyzes the market, geopolitical context, trends/risk, stock ideas, when-to-buy timing, and a review of the user's current portfolio (sell/hold reasoning). Delivered every Monday at 8:00 AM so the user can act at market open. |
| **Outcome** | User receives one actionable email each Monday morning with everything needed to inform buy/sell/hold decisions and manage their portfolio. |
| **Trigger** | Schedule: every **Monday at 8:00 AM** (user's local time — when they log in and when the market opens). |
| **Type** | Autonomous Agent |
| **Business objective** | Consolidate market research, macro/geopolitical context, timing, and portfolio review into a single weekly habit so the user can invest with better information and manage their Fidelity (and crypto) holdings without manual scraping. |
| **Current owner** | User (personal workflow). |

### User context (for brief tone and recommendations)

- **Age:** 29, about to turn 30.
- **Risk tolerance:** Higher risk acceptable now; not overly conservative. Goal is to retire at a reasonable age and leverage investments to increase net worth; okay with more risk at this age.
- **Market scope:** **US-focused only** — not investing in UK or global markets at the moment.
- **Sectors/themes:** Highlight the ones with the **highest return on investment**; okay to skip sectors that don’t offer the best ROI (no need to cover all sectors).

---

## Refined Steps

### Step 1 — Analyze the market
- **Action:** Analyze current stock market state: ups and downs, trends, what caused moves from the previous week, volatility from last week into this week.
- **Sub-steps:** Pull market data (indices, relevant sectors); compare to prior week; summarize drivers of dips/rallies and volatility.
- **Data in:** Prior week and current market data (e.g. indices, user-defined scope).
- **Data out:** Market snapshot summary (performance, trends, causes, volatility).
- **Context needs:** **US-only.** Indices: S&P 500, NASDAQ. Focus on sectors/themes with the highest return potential; skip low-ROI sectors.
- **Failure modes:** Missing or delayed market data → retry or summarize with available data; note gaps in brief.

### Step 2 — Geopolitical and macro context
- **Action:** Identify geopolitical and macro developments that could impact the market this week.
- **Sub-steps:** Gather headlines/summaries (politics, central banks, trade, key regions); filter for market-relevant items; summarize implications.
- **Data in:** News/headlines (sources TBD).
- **Data out:** Short “what to watch” list (geopolitical/macro) with impact angle.
- **Context needs:** US-relevant macro/geopolitical news (Fed, trade, US politics); regions that impact US markets.
- **Failure modes:** News feed failure → skip section and note in brief; rate limits → use cached or reduced set.

### Step 3 — Trends and risk
- **Action:** From the analysis above, identify trends, risks, and what could change (dips, spikes) so the user can think about timing.
- **Sub-steps:** Synthesize market + macro into trend and risk narrative; highlight potential catalysts and volatility drivers.
- **Data in:** Outputs from Steps 1 and 2.
- **Data out:** Trends and risk summary (what could move, where risk is).
- **Context needs:** None beyond Steps 1–2.
- **Failure modes:** If Steps 1–2 are thin, trend/risk section may be shorter; state “limited data” where appropriate.

### Step 4 — Stock recommendations
- **Action:** Recommend top stocks to look at that could yield the highest returns, informed by the week’s context.
- **Sub-steps:** Combine market + macro + trends; rank or filter ideas; output a short list with brief rationale.
- **Data in:** Outputs from Steps 1–3.
- **Data out:** Top stock ideas with concise reasoning.
- **Context needs:** User is 29, higher risk tolerance, goal = grow net worth for retirement. Highlight **highest-ROI sectors/themes**; prioritize growth over conservative picks.
- **Failure modes:** Same as Steps 1–2 if data is missing; reduce number of ideas and say why.

### Step 5 — When to buy
- **Action:** Dedicated step: suggest when to enter or add to positions (timing for buys) based on volatility and catalysts.
- **Sub-steps:** Use volatility and catalyst info from Steps 1–3; suggest windows or conditions for buying (e.g. “on pullbacks,” “after X event”).
- **Data in:** Outputs from Steps 1–3 (and optionally Step 4).
- **Data out:** When-to-buy guidance (timing, conditions).
- **Context needs:** None beyond prior steps.
- **Failure modes:** If volatility/catalyst data is weak, state that timing is uncertain; avoid over-specific time predictions.

### Step 6 — Portfolio review
- **Action:** Analyze the user’s current holdings and recommend sell / hold (or trim/add) with reasoning for each position so they can better manage their portfolio.
- **Sub-steps:** For each holding, get current price/performance and recent news; compare to market/trend context; output sell/hold (or trim/add) with short reasoning.
- **Data in:** **User portfolio list** (see Context Shopping List); current prices and optional news for each ticker/symbol.
- **Data out:** Per-holding recommendation (sell / hold / trim / add) with reasoning.
- **Context needs:** **Portfolio list** (authoritative); Fidelity as source of truth; include crypto (Bitcoin, Ethereum) for volatility context.
- **Failure modes:** Missing price for a ticker → skip that line or mark “data unavailable”; list out of date → remind user to update list.

### Step 7 — Save the brief
- **Action:** Assemble all 7 sections into a formatted markdown file and save it to the output folder.
- **Sub-steps:** Invoke the `brief-saver` skill; skill assembles sections 1–6 plus a summary into structured markdown; Write tool saves to `Weekly Brief Updates/brief-YYYY-MM-DD.md`; confirm file path to user.
- **Data in:** All outputs from Steps 1–6; today’s date for filename.
- **Data out:** `Weekly Brief Updates/brief-YYYY-MM-DD.md` — one markdown file with all sections and H2 headings.
- **Context needs:** Output folder path (`Weekly Brief Updates/`; auto-created by Write tool if absent). No email or SMTP configuration needed.
- **Failure modes:** Write tool fails → print full brief to terminal so no content is lost; inform user to save manually.
- **Implementation:** Claude Code subagent (`.claude/agents/weekly-investment-brief.md`); invoke with "Run the weekly investment brief."

---

## Step Sequence and Dependencies

| Step | Depends on | Can run in parallel with |
|------|------------|---------------------------|
| 1. Analyze the market | Trigger | — |
| 2. Geopolitical and macro context | Trigger | Step 1 |
| 3. Trends and risk | Steps 1, 2 | — |
| 4. Stock recommendations | Steps 1, 2, 3 | — |
| 5. When to buy | Steps 1, 2, 3 | Step 4 |
| 6. Portfolio review | Steps 1, 2, 3; portfolio list | Step 4, 5 (needs market context, not their outputs) |
| 7. Deliver the brief | Steps 1–6 | — |

- **Sequential:** 1 → 3 → 4 → 5; 2 can run in parallel with 1; 6 can run once 1–3 are done (and portfolio list is available); 7 is last.
- **Critical path:** 1 & 2 → 3 → 4 & 5 & 6 (all three can be parallelized after 3) → 7.

---

## Context Shopping List

| Artifact | Description | Used by steps | Status | Key contents |
|----------|-------------|----------------|--------|--------------|
| **Portfolio list** | User’s current holdings (Fidelity as source of truth; crypto in other portfolios). | 6 | **Exists** — user-provided | See below. |
| **Market data source(s)** | APIs or feeds for indices, prices, volatility. | 1, 4, 6 | Needs creation/selection | S&P 500, NASDAQ; optional FTSE/crypto. |
| **News/headlines source(s)** | Source(s) for geopolitical and macro news. | 2 | Needs creation/selection | Fed, UK/EU, trade, key regions. |
| **Scope preferences** | Which markets, indices, sectors to emphasize. | 1, 2, 4 | **Set** | **US-only.** S&P 500, NASDAQ. Sectors/themes with **highest ROI** (skip low-ROI). Bitcoin/Ethereum volatility. User: 29, higher risk tolerance, growth/retirement focus. |
| **Output folder** | Directory where the markdown brief is saved. | 7 | Auto-created | `Weekly Brief Updates/`; Write tool creates it if absent. |

### Portfolio list (user-provided)

**Equities / ETFs (Fidelity — source of truth):**

| Symbol | Name / note |
|--------|-------------|
| FBCG | Fidelity Blue Chip Growth |
| FTEC | Fidelity MSCI Information Technology |
| GOOGL | Google (Alphabet) |
| NVDA | NVIDIA |
| SCHG | Schwab U.S. Large-Cap Growth ETF |
| SPY | SPDR S&P 500 ETF |
| VOO | Vanguard S&P 500 ETF |
| MSFT | Microsoft (ongoing investment) |

**Crypto (other portfolios, e.g. Coinbase):**

| Asset | Note |
|-------|------|
| Bitcoin | Include volatility and context in brief |
| Ethereum | Include volatility and context in brief |

*Note:* For “Google” we assume GOOGL (Alphabet Class A). If you use GOOG (Class C), say so and we’ll switch. Portfolio review (Step 6) will use this list; you can later add file upload (e.g. Fidelity export) to refresh it automatically.

---

## Decision Points

- **Step 1–2:** If a data source is down or rate-limited, use cached or partial data and note in the brief (no hard fail).
- **Step 6:** If a ticker has no price or is delisted, skip that line or mark “unavailable” and remind user to update the portfolio list.
- **Step 7:** If the Write tool fails, print the full brief to the terminal; do not block upstream steps from having run. No email or SMTP required.

---

## Future extensions (not in scope for v1)

- **Podcast / audio:** Generate an audio version of the brief for Monday commute or morning walk.
- **Portfolio file upload:** Accept Fidelity (or other) export to refresh the portfolio list automatically instead of a static list.
