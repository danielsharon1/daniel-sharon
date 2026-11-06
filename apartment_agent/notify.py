"""Alert channels: Telegram, email, and console."""
from __future__ import annotations

import json
import logging
import smtplib
import urllib.request
from email.message import EmailMessage
from html import escape

from .classifier import Classification
from .config import Settings
from .mail import Email

log = logging.getLogger(__name__)

URGENCY_ICON = {"high": "🔴", "medium": "🟠", "low": "🟢"}
URGENCY_HE = {"high": "דחוף", "medium": "חשוב", "low": "לידיעה"}


def format_alert(mail: Email, c: Classification, as_html: bool = False) -> str:
    e = escape if as_html else (lambda s: s)
    bold = (lambda s: f"<b>{e(s)}</b>") if as_html else (lambda s: s)
    lines = [
        f"{URGENCY_ICON.get(c.urgency, '')} {bold('מייל על הדירה – ' + URGENCY_HE.get(c.urgency, c.urgency))}",
        f"מאת: {e(mail.from_name or mail.from_addr)} ({e(mail.from_addr)})",
        f"נושא: {e(mail.subject)}",
        "",
        e(c.summary),
    ]
    if c.action_items:
        lines += ["", bold("מה צריך לעשות:")] + [f"• {e(a)}" for a in c.action_items]
    if c.deadline:
        lines.append(f"⏰ דדליין: {e(c.deadline)}")
    if mail.attachments:
        lines.append(f"📎 {e(', '.join(mail.attachments))}")
    if mail.gmail_link:
        lines.append(f'<a href="{mail.gmail_link}">פתח ב-Gmail</a>' if as_html else mail.gmail_link)
    return "\n".join(lines)


class Notifier:
    def __init__(self, settings: Settings):
        self.s = settings

    def send(self, mail: Email, c: Classification) -> None:
        print(format_alert(mail, c), "\n" + "-" * 40, flush=True)
        if self.s.telegram_bot_token and self.s.telegram_chat_id:
            try:
                self._telegram(format_alert(mail, c, as_html=True))
            except Exception:
                log.exception("Telegram alert failed")
        if self.s.alert_email_to:
            try:
                self._email(mail, c)
            except Exception:
                log.exception("Email alert failed")

    def _telegram(self, text: str) -> None:
        url = f"https://api.telegram.org/bot{self.s.telegram_bot_token}/sendMessage"
        payload = json.dumps({
            "chat_id": self.s.telegram_chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp.read()

    def _email(self, mail: Email, c: Classification) -> None:
        msg = EmailMessage()
        msg["Subject"] = f"[דירה {URGENCY_ICON.get(c.urgency, '')}] {mail.subject}"
        msg["From"] = self.s.gmail_address
        msg["To"] = self.s.alert_email_to
        msg.set_content(format_alert(mail, c))
        with smtplib.SMTP_SSL(self.s.smtp_host, 465, timeout=30) as smtp:
            smtp.login(self.s.gmail_address, self.s.gmail_app_password)
            smtp.send_message(msg)
