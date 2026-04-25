from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import firebase_admin.auth as fb_auth

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyRequest(BaseModel):
    id_token: str


@router.post("/verify")
async def verify_token(req: VerifyRequest):
    try:
        decoded = fb_auth.verify_id_token(req.id_token)
        return {"uid": decoded["uid"], "email": decoded.get("email")}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
