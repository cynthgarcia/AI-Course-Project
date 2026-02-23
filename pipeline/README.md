# Weekly Investment Brief — Pipeline

Simple agent pipeline that runs the **Weekly Investment Brief** workflow: fetch US market + news → LLM generates the brief → email you Monday 8 AM.

## Setup

1. **Install dependencies** (from repo root):
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure secrets** (never commit `.env`):
   ```bash
   cp pipeline/config.example.env pipeline/.env
   ```
   Edit `pipeline/.env`:
   - `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic`)
   - `EMAIL_TO` — where to receive the brief
   - `SMTP_*` — so the script can send email (e.g. Gmail app password)

3. **Portfolio** — Edit `pipeline/portfolio.py` when you add/remove holdings (Fidelity + crypto list).

## Run once

From repo root:

```bash
python pipeline/run_brief.py
```

If email isn’t configured, the brief is printed to the terminal instead.

## Schedule for Monday 8:00 AM

**macOS (Tahoe 26.2 or other):**

1. Open your crontab:
   ```bash
   crontab -e
   ```
2. Add this line (runs every Monday at 8:00 AM in your Mac’s local timezone):

   ```
   0 8 * * 1 cd /Users/cynthia.garcia/AI-Course-Project && /usr/bin/env python3 pipeline/run_brief.py >> pipeline/cron.log 2>&1
   ```

3. Save and exit (`:wq` in vim, or Ctrl+X then Y in nano).

Output is appended to `pipeline/cron.log`. To use a specific timezone (e.g. Eastern), add a line above the cron job:
`TZ=America/New_York` (then your `0 8 * * 1` line).

**Other macOS / Linux:** Replace the path with your repo path (`/Users/YOUR_USERNAME/AI-Course-Project`).

## What the pipeline does

1. **Market data** — Fetches recent prices for S&P 500 (SPY), NASDAQ (QQQ), your portfolio tickers, and BTC/ETH via `yfinance`.
2. **News** — Fetches US-focused financial/macro headlines from RSS (e.g. Reuters).
3. **Brief** — Sends market + news to the LLM with your workflow context (US-only, higher risk tolerance, highest-ROI focus, portfolio list). The model returns the 7 sections: Market snapshot, Geopolitical & macro, Trends & risk, Stock ideas, When to buy, Portfolio review (sell/hold per ticker), Summary.
4. **Email** — Sends the brief to `EMAIL_TO` (or prints if not configured).

Workflow definition and user context live in `outputs/weekly-investment-brief-definition.md`.
