from app.db import table
from app.events import emit


class Model:
    kind = "model"

    def save(self):
        table(self.kind).upsert(self.id, vars(self))
        emit(f"{self.kind}.saved", self)
