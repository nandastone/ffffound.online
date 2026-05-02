"""
URL classification — the one place that knows ffffound's URL shape.

The patterns below are a starting hypothesis from the brief. Phase 0 (the spike)
will validate them against real WARC records and adjust as needed.
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


# Hostname patterns. ffffound's content site vs static/CDN hosts.
_RE_IMAGE_PAGE = re.compile(r"^https?://(?:www\.)?ffffound\.com/image/([0-9]+)(?:[/?#]|$)")
_RE_USER_PAGE  = re.compile(r"^https?://(?:www\.)?ffffound\.com/home/([^/?#]+)(?:[/?#]|$)")
_RE_TAG_PAGE   = re.compile(r"^https?://(?:www\.)?ffffound\.com/tagged/([^/?#]+)(?:[/?#]|$)")

# Two CDN hosts seen in the wild — adjust after spike.
_RE_IMAGE_CDN  = re.compile(r"^https?://(?:static|img|t)\.ffffound\.com/.+\.(?:jpe?g|png|gif)(?:\?.*)?$", re.I)


def classify_url(url: str, content_type: str = "") -> Optional[str]:
    """Return one of {'image_page','user_page','tag_page','image_bytes'} or None."""
    if _RE_IMAGE_CDN.match(url):
        return "image_bytes"
    if "image" in content_type and not url.endswith((".html", "/")):
        # Defensive: any image/* response not on the known CDN host is also bytes.
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
    return m.group(1) if m else None


def username_from_url(url: str) -> Optional[str]:
    m = _RE_USER_PAGE.match(url)
    return m.group(1) if m else None


def tag_from_url(url: str) -> Optional[str]:
    m = _RE_TAG_PAGE.match(url)
    return m.group(1) if m else None
