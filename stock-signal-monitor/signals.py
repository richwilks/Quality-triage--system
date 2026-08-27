"""
Technical analysis signal calculations.

Two independent strategies are implemented:

1. SMA crossover (50-day vs 200-day simple moving average)
   - "Golden cross": short SMA crosses ABOVE the long SMA -> BUY signal.
   - "Death cross": short SMA crosses BELOW the long SMA -> SELL signal.
   These are both lagging trend-following signals - they only fire on the
   day the crossover actually happens, not while one average is merely
   above/below the other.

2. RSI (Relative Strength Index, 14-day)
   - RSI <= oversold threshold (default 30) -> BUY signal (potentially
     oversold, due for a bounce).
   - RSI >= overbought threshold (default 70) -> SELL signal (potentially
     overbought, due for a pullback).

Both are classic, widely used but lagging/backwards-looking indicators.
See the README disclaimer - this is not financial advice.
"""

from dataclasses import dataclass

import pandas as pd

import config


@dataclass
class Signal:
    ticker: str
    strategy: str   # "SMA_CROSSOVER" or "RSI"
    action: str      # "BUY" or "SELL"
    detail: str       # human-readable explanation for the email body
    date: str         # ISO date the signal fired on, used for dedupe


def calculate_sma(prices: pd.Series, window: int) -> pd.Series:
    """Simple moving average over `window` trading days."""
    return prices.rolling(window=window, min_periods=window).mean()


def calculate_rsi(prices: pd.Series, window: int = config.RSI_WINDOW) -> pd.Series:
    """
    Classic Wilder RSI over `window` trading days.

    RSI = 100 - (100 / (1 + RS)), where RS is the ratio of the average gain
    to the average loss over the window. Uses Wilder's smoothing (an
    exponential moving average with alpha = 1/window), which is the
    standard definition used by most charting platforms.
    """
    delta = prices.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)

    avg_gain = gains.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    # Where there have been no losses at all, RS is infinite and RSI is 100.
    rsi = rsi.where(avg_loss != 0, 100)
    return rsi


def check_sma_crossover(ticker: str, history: pd.DataFrame) -> Signal | None:
    """
    Look at the most recent two days to detect a crossover event (the
    point where the short SMA and long SMA swap order), not just whichever
    side they currently sit on.
    """
    closes = history["Close"]
    short_sma = calculate_sma(closes, config.SMA_SHORT_WINDOW)
    long_sma = calculate_sma(closes, config.SMA_LONG_WINDOW)

    valid = short_sma.notna() & long_sma.notna()
    if valid.sum() < 2:
        return None  # not enough history yet for both averages

    valid_idx = short_sma[valid].index
    today_idx = valid_idx[-1]
    prev_idx = valid_idx[-2]

    today_diff = short_sma[today_idx] - long_sma[today_idx]
    prev_diff = short_sma[prev_idx] - long_sma[prev_idx]

    date_str = pd.Timestamp(today_idx).date().isoformat()

    if prev_diff <= 0 < today_diff:
        return Signal(
            ticker=ticker,
            strategy="SMA_CROSSOVER",
            action="BUY",
            detail=(
                f"Golden cross: {config.SMA_SHORT_WINDOW}-day SMA "
                f"({short_sma[today_idx]:.2f}) crossed above the "
                f"{config.SMA_LONG_WINDOW}-day SMA ({long_sma[today_idx]:.2f})."
            ),
            date=date_str,
        )

    if prev_diff >= 0 > today_diff:
        return Signal(
            ticker=ticker,
            strategy="SMA_CROSSOVER",
            action="SELL",
            detail=(
                f"Death cross: {config.SMA_SHORT_WINDOW}-day SMA "
                f"({short_sma[today_idx]:.2f}) crossed below the "
                f"{config.SMA_LONG_WINDOW}-day SMA ({long_sma[today_idx]:.2f})."
            ),
            date=date_str,
        )

    return None


def check_rsi(ticker: str, history: pd.DataFrame) -> Signal | None:
    """Flag today's RSI if it is at or past the oversold/overbought thresholds."""
    closes = history["Close"]
    rsi = calculate_rsi(closes)

    valid = rsi.dropna()
    if valid.empty:
        return None  # not enough history yet

    today_idx = valid.index[-1]
    today_rsi = valid[today_idx]
    date_str = pd.Timestamp(today_idx).date().isoformat()

    if today_rsi <= config.RSI_OVERSOLD_THRESHOLD:
        return Signal(
            ticker=ticker,
            strategy="RSI",
            action="BUY",
            detail=(
                f"RSI({config.RSI_WINDOW}) = {today_rsi:.1f}, at or below the "
                f"oversold threshold of {config.RSI_OVERSOLD_THRESHOLD}."
            ),
            date=date_str,
        )

    if today_rsi >= config.RSI_OVERBOUGHT_THRESHOLD:
        return Signal(
            ticker=ticker,
            strategy="RSI",
            action="SELL",
            detail=(
                f"RSI({config.RSI_WINDOW}) = {today_rsi:.1f}, at or above the "
                f"overbought threshold of {config.RSI_OVERBOUGHT_THRESHOLD}."
            ),
            date=date_str,
        )

    return None


def evaluate_ticker(ticker: str, history: pd.DataFrame) -> list[Signal]:
    """Run every strategy against a ticker's history and collect any hits."""
    if history.empty:
        return []

    signals = []
    for check in (check_sma_crossover, check_rsi):
        signal = check(ticker, history)
        if signal is not None:
            signals.append(signal)
    return signals
