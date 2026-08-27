# Stock Signal Monitor

A small Python tool that watches a list of tickers, computes two classic
technical-analysis signals, and emails you when one triggers:

- **SMA crossover** — 50-day vs 200-day simple moving average. A "golden
  cross" (50-day crosses above the 200-day) is flagged as a **BUY**; a
  "death cross" (50-day crosses below the 200-day) is flagged as a **SELL**.
- **RSI (14-day)** — flags **BUY** when RSI ≤ 30 (oversold) and **SELL**
  when RSI ≥ 70 (overbought).

Price data comes from [yfinance](https://pypi.org/project/yfinance/), which
pulls free public data from Yahoo Finance — no API key needed.

> **Disclaimer:** This is a decision-support tool built on lagging,
> backward-looking technical indicators. It is **not financial advice**.
> Signals can be wrong, delayed, or based on incomplete/erroneous data.
> Always do your own research and consult a licensed financial advisor
> before making investment decisions.

## Project structure

| File               | Purpose                                                              |
|--------------------|-----------------------------------------------------------------------|
| `config.py`        | Watchlist, check interval, market hours, and strategy thresholds     |
| `data_fetcher.py`  | Pulls historical daily price data via `yfinance`                     |
| `signals.py`       | Calculates SMA crossover and RSI signals                             |
| `notifier.py`      | Sends the email alert via SMTP                                       |
| `main.py`          | Scheduler loop that ties it all together and dedupes notifications   |

## Setup

### 1. Install dependencies

```bash
cd stock-signal-monitor
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set up an email app password

The notifier sends mail over SMTP (Gmail by default). Gmail requires an
**app password**, not your regular account password:

1. Enable 2-Step Verification on your Google account, if not already on.
2. Go to [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords).
3. Create an app password for "Mail" and copy the 16-character code.

Using a different provider (Outlook, Yahoo, etc.)? Update `SMTP_SERVER` and
`SMTP_PORT` in `config.py` to match, and generate an app password/SMTP
credential the same way with that provider.

### 3. Set the required environment variables

Credentials are **never** hardcoded — they're read from the environment at
runtime:

```bash
export STOCK_MONITOR_EMAIL_FROM="you@gmail.com"        # account that owns the app password
export STOCK_MONITOR_EMAIL_TO="you@gmail.com"           # where alerts get sent (defaults to FROM)
export STOCK_MONITOR_EMAIL_PASSWORD="xxxx xxxx xxxx xxxx"  # the app password from step 2
```

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`) or a `.env` file
loaded by your process manager so you don't have to re-export them every
session. **Never commit these values to source control.**

### 4. Run it

```bash
python main.py
```

This runs one check immediately, then re-checks every `CHECK_INTERVAL_MINUTES`
(default: 15) while the market is open (9:30am–4:00pm US/Eastern, weekdays).
Outside those hours the loop stays alive but skips the check. Leave the
process running (e.g. in a terminal, `tmux`/`screen` session, or as a
background service) for continuous monitoring.

Each triggered signal is emailed only **once per ticker/strategy/action per
day** — state is tracked in `signal_state.json` (created automatically) so
restarting the script the same day won't re-send alerts you already got.

## Adding more tickers

Edit the `WATCHLIST` list in `config.py`:

```python
WATCHLIST = ["NVDA", "AAPL", "MSFT"]
```

Use any ticker symbol recognized by Yahoo Finance. No other changes are
needed — `main.py` loops over every ticker in the list automatically.

## Adjusting thresholds

All strategy parameters live in `config.py`:

- `SMA_SHORT_WINDOW` / `SMA_LONG_WINDOW` — the two moving-average windows
  (default 50/200 days).
- `RSI_WINDOW` — RSI lookback period (default 14 days).
- `RSI_OVERSOLD_THRESHOLD` / `RSI_OVERBOUGHT_THRESHOLD` — RSI trigger
  levels (default 30/70).
- `CHECK_INTERVAL_MINUTES` — how often the loop re-checks prices.
