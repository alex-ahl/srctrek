from app.events import emit
from app.gateway import charge


def pay(order, card_token):
    charge(card_token, order.total_ore)
    order.status = "paid"
    emit("order.paid", order)
