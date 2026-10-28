from decimal import Decimal


def parse_price(text):
    """'499.50' -> 49950 öre."""
    return int(Decimal(text) * 100)


def format_ore(amount_ore):
    return f"{amount_ore // 100}.{amount_ore % 100:02d} SEK"
