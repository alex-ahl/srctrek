from app import settings
from app.plugins import load_all
from app.web.router import serve


def main():
    load_all(settings.ENABLED_PLUGINS)
    serve(port=8000)


if __name__ == "__main__":
    main()
