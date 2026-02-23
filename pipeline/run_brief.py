#!/usr/bin/env python3
"""
Weekly Investment Brief — simple agent pipeline.

Runs the workflow: fetch US market + news data → LLM generates brief → email.
Schedule for Monday 8:00 AM (e.g. cron) so you get the brief at market open.

Usage:
  pip install -r requirements.txt
  cp pipeline/config.example.env pipeline/.env   # edit with your keys & email
  python pipeline/run_brief.py
"""

import os
import sys
from pathlib import Path

# Ensure pipeline dir is on path so "from portfolio import ..." works when run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

# Load env from pipeline/.env or project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

import yfinance as yf
import feedparser

from portfolio import PORTFOLIO_TICKERS, CRYPTO_ASSETS

# --- Config from env ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
EMAIL_TO = os.getenv("EMAIL_TO")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def fetch_market_data():
    """Fetch US indices and portfolio tickers + crypto; return text summary for the LLM."""
    indices = ["SPY", "QQQ"]  # S&P 500, NASDAQ
    tickers = indices + PORTFOLIO_TICKERS + CRYPTO_ASSETS
    end = datetime.now()
    start = end - timedelta(days=14)

    data_lines = []
    for sym in tickers:
        try:
            t = yf.Ticker(sym)
            hist = t.history(start=start, end=end)
            if hist.empty or len(hist) < 2:
                data_lines.append(f"{sym}: no recent data")
                continue
            last = hist["Close"].iloc[-1]
            prev_week = hist["Close"].iloc[-1] if len(hist) < 6 else hist["Close"].iloc[-6]
            pct = ((last - prev_week) / prev_week * 100) if prev_week else 0
            data_lines.append(f"{sym}: close={last:.2f} (1w ago ~{prev_week:.2f}), ~{pct:+.1f}% vs week ago")
        except Exception as e:
            data_lines.append(f"{sym}: error — {e}")

    return "\n".join(data_lines)


def fetch_news():
    """Fetch US-focused financial/macro headlines (RSS)."""
    feeds = [
        "https://feeds.reuters.com/reuters/businessNews",
        "https://finance.yahoo.com/news/rssindex",
    ]
    headlines = []
    for url in feeds:
        try:
            feed = feedparser.parse(url)
            for e in feed.entries[:8]:
                title = e.get("title", "")
                if title and len(headlines) < 15:
                    headlines.append(title)
        except Exception:
            pass
    return "\n".join(headlines[:15]) if headlines else "(No headlines retrieved)"


def build_prompt(market_text: str, news_text: str) -> tuple[str, str]:
    """Build system and user prompts for the LLM."""
    system = """You are writing the Weekly Investment Brief for one investor. They are 29, higher risk tolerance, goal to grow net worth and retire at a reasonable age. Scope: US markets only (no UK/global). Focus on sectors and themes with the highest return potential; skip low-ROI sectors. Be concise and actionable."""

    user = f"""Use the following data to write one cohesive Weekly Investment Brief in plain text. Structure your response with these sections and clear headings:

1) MARKET SNAPSHOT — Ups and downs, trends, what caused moves vs last week, volatility (US indices and context only).
2) GEOPOLITICAL & MACRO — What could impact US markets this week (Fed, trade, US politics).
3) TRENDS & RISK — What could change (dips, spikes), where risk is, timing implications.
4) STOCK IDEAS — Top stocks/themes for highest return potential this week (brief rationale each).
5) WHEN TO BUY — When to enter or add positions (timing/conditions).
6) PORTFOLIO REVIEW — For each holding below, give one line: ticker — Sell / Hold / Trim / Add — short reasoning. Holdings: {", ".join(PORTFOLIO_TICKERS + CRYPTO_ASSETS)}.
7) Wrap with a one-line summary.

Data below is raw; interpret and summarize. If data is missing, say so briefly.

--- MARKET DATA (recent closes, ~1w change) ---
{market_text}

--- RECENT HEADLINES (US/finance/macro) ---
{news_text}
"""

    return system, user


def call_llm(system: str, user: str) -> str:
    """Generate the brief using OpenAI or Anthropic."""
    if LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY:
        return _call_anthropic(system, user)
    if OPENAI_API_KEY:
        return _call_openai(system, user)
    raise RuntimeError("Set OPENAI_API_KEY or ANTHROPIC_API_KEY (and LLM_PROVIDER=anthropic if using Claude) in .env")


def _call_openai(system: str, user: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=3000,
    )
    return r.choices[0].message.content or ""


def _call_anthropic(system: str, user: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    m = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=3000,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return m.content[0].text if m.content else ""


def send_email(body: str):
    """Send the brief to EMAIL_TO via SMTP."""
    if not all([EMAIL_TO, SMTP_USER, SMTP_PASSWORD]):
        print("Email not configured (EMAIL_TO, SMTP_USER, SMTP_PASSWORD). Skipping send.")
        print("--- Brief (first 1500 chars) ---")
        print(body[:1500])
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Weekly Investment Brief — {datetime.now().strftime('%Y-%m-%d')}"
    msg["From"] = SMTP_USER
    msg["To"] = EMAIL_TO
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASSWORD)
        s.sendmail(SMTP_USER, [EMAIL_TO], msg.as_string())
    print("Brief sent to", EMAIL_TO)


def main():
    print("Fetching market data...")
    market_text = fetch_market_data()
    print("Fetching news...")
    news_text = fetch_news()
    system, user = build_prompt(market_text, news_text)
    print("Generating brief...")
    body = call_llm(system, user)
    print("Sending email...")
    send_email(body)
    print("Done.")


if __name__ == "__main__":
    main()
    sys.exit(0)
