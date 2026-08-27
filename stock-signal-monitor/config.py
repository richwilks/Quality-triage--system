"""
Configuration for the stock signal monitor.

Edit the values below to change what gets watched, how often, and the
thresholds used by the technical indicators in signals.py.
"""

# --- Watchlist -----------------------------------------------------------
# Tickers to monitor, as recognized by Yahoo Finance (used by yfinance).
# To add more tickers, just append them to this list, e.g.:
#   WATCHLIST = ["NVDA", "AAPL", "MSFT"]
WATCHLIST = ["NVDA"]

# --- Scheduling ------------------------------------------------------------
# How often (in minutes) to re-check prices and recompute signals.
CHECK_INTERVAL_MINUTES = 15

# Market hours the checks should run within, in US/Eastern time (NYSE hours).
# The scheduler loop in main.py skips checks outside this window and on
# weekends, so it doesn't waste API calls when the market is closed.
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 30
MARKET_CLOSE_HOUR = 16
MARKET_CLOSE_MINUTE = 0
MARKET_TIMEZONE = "America/New_York"

# --- Historical data ---------------------------------------------------
# How much daily history to pull. Needs to comfortably cover the longest
# moving average window (200 days) plus a buffer for holidays/weekends.
HISTORY_PERIOD = "1y"

# --- Strategy thresholds -------------------------------------------------
# SMA crossover windows (in trading days).
SMA_SHORT_WINDOW = 50
SMA_LONG_WINDOW = 200

# RSI settings.
RSI_WINDOW = 14
RSI_OVERSOLD_THRESHOLD = 30    # RSI <= this -> potential BUY (oversold)
RSI_OVERBOUGHT_THRESHOLD = 70  # RSI >= this -> potential SELL (overbought)

# --- Email notification ---------------------------------------------------
# SMTP server settings. Defaults are set up for Gmail; change if you use a
# different provider. The password itself is NEVER stored here - it is read
# from the STOCK_MONITOR_EMAIL_PASSWORD environment variable at runtime
# (see notifier.py and README.md).
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# Address the notification is sent from (must match the account that owns
# the app password) and the address it is sent to. Both can be overridden
# with environment variables so credentials/addresses don't need to live
# in source control.
import os  # noqa: E402  (kept local to this section for clarity)

EMAIL_FROM = os.environ.get("STOCK_MONITOR_EMAIL_FROM", "")
EMAIL_TO = os.environ.get("STOCK_MONITOR_EMAIL_TO", EMAIL_FROM)

# --- Signal dedupe state file ---------------------------------------------
# Where main.py records which (ticker, signal, date) combinations have
# already been emailed, so it doesn't send duplicate alerts the same day.
STATE_FILE = "signal_state.json"
