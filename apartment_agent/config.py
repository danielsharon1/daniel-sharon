from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

URGENCY_LEVELS = {"low": 0, "medium": 1, "high": 2}


@dataclass
class Contact:
    name: str
    email: str  # full address or bare domain


@dataclass
class DealConfig:
    description: str = ""
    address: str = ""
    block_parcel: str = ""
    contacts: list[Contact] = field(default_factory=list)
    extra_keywords: list[str] = field(default_factory=list)
    classify_all: bool = False
    min_urgency: str = "low"

    @classmethod
    def load(cls, path: str | Path) -> "DealConfig":
        p = Path(path)
        if not p.exists():
            return cls()
        raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        prop = raw.get("property") or {}
        contacts = [
            Contact(name=str(c.get("name", "")), email=str(c.get("email", "")).lower())
            for c in (raw.get("contacts") or [])
            if c and c.get("email")
        ]
        min_urgency = str(raw.get("min_urgency", "low")).lower()
        if min_urgency not in URGENCY_LEVELS:
            raise ValueError(f"min_urgency must be one of {list(URGENCY_LEVELS)}")
        return cls(
            description=str(raw.get("description", "")).strip(),
            address=str(prop.get("address", "") or ""),
            block_parcel=str(prop.get("block_parcel", "") or ""),
            contacts=contacts,
            extra_keywords=[str(k) for k in (raw.get("extra_keywords") or [])],
            classify_all=bool(raw.get("classify_all", False)),
            min_urgency=min_urgency,
        )

    def as_prompt_context(self) -> str:
        lines = [self.description or "The user is buying an apartment."]
        if self.address:
            lines.append(f"Property address: {self.address}")
        if self.block_parcel:
            lines.append(f"Block/parcel (gush/helka): {self.block_parcel}")
        if self.contacts:
            lines.append("Known parties in the deal:")
            lines += [f"- {c.name} <{c.email}>" for c in self.contacts]
        return "\n".join(lines)


@dataclass
class Settings:
    gmail_address: str
    gmail_app_password: str
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    alert_email_to: str = ""
    lookback_days: int = 2
    imap_host: str = "imap.gmail.com"
    smtp_host: str = "smtp.gmail.com"
    model: str = "claude-opus-5-5"

    @classmethod
    def from_env(cls) -> "Settings":
        missing = [k for k in ("GMAIL_ADDRESS", "GMAIL_APP_PASSWORD") if not os.environ.get(k)]
        if missing:
            raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")
        return cls(
            gmail_address=os.environ["GMAIL_ADDRESS"],
            gmail_app_password=os.environ["GMAIL_APP_PASSWORD"].replace(" ", ""),
            telegram_bot_token=os.environ.get("TELEGRAM_BOT_TOKEN", ""),
            telegram_chat_id=os.environ.get("TELEGRAM_CHAT_ID", ""),
            alert_email_to=os.environ.get("ALERT_EMAIL_TO", ""),
            lookback_days=int(os.environ.get("LOOKBACK_DAYS", "2")),
            imap_host=os.environ.get("IMAP_HOST", "imap.gmail.com"),
            smtp_host=os.environ.get("SMTP_HOST", "smtp.gmail.com"),
            model=os.environ.get("CLAUDE_MODEL", "claude-opus-5-5"),
        )


def load_dotenv(path: str | Path = ".env") -> None:
    """Minimal .env loader (no extra dependency). Existing env vars win."""
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
