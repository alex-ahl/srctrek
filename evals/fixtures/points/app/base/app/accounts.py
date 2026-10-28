from app.db import table


def add_points(user_id, points):
    accounts = table("accounts")
    account = accounts.get(user_id) or {"points": 0}
    accounts.upsert(user_id, {"points": account["points"] + points})


def points_of(user_id):
    account = table("accounts").get(user_id)
    return account["points"] if account else 0
