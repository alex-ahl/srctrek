"""File-backed topics: one JSON line per message, shared with the API through QUEUE_DIR."""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

QUEUE_DIR = Path(os.environ.get("QUEUE_DIR", "/var/lib/shop/queue"))


def _offset_file(topic: str) -> Path:
    return QUEUE_DIR / f".{topic}.offset"


def read(topic: str) -> Iterator[dict]:
    """Payloads published to `topic` since the last read, oldest first."""
    path = QUEUE_DIR / f"{topic}.jsonl"
    if not path.exists():
        return
    offset_file = _offset_file(topic)
    offset = int(offset_file.read_text()) if offset_file.exists() else 0
    with path.open() as fh:
        fh.seek(offset)
        for line in fh:
            yield json.loads(line)["payload"]
        offset_file.write_text(str(fh.tell()))


def publish(topic: str, payload: dict) -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    message = {"topic": topic, "sent_at": datetime.now(UTC).isoformat(), "payload": payload}
    with (QUEUE_DIR / f"{topic}.jsonl").open("a") as fh:
        fh.write(json.dumps(message) + "\n")
