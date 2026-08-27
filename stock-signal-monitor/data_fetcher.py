"""
Pulls historical daily price data for watchlist tickers using yfinance.

yfinance scrapes free, public Yahoo Finance data - no API key is required.
"""

import logging

import pandas as pd
import yfinance as yf

import config

logger = logging.getLogger(__name__)


def fetch_history(ticker: str, period: str = config.HISTORY_PERIOD) -> pd.DataFrame:
    """
    Fetch daily OHLCV history for a single ticker.

    Returns a DataFrame indexed by date with at least a "Close" column.
    Returns an empty DataFrame if no data could be retrieved, so callers
    can skip a ticker without crashing the whole run.
    """
    try:
        data = yf.Ticker(ticker).history(period=period, interval="1d")
    except Exception:
        logger.exception("Failed to fetch data for %s", ticker)
        return pd.DataFrame()

    if data is None or data.empty:
        logger.warning("No price data returned for %s", ticker)
        return pd.DataFrame()

    return data


def fetch_watchlist_history(tickers: list[str]) -> dict[str, pd.DataFrame]:
    """Fetch history for every ticker in the watchlist, keyed by ticker."""
    return {ticker: fetch_history(ticker) for ticker in tickers}
