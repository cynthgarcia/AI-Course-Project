---
name: portfolio-reviewer
description: Generates a per-holding sell / hold / trim / add recommendation table for the user's portfolio. Inputs: portfolio list, market data summary, trends and risk summary. Outputs a markdown table of ticker | action | reasoning.
---

# Skill: Portfolio Reviewer

**Purpose:** Generate a per-holding sell / hold / trim / add recommendation table for the user's portfolio, aligned with their investment profile.

---

## Inputs

When this skill is invoked, you will receive:
1. **Portfolio list** — the user's current holdings (equities + crypto)
2. **Market data summary** — from Step 1 of the Weekly Investment Brief (prices, weekly performance, index moves)
3. **Trends and risk summary** — from Step 3 (themes, risks, catalysts)

If the portfolio list was not passed explicitly, read it from `pipeline/portfolio.py`. The current holdings are:

**Equities / ETFs (Fidelity — source of truth):**
| Ticker | Name |
|--------|------|
| FBCG   | Fidelity Blue Chip Growth |
| FTEC   | Fidelity MSCI Information Technology |
| GOOGL  | Google (Alphabet) |
| NVDA   | NVIDIA |
| SCHG   | Schwab U.S. Large-Cap Growth ETF |
| SPY    | SPDR S&P 500 ETF |
| VOO    | Vanguard S&P 500 ETF |
| MSFT   | Microsoft |

**Crypto (Coinbase — included for volatility context):**
| Symbol  | Asset     |
|---------|-----------|
| BTC-USD | Bitcoin   |
| ETH-USD | Ethereum  |

---

## User Profile (for recommendation logic)

- **Age:** 29, growth/retirement focus
- **Risk tolerance:** Higher risk acceptable
- **Scope:** US-only
- **Goal:** Maximize ROI; comfortable holding volatile positions for long-term growth

---

## Recommendation Logic

For each holding, assess:

1. **Performance signal:** Is the position up or down this week / month? Is the trend momentum positive or negative?
2. **Sector trend alignment:** Does the holding's sector align with the current week's themes and highest-ROI trends?
3. **Risk context:** Are there specific risks (earnings, macro, regulatory) that could hurt this holding in the near term?
4. **User profile fit:** Does this holding make sense for a 29-year-old with higher risk tolerance and growth focus?

Based on the above, assign one of:
- **Add** — strong conviction, aligns with trends, risk acceptable given profile
- **Hold** — neutral; no strong reason to sell or buy more right now
- **Trim** — reducing position makes sense (e.g. overweight, near resistance, risk elevated)
- **Sell** — clear exit signal (e.g. trend reversal, fundamental deterioration, better alternatives exist)

---

## Output Format

Return a markdown table:

| Ticker | Action | Reasoning |
|--------|--------|-----------|
| FBCG   | Hold   | Broad growth ETF; no near-term catalyst to add but solid long-term hold given tech trend. |
| FTEC   | Add    | Tech sector momentum strong this week; aligns with AI/semiconductor theme. |
| GOOGL  | Hold   | Stable; watch next earnings. No urgent action. |
| NVDA   | Hold   | Elevated after recent run; hold for continued AI demand but avoid chasing. |
| SCHG   | Hold   | Large-cap growth ETF; consistent with profile; no action needed. |
| SPY    | Hold   | Core S&P 500 position; keep. |
| VOO    | Hold   | Overlap with SPY; consider consolidating if desired, but no urgency. |
| MSFT   | Add    | Cloud + AI momentum; ongoing investment makes sense at current levels. |
| BTC    | Hold   | Volatile week; hold unless near target exit level. |
| ETH    | Hold   | Lower momentum than BTC this week; hold for long-term thesis. |

*(Populate with actual reasoning based on the data provided.)*

---

## Failure Handling

- **Missing price data for a ticker:** Mark action as "data unavailable" and note in the reasoning column. Continue with remaining holdings.
- **Portfolio list unavailable:** Use the hardcoded list above and note that the file could not be read.
- **Contradictory signals:** Default to "Hold" with a note explaining the conflicting signals.

---

## Notes

- Crypto holdings are included for volatility context and general portfolio awareness, not as primary equity positions.
- Do not recommend selling core index ETFs (SPY, VOO, SCHG) unless there is a strong, specific reason — these are long-term diversification anchors.
- Keep reasoning concise: 1–2 sentences per holding.
