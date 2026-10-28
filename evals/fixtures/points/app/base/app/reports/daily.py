from app.db import table
from app.utils.money import format_ore


def revenue():
    orders = table("order").rows.values()
    paid = [order["total_ore"] for order in orders if order["status"] == "paid"]
    return format_ore(sum(paid))
