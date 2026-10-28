from collections import defaultdict

_handlers = defaultdict(list)


def on(event):
    """Registers the decorated function to run whenever `event` is emitted."""

    def register(handler):
        _handlers[event].append(handler)
        return handler

    return register


def emit(event, payload):
    for handler in _handlers[event]:
        handler(payload)
