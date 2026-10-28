TEMPLATES = {
    "welcome": "Welcome, {name}! Thanks for signing up.",
    "receipt": "Thanks for your order {order_id}: {total}.",
}


def render(template, values):
    return TEMPLATES[template].format(**values)
