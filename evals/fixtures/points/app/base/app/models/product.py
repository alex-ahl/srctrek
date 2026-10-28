from dataclasses import dataclass

from app.models.base import Model


@dataclass
class Product(Model):
    kind = "product"

    id: str = ""
    name: str = ""
    description: str = ""
    price_ore: int = 0
