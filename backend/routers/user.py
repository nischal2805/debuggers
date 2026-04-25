from fastapi import APIRouter, HTTPException, Header
import firebase_admin.auth as fb_auth

from services.firestore import get_knowledge_model, get_user_profile
from services import demo_store
from services.curriculum import compute_priority_queue, explain_top_choice
from models.knowledge import (
    compute_roadmap,
    readiness_score,
    confidence_calibration_gap,
    assessment_level,
    migrate_knowledge_model,
)


router = APIRouter(prefix="/user", tags=["user"])


async def _resolve_token(authorization: str) -> tuple[str, bool, str]:
    """Returns (uid, is_demo, token). Raises 401 if invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]

    if demo_store.is_demo_token(token):
        return demo_store.get_demo_uid(token), True, token

    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"], False, token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


async def _load(authorization: str) -> tuple[dict, dict, str, bool]:
    uid, is_demo, token = await _resolve_token(authorization)
    if is_demo:
        model = demo_store.get_model(token)
        profile = demo_store.get_profile(token)
    else:
        model = await get_knowledge_model(uid)
        profile = await get_user_profile(uid)
    return migrate_knowledge_model(model), profile, token, is_demo


@router.get("/model")
async def get_model(authorization: str = Header(...)):
    model, _profile, _token, _is_demo = await _load(authorization)
    return model


@router.get("/roadmap")
async def get_roadmap(authorization: str = Header(...)):
    model, profile, _token, _is_demo = await _load(authorization)
    goal = profile.get("goal", "learning")
    ordered = compute_roadmap(model, goal)
    return {"roadmap": ordered}


@router.get("/readiness")
async def get_readiness(authorization: str = Header(...)):
    model, profile, _token, _is_demo = await _load(authorization)
    goal = profile.get("goal", "learning")
    snap = readiness_score(model, goal)
    return {
        "snapshot": snap,
        "calibration_gap": confidence_calibration_gap(model),
        "history": model.get("readinessHistory", [])[-30:],
    }


@router.get("/trajectory")
async def get_trajectory(authorization: str = Header(...)):
    model, profile, _token, _is_demo = await _load(authorization)
    topics = model.get("topics", {})
    rows = []
    for topic, stat in topics.items():
        k = stat.get("knowledge", stat.get("mastery", 0))
        lvl, label = assessment_level(k)
        rows.append({
            "topic": topic,
            "knowledge": k,
            "speed": stat.get("speed", 0),
            "confidence": stat.get("confidence", 0),
            "consistency": stat.get("consistency", 0),
            "patternRecognition": stat.get("patternRecognition", 0),
            "attempts": stat.get("attempts", 0),
            "level": lvl,
            "levelLabel": label,
            "lastSeen": stat.get("lastSeen"),
        })
    rows.sort(key=lambda r: r["knowledge"], reverse=True)
    return {
        "topics": rows,
        "readinessHistory": model.get("readinessHistory", []),
        "sessionCount": model.get("sessionCount", 0),
        "totalMinutes": model.get("totalMinutes", 0),
    }


@router.get("/misconceptions")
async def get_misconceptions(authorization: str = Header(...)):
    model, _profile, _token, _is_demo = await _load(authorization)
    aggregate: dict[str, int] = {}
    per_topic: dict[str, dict[str, int]] = {}
    for topic, stat in model.get("topics", {}).items():
        histo = stat.get("misconceptionHistogram", {}) or {}
        if not histo:
            continue
        per_topic[topic] = histo
        for k, v in histo.items():
            aggregate[k] = aggregate.get(k, 0) + v
    return {"aggregate": aggregate, "per_topic": per_topic}


@router.get("/pattern_mastery")
async def get_pattern_mastery(authorization: str = Header(...)):
    model, _profile, _token, _is_demo = await _load(authorization)
    pats = model.get("patternStats", {})
    rows = []
    for name, stat in pats.items():
        k = stat.get("knowledge", 0)
        lvl, label = assessment_level(k)
        rows.append({
            "pattern": name,
            "knowledge": k,
            "speed": stat.get("speed", 0),
            "confidence": stat.get("confidence", 0),
            "consistency": stat.get("consistency", 0),
            "attempts": stat.get("attempts", 0),
            "correct": stat.get("correct", 0),
            "level": lvl,
            "levelLabel": label,
        })
    rows.sort(key=lambda r: r["knowledge"], reverse=True)
    return {"patterns": rows}


@router.get("/priority_queue")
async def get_priority_queue(authorization: str = Header(...)):
    model, profile, _token, _is_demo = await _load(authorization)
    goal = profile.get("goal", "learning")
    queue = compute_priority_queue(model, goal=goal)
    return {"queue": queue, "explanation": explain_top_choice(queue)}


@router.get("/sessions")
async def get_sessions(authorization: str = Header(...)):
    """List recent session report cards. Demo mode returns empty list (no Firestore)."""
    uid, is_demo, _token = await _resolve_token(authorization)
    if is_demo:
        return {"sessions": []}
    from services.firestore import get_db
    db = get_db()
    snaps = (
        db.collection("users").document(uid).collection("sessions")
        .order_by("startedAt", direction="DESCENDING").limit(20).stream()
    )
    rows = []
    for s in snaps:
        d = s.to_dict() or {}
        d["id"] = s.id
        rows.append(d)
    return {"sessions": rows}
