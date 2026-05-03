"""
URL classification for ffffound WARC records.

Patterns refined after Phase 0 spike against
ffffound.com-2017-05-07-dd21b908-00005.warc.gz:

  - image IDs are SHA1 (40 hex chars), not numeric
  - URL may carry a `?c=<collection_id>` suffix from related links
  - user pages are paginated:
        /home/<u>                       (root)
        /home/<u>/found/                (their saves)
        /home/<u>/post/                 (their posts)
        /home/<u>/found/offset/<n>/     (paginated saves)
        /home/<u>/post/?offset=<n>      (paginated posts)
  - tag pages: not actually present on the live site (no /tagged/* hits in 100K records)
  - image bytes live on:
        img.ffffound.com         (medium / full)
        img-thumb.ffffound.com   (small / extra-small)
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class ParserContext:
    db: sqlite3.Connection
    images_dir: Path


_SHA1 = r"[0-9a-f]{40}"

_RE_IMAGE_PAGE = re.compile(rf"^https?://(?:www\.)?ffffound\.com/image/({_SHA1})", re.I)
_RE_USER_PAGE  = re.compile(r"^https?://(?:www\.)?ffffound\.com/home/([^/?#]+)", re.I)
_RE_TAG_PAGE   = re.compile(r"^https?://(?:www\.)?ffffound\.com/tagged/([^/?#]+)", re.I)
_RE_OUTBOUND   = re.compile(r"^https?://(?:www\.)?ffffound\.com/outbound/", re.I)

_RE_IMAGE_CDN  = re.compile(
    r"^https?://(?:img|img-thumb)\.ffffound\.com/static-data/.+\.(?:jpe?g|png|gif|webp)(?:\?.*)?$",
    re.I,
)


def classify_url(url: str, content_type: str = "") -> Optional[str]:
    """Return one of {'image_page','user_page','tag_page','image_bytes'} or None."""
    if _RE_OUTBOUND.match(url):
        return None  # ffffound's link redirector — useless
    if _RE_IMAGE_CDN.match(url):
        return "image_bytes"
    if "image/" in (content_type or "").lower():
        return "image_bytes"
    if _RE_IMAGE_PAGE.match(url):
        return "image_page"
    if _RE_USER_PAGE.match(url):
        return "user_page"
    if _RE_TAG_PAGE.match(url):
        return "tag_page"
    return None


def image_id_from_url(url: str) -> Optional[str]:
    m = _RE_IMAGE_PAGE.match(url)
    return m.group(1).lower() if m else None


def username_from_url(url: str) -> Optional[str]:
    m = _RE_USER_PAGE.match(url)
    return m.group(1) if m else None


def tag_from_url(url: str) -> Optional[str]:
    m = _RE_TAG_PAGE.match(url)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Stub detector. The May 2017 capture caught ffffound flapping between live
# and a "FFFFOUND! is under maintanance" stub (951 bytes) and 404s (219 bytes).
# Skipping these saves a lot of nonsense BeautifulSoup work.
# ---------------------------------------------------------------------------
_STUB_SIGNATURES = (
    b"is under maintanance",        # site's own typo
    b"404 Not FFFFOUND!",
    b"404 Not FFFFound!",
)


def is_stub(body: bytes) -> bool:
    if len(body) < 2000:
        return any(sig in body for sig in _STUB_SIGNATURES)
    return False
