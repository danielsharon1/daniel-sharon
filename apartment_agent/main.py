"""Entry point: python -m apartment_agent.main [--loop MINUTES] [--dry-run]"""
from __future__ import annotations

import argparse
import logging
import os
import time
from typing import Protocol

from .classifier import Classification, ClaudeClassifier
from .config import URGENCY_LEVELS, DealConfig, Settings, load_dotenv
from .mail import CHECKED_LABEL, RELEVANT_LABEL, Email, GmailMailbox
from .notify import Notifier
from .prefilter import is_candidate

log = logging.getLogger("apartment_agent")


class Mailbox(Protocol):
    def fetch_unchecked(self, lookback_days: int) -> list[Email]: ...
    def add_label(self, uid: str, label: str) -> None: ...


class Classifier(Protocol):
    def classify(self, mail: Email) -> Classification: ...


class Alerter(Protocol):
    def send(self, mail: Email, c: Classification) -> None: ...


def process(mailbox: Mailbox, classifier: Classifier, notifier: Alerter, deal: DealConfig,
            lookback_days: int, dry_run: bool = False) -> int:
    """Check new mail once. Returns number of alerts sent."""
    alerts = 0
    min_level = URGENCY_LEVELS[deal.min_urgency]
    emails = mailbox.fetch_unchecked(lookback_days)
    log.info("Found %d new message(s) to check", len(emails))
    for mail in emails:
        try:
            if not is_candidate(mail, deal):
                log.debug("Skipped (pre-filter): %s", mail.subject)
            else:
                c = classifier.classify(mail)
                log.info("Classified %r -> relevant=%s urgency=%s", mail.subject, c.relevant, c.urgency)
                if c.relevant:
                    if not dry_run:
                        mailbox.add_label(mail.uid, RELEVANT_LABEL)
                    if URGENCY_LEVELS.get(c.urgency, 0) >= min_level:
                        notifier.send(mail, c)
                        alerts += 1
        except Exception:
            # Leave unlabeled so it is retried on the next run.
            log.exception("Failed processing %r", mail.subject)
            continue
        if not dry_run:
            mailbox.add_label(mail.uid, CHECKED_LABEL)
    return alerts


def run_once(settings: Settings, deal: DealConfig, dry_run: bool) -> int:
    classifier = ClaudeClassifier(deal, model=settings.model)
    notifier = Notifier(settings)
    with GmailMailbox(settings.imap_host, settings.gmail_address, settings.gmail_app_password) as mailbox:
        return process(mailbox, classifier, notifier, deal, settings.lookback_days, dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apartment purchase email alert agent")
    parser.add_argument("--loop", type=float, metavar="MINUTES",
                        help="keep running and check mail every MINUTES (default: run once)")
    parser.add_argument("--dry-run", action="store_true",
                        help="don't add Gmail labels (messages will be re-checked next run)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    load_dotenv()
    settings = Settings.from_env()
    deal = DealConfig.load(os.environ.get("DEAL_CONFIG", "deal.yaml"))

    while True:
        try:
            n = run_once(settings, deal, args.dry_run)
            log.info("Done: %d alert(s) sent", n)
        except Exception:
            if not args.loop:
                raise
            log.exception("Run failed; will retry")
        if not args.loop:
            break
        time.sleep(args.loop * 60)


if __name__ == "__main__":
    main()
