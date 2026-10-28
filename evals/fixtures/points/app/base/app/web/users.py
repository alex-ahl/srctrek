from app.models.user import User
from app.utils.ids import new_id
from app.web.router import route


@route("POST", "/users")
def sign_up(request):
    user = User(
        id=new_id("u"),
        name=request.json["name"],
        email=request.json["email"],
        subscribed=request.json.get("subscribe", False),
    )
    user.save()
    return {"user_id": user.id}
