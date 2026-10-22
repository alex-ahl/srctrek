"""Polls every topic in HANDLERS and hands each new message to its handler."""

from __future__ import annotations

import logging
import time

from worker import queue
from worker.handlers import HANDLERS

POLL_SECONDS = 1.0

log = logging.getLogger("worker")


def poll_once() -> None:
    for topic, handler in HANDLERS.items():
        for payload in queue.read(topic):
            try:
                handler(payload)
            except Exception:
                log.exception("handler for %s failed on %r", topic, payload)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    while True:
        poll_once()
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
