from fastapi import APIRouter, HTTPException, Header
import firebase_admin.auth as fb_auth
from services.firestore import get_knowledge_model, get_user_profile
from models.knowledge import compute_roadmap

router = APIRouter(prefix="/user", tags=["user"])


async def _get_uid(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/model")
async def get_model(authorization: str = Header(...)):
    uid = await _get_uid(authorization)
    model = await get_knowledge_model(uid)
    return model


@router.get("/roadmap")
async def get_roadmap(authorization: str = Header(...)):
    uid = await _get_uid(authorization)
    model = await get_knowledge_model(uid)
    profile = await get_user_profile(uid)
    goal = profile.get("goal", "learning")
    ordered = compute_roadmap(model, goal)
    return {"roadmap": ordered}
