"""
Portfolio list for the Weekly Investment Brief (Fidelity = source of truth).
Update this file when you add/remove holdings.
"""

# Equities / ETFs (Fidelity)
PORTFOLIO_TICKERS = [
    "FBCG",   # Fidelity Blue Chip Growth
    "FTEC",   # Fidelity MSCI Information Technology
    "GOOGL",  # Google (Alphabet)
    "NVDA",   # NVIDIA
    "SCHG",   # Schwab U.S. Large-Cap Growth ETF
    "SPY",    # SPDR S&P 500 ETF
    "VOO",    # Vanguard S&P 500 ETF
    "MSFT",   # Microsoft
]

# Crypto (other portfolios, e.g. Coinbase) — included for volatility context
CRYPTO_ASSETS = ["BTC-USD", "ETH-USD"]  # yfinance symbols for Bitcoin, Ethereum
