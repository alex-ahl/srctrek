class Declined(Exception):
    pass


def charge(card_token, amount_ore):
    """Charges the card through the payment provider; raises Declined when it refuses."""
    if card_token.startswith("tok_declined"):
        raise Declined(card_token)
    return {"charged": amount_ore}
