from app.events import on

INDEX = {}


@on("product.saved")
def index_product(product):
    INDEX[product.id] = f"{product.name} {product.description}".lower()


@on("order.saved")
def index_order(order):
    INDEX[order.id] = f"order {order.id} {order.status}"
