class Table:
    def __init__(self):
        self.rows = {}

    def upsert(self, row_id, values):
        self.rows[row_id] = dict(values)

    def get(self, row_id):
        return self.rows.get(row_id)


_tables = {}


def table(name):
    return _tables.setdefault(name, Table())
