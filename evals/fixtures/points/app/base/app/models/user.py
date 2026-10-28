from dataclasses import dataclass

from app.models.base import Model


@dataclass
class User(Model):
    kind = "user"

    id: str = ""
    name: str = ""
    email: str = ""
    subscribed: bool = False
    welcomed: bool = False
