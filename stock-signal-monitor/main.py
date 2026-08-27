"""
Scheduler loop: checks the watchlist every CHECK_INTERVAL_MINUTES during
market hours, evaluates signals, and emails once per signal per day.

Run with:  python main.py
"""

import json
import logging
import os
import time
from datetime import datetime

import schedule
from zoneinfo import ZoneInfo

import config
import data_fetcher
import notifier
import signals as signals_module

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _load_state() -> set[str]:
    """
    Load the set of already-notified signal keys (ticker|strategy|action|date)
    so we don't email the same signal twice on the same day.
    """
    if not os.path.exists(config.STATE_FILE):
        return set()
    try:
        with open(config.STATE_FILE, "r") as f:
            return set(json.load(f))
    except (json.JSONDecodeError, OSError):
        logger.warning("Could not read state file %s, starting fresh", config.STATE_FILE)
        return set()


def _save_state(state: set[str]) -> None:
    with open(config.STATE_FILE, "w") as f:
        json.dump(sorted(state), f, indent=2)


def _signal_key(signal: signals_module.Signal) -> str:
    return f"{signal.ticker}|{signal.strategy}|{signal.action}|{signal.date}"


def is_market_hours(now: datetime | None = None) -> bool:
    """True if `now` (default: current time) falls within NYSE trading hours
    on a weekday. Used to skip checks outside market hours/weekends."""
    tz = ZoneInfo(config.MARKET_TIMEZONE)
    now = (now or datetime.now(tz)).astimezone(tz)

    if now.weekday() >= 5:  # Saturday/Sunday
        return False

    open_time = now.replace(
        hour=config.MARKET_OPEN_HOUR, minute=config.MARKET_OPEN_MINUTE,
        second=0, microsecond=0,
    )
    close_time = now.replace(
        hour=config.MARKET_CLOSE_HOUR, minute=config.MARKET_CLOSE_MINUTE,
        second=0, microsecond=0,
    )
    return open_time <= now <= close_time


def run_check() -> None:
    """One pass: fetch data, evaluate every ticker, email any new signals."""
    if not is_market_hours():
        logger.info("Outside market hours, skipping check.")
        return

    logger.info("Running signal check for watchlist: %s", config.WATCHLIST)
    state = _load_state()
    new_signals = []

    for ticker in config.WATCHLIST:
        history = data_fetcher.fetch_history(ticker)
        for signal in signals_module.evaluate_ticker(ticker, history):
            key = _signal_key(signal)
            if key in state:
                logger.info("Skipping already-notified signal: %s", key)
                continue
            new_signals.append(signal)
            state.add(key)

    if new_signals:
        try:
            notifier.send_signal_email(new_signals)
            _save_state(state)
        except notifier.EmailConfigError as e:
            logger.error("Could not send email: %s", e)
    else:
        logger.info("No new signals this check.")


def main() -> None:
    logger.info(
        "Starting stock signal monitor. Watchlist=%s, interval=%d min",
        config.WATCHLIST, config.CHECK_INTERVAL_MINUTES,
    )

    # Run once immediately on startup, then on the configured interval.
    run_check()
    schedule.every(config.CHECK_INTERVAL_MINUTES).minutes.do(run_check)

    while True:
        schedule.run_pending()
        # Sleep briefly between checks instead of busy-spinning; capped at
        # 30s so we still wake up promptly once a job is actually due.
        idle = schedule.idle_seconds()
        time.sleep(min(idle, 30) if idle and idle > 0 else 1)


if __name__ == "__main__":
    main()
