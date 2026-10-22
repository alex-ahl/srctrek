"""Topic -> handler. main.py polls every topic listed here."""

from worker.handlers.shipping import handle_order_shipped

HANDLERS = {
    "order.shipped": handle_order_shipped,
}
