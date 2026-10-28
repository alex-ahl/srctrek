from dataclasses import dataclass

from app.models.base import Model


@dataclass
class Order(Model):
    kind = "order"

    id: str = ""
    user_id: str = ""
    total_ore: int = 0
    status: str = "pending"
    note: str = ""
