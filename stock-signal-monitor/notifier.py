"""
Sends email notifications via SMTP when a signal triggers.

The email app password is NEVER hardcoded - it is read at runtime from the
STOCK_MONITOR_EMAIL_PASSWORD environment variable. See README.md for how to
generate an app password and set the environment variable.
"""

import logging
import os
import smtplib
from email.mime.text import MIMEText

import config
from signals import Signal

logger = logging.getLogger(__name__)

EMAIL_PASSWORD_ENV_VAR = "STOCK_MONITOR_EMAIL_PASSWORD"


class EmailConfigError(RuntimeError):
    """Raised when required email configuration/credentials are missing."""


def _build_message(signals: list[Signal]) -> MIMEText:
    lines = ["The following technical signals triggered:\n"]
    for s in signals:
        lines.append(f"[{s.ticker}] {s.action} ({s.strategy}) - {s.detail}")

    lines.append(
        "\nThis is an automated message from a lagging-indicator "
        "decision-support tool. It is not financial advice."
    )

    body = "\n".join(lines)
    tickers = ", ".join(sorted({s.ticker for s in signals}))

    msg = MIMEText(body)
    msg["Subject"] = f"Stock signal alert: {tickers}"
    msg["From"] = config.EMAIL_FROM
    msg["To"] = config.EMAIL_TO
    return msg


def send_signal_email(signals: list[Signal]) -> None:
    """Send a single email covering all newly-triggered signals."""
    if not signals:
        return

    password = os.environ.get(EMAIL_PASSWORD_ENV_VAR)
    if not password:
        raise EmailConfigError(
            f"{EMAIL_PASSWORD_ENV_VAR} environment variable is not set. "
            "See README.md for setup instructions."
        )
    if not config.EMAIL_FROM or not config.EMAIL_TO:
        raise EmailConfigError(
            "STOCK_MONITOR_EMAIL_FROM (and optionally STOCK_MONITOR_EMAIL_TO) "
            "environment variable(s) must be set. See README.md."
        )

    msg = _build_message(signals)

    with smtplib.SMTP(config.SMTP_SERVER, config.SMTP_PORT) as server:
        server.starttls()
        server.login(config.EMAIL_FROM, password)
        server.send_message(msg)

    logger.info("Sent email notification for %d signal(s)", len(signals))
