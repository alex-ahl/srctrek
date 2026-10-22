"""Client for the payment provider."""

from __future__ import annotations

import json
import os
import urllib.request

PAYMENTS_URL = os.environ.get("PAYMENTS_URL", "https://payments.example.test")


def refund(order_id: str, amount_minor: int) -> str:
    """Refunds `amount_minor` (öre, cents) of the order's payment; returns the provider's refund id."""
    body = json.dumps({"order_id": order_id, "amount_minor": amount_minor}).encode()
    req = urllib.request.Request(
        f"{PAYMENTS_URL}/v2/refunds", data=body, headers={"content-type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.load(res)["refund_id"]
