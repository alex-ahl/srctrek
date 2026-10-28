from app.db import table
from app.models.order import Order
from app.web.router import route


@route("POST", "/admin/orders/note")
def add_note(request):
    order = Order(**table("order").get(request.json["order_id"]))
    order.note = request.json["note"]
    order.save()
    return {"ok": True}
