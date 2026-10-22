import logging

log = logging.getLogger(__name__)


def handle_order_shipped(payload: dict) -> None:
    log.info("order %s shipped with %s", payload["order_id"], payload["carrier"])
