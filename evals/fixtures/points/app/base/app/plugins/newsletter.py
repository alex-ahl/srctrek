from app.emails.sender import send
from app.events import on


@on("user.saved")
def welcome(user):
    if user.subscribed and not user.welcomed:
        send(user.email, "welcome", {"name": user.name})
        user.welcomed = True
