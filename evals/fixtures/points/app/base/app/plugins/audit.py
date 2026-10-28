from app.events import on
from app.utils.dates import now_iso

LOG = []


@on("order.paid")
def log_payment(order):
    LOG.append((now_iso(), "paid", order.id, order.total_ore))


@on("user.saved")
def log_user_change(user):
    LOG.append((now_iso(), "user", user.id))
