from app.db import table


def top_members(count=10):
    accounts = table("accounts").rows.items()
    ranked = sorted(accounts, key=lambda item: item[1]["points"], reverse=True)
    return [user_id for user_id, _ in ranked[:count]]
