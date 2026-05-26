from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

TIMESTAMP_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)"
)


@dataclass(frozen=True)
class ParsedPiece:
    timestamp: datetime
    nome_macchinario: str
    nome_pezzo: str
    raw_line: str


def _parse_timestamp(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    if " " in normalized and "T" not in normalized:
        normalized = normalized.replace(" ", "T", 1)
    return datetime.fromisoformat(normalized)


def parse_log_line(
    line: str,
    default_macchinario: str,
    default_pezzo: str,
) -> Optional[ParsedPiece]:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None

    parts = [part.strip() for part in stripped.split("|")]
    if len(parts) == 3:
        timestamp_raw, nome_macchinario, nome_pezzo = parts
    elif len(parts) == 1:
        timestamp_raw = parts[0]
        nome_macchinario = default_macchinario
        nome_pezzo = default_pezzo
    else:
        logger.warning("Riga log non valida: %s", stripped)
        return None

    try:
        timestamp = _parse_timestamp(timestamp_raw)
    except ValueError:
        match = TIMESTAMP_RE.match(stripped)
        if not match:
            logger.warning("Timestamp non riconosciuto: %s", stripped)
            return None
        timestamp = _parse_timestamp(match.group(1))
        if len(parts) == 1 and "|" not in stripped:
            nome_macchinario = default_macchinario
            nome_pezzo = default_pezzo

    return ParsedPiece(
        timestamp=timestamp,
        nome_macchinario=nome_macchinario,
        nome_pezzo=nome_pezzo,
        raw_line=stripped,
    )


class OffsetStore:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._offsets: Dict[str, int] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            self._offsets = {}
            return
        with self._path.open(encoding="utf-8") as handle:
            self._offsets = json.load(handle)

    def get(self, source_id: str) -> int:
        return int(self._offsets.get(source_id, 0))

    def set(self, source_id: str, offset: int) -> None:
        self._offsets[source_id] = offset

    def save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as handle:
            json.dump(self._offsets, handle, indent=2, sort_keys=True)
