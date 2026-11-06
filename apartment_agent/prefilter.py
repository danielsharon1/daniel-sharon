"""Cheap local pre-filter, so only plausible candidates are sent to Claude."""
from __future__ import annotations

from .config import DealConfig
from .mail import Email

BUILTIN_KEYWORDS = [
    # Hebrew
    "דירה", "דירת", "נכס", "משכנתא", "משכנתה", "אישור עקרוני", "עורך דין", "עו\"ד", "עוה\"ד",
    "חוזה", "הסכם מכר", "זכרון דברים", "זיכרון דברים", "טאבו", "נסח", "רשם המקרקעין",
    "רישום", "הערת אזהרה", "מס רכישה", "מיסוי מקרקעין", "מס שבח", "שמאי", "שמאות",
    "מתווך", "תיווך", "דמי תיווך", "קבלן", "יזם", "ערבות חוק מכר", "ערבות בנקאית",
    "מפתח", "מסירה", "פרוטוקול מסירה", "ביטוח מבנה", "ביטוח חיים", "גוש", "חלקה",
    "היתר בנייה", "טופס 4", "ארנונה", "ועד בית", "מקדמה", "תשלום", "העברה בנקאית",
    "רמ\"י", "רשות מקרקעי ישראל", "מינהל מקרקעי", "חברה משכנת", "ייפוי כוח", "יפוי כח",
    # English
    "apartment", "mortgage", "real estate", "property", "lawyer", "attorney",
    "purchase agreement", "appraisal", "deed", "land registry", "escrow",
]


def keyword_hits(mail: Email, deal: DealConfig) -> list[str]:
    haystack = f"{mail.subject}\n{mail.from_name}\n{mail.body}\n{' '.join(mail.attachments)}".lower()
    keywords = BUILTIN_KEYWORDS + deal.extra_keywords
    for v in (deal.address, deal.block_parcel):
        if v:
            keywords.append(v)
    return [k for k in keywords if k.lower() in haystack]


def from_known_contact(mail: Email, deal: DealConfig) -> bool:
    addr = mail.from_addr.lower()
    for c in deal.contacts:
        target = c.email.lower()
        if "@" in target:
            if addr == target:
                return True
        elif addr.endswith("@" + target) or addr.endswith("." + target):
            return True
    return False


def is_candidate(mail: Email, deal: DealConfig) -> bool:
    return deal.classify_all or from_known_contact(mail, deal) or bool(keyword_hits(mail, deal))
