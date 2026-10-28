import importlib


def load_all(names):
    """Imports each plugin module; importing one registers its event handlers."""
    for name in names:
        importlib.import_module(f"app.plugins.{name}")
