from app.models.order import Order
from app.payments import pay
from app.utils.ids import new_id
from app.web.router import route


@route("POST", "/checkout")
def checkout(request):
    order = Order(id=new_id("o"), user_id=request.user_id, total_ore=request.json["total_ore"])
    order.save()

    pay(order, request.json["card_token"])
    order.save()

    return {"order_id": order.id, "status": order.status}
