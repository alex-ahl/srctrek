from app.accounts import add_points
from app.events import on
from app.settings import LOYALTY_POINTS_PER_KRONA


@on("order.paid")
def award_points(order):
    points = order.total_ore // 100 * LOYALTY_POINTS_PER_KRONA
    add_points(order.user_id, points)
