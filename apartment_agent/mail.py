"""Gmail access over IMAP (works with a Google App Password).

State is kept in Gmail itself using labels, so the agent can run statelessly
(e.g. from a scheduled GitHub Action):
  * every message the agent has looked at gets CHECKED_LABEL
  * messages found relevant also get RELEVANT_LABEL (handy filter in Gmail)
"""
from __future__ import annotations

import email
import html
import imaplib
import re
from dataclasses import dataclass, field
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.policy import default as default_policy
from email.utils import parseaddr

CHECKED_LABEL = "apt-agent-checked"
RELEVANT_LABEL = "apt-agent-relevant"
MAX_BODY_CHARS = 15000


@dataclass
class Email:
    uid: str
    message_id: str
    subject: str
    from_name: str
    from_addr: str
    date: str
    body: str
    attachments: list[str] = field(default_factory=list)
    gmail_thread_id: str = ""

    @property
    def gmail_link(self) -> str:
        if self.gmail_thread_id:
            return f"https://mail.google.com/mail/u/0/#all/{int(self.gmail_thread_id):x}"
        return ""


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def html_to_text(raw_html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", raw_html)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def _parse_from(msg: EmailMessage) -> tuple[str, str]:
    # Hebrew display names often contain unbalanced quotes (עו"ד), which confuse
    # standard parsers, so prefer an explicit <addr> when there is one.
    raw = _decode(str(msg.get("From") or ""))
    m = re.search(r"<([^<>@\s\"]+@[^<>\s\"]+)>", raw)
    if m:
        return raw[: m.start()].strip().strip('"').strip(), m.group(1)
    return parseaddr(raw)


def parse_email(uid: str, raw: bytes, gmail_thread_id: str = "") -> Email:
    msg: EmailMessage = email.message_from_bytes(raw, policy=default_policy)  # type: ignore[assignment]
    from_name, from_addr = _parse_from(msg)

    plain, rich, attachments = [], [], []
    for part in msg.walk():
        if part.is_multipart():
            continue
        filename = part.get_filename()
        if filename or part.get_content_disposition() == "attachment":
            attachments.append(_decode(filename) or "(unnamed attachment)")
            continue
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            content = part.get_content()
        except Exception:
            payload = part.get_payload(decode=True) or b""
            content = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        (plain if ctype == "text/plain" else rich).append(content)

    body = "\n".join(plain).strip() or html_to_text("\n".join(rich))
    if len(body) > MAX_BODY_CHARS:
        body = body[:MAX_BODY_CHARS] + "\n\n[... body truncated by agent ...]"

    return Email(
        uid=uid,
        message_id=msg.get("Message-ID", "") or "",
        subject=_decode(msg.get("Subject")) or "(no subject)",
        from_name=from_name,
        from_addr=from_addr.lower(),
        date=msg.get("Date", "") or "",
        body=body,
        attachments=attachments,
        gmail_thread_id=gmail_thread_id,
    )


class GmailMailbox:
    def __init__(self, host: str, address: str, app_password: str, folder: str = "INBOX"):
        self.host, self.address, self.password, self.folder = host, address, app_password, folder
        self.conn: imaplib.IMAP4_SSL | None = None

    def __enter__(self) -> "GmailMailbox":
        self.conn = imaplib.IMAP4_SSL(self.host)
        self.conn.login(self.address, self.password)
        status, _ = self.conn.select(self.folder)
        if status != "OK":
            raise RuntimeError(f"Could not open folder {self.folder}")
        return self

    def __exit__(self, *exc) -> None:
        if self.conn:
            try:
                self.conn.logout()
            except Exception:
                pass

    def fetch_unchecked(self, lookback_days: int) -> list[Email]:
        assert self.conn
        query = f'"newer_than:{lookback_days}d -label:{CHECKED_LABEL}"'
        status, data = self.conn.uid("SEARCH", "X-GM-RAW", query)
        if status != "OK":
            raise RuntimeError(f"IMAP search failed: {data}")
        uids = data[0].split() if data and data[0] else []
        emails = []
        for uid_b in uids:
            uid = uid_b.decode()
            # BODY.PEEK so the agent never marks your mail as read
            status, msg_data = self.conn.uid("FETCH", uid, "(X-GM-THRID BODY.PEEK[])")
            if status != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                continue
            header, raw = msg_data[0]
            m = re.search(rb"X-GM-THRID (\d+)", header)
            emails.append(parse_email(uid, raw, m.group(1).decode() if m else ""))
        return emails

    def add_label(self, uid: str, label: str) -> None:
        assert self.conn
        self.conn.uid("STORE", uid, "+X-GM-LABELS", f"({label})")
