from app.models.product import Product
from app.utils.ids import new_id
from app.utils.money import parse_price
from app.web.router import route


@route("POST", "/products")
def create_product(request):
    product = Product(
        id=new_id("p"),
        name=request.json["name"],
        description=request.json.get("description", ""),
        price_ore=parse_price(request.json["price"]),
    )
    product.save()
    return {"product_id": product.id}
