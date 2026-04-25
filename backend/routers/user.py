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
    uid, is_demo, token = await _resolve_token(authorization)
    if is_demo:
        # Derive session dates from solve/judge submit events in demo store
        events = demo_store.list_events(token, limit=200)
        seen_dates: set[str] = set()
        rows = []
        for e in reversed(events):
            if e.get("kind") in ("solve_submit", "judge_submit"):
                ts = e.get("ts", "")
                date = ts[:10]  # YYYY-MM-DD
                if date and date not in seen_dates:
                    seen_dates.add(date)
                    rows.append({
                        "startedAt": ts,
                        "topic": e.get("topic", ""),
                        "correct": e.get("correct", False),
                    })
        return {"sessions": rows[:30]}
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


from datetime import datetime, timezone
from pydantic import BaseModel


class InterviewDateRequest(BaseModel):
    interview_date: str  # ISO date string YYYY-MM-DD


@router.post("/interview-date")
async def set_interview_date(req: InterviewDateRequest, authorization: str = Header(...)):
    """Save the user's interview date for countdown and pace planning."""
    uid, is_demo, token = await _resolve_token(authorization)
    try:
        target = datetime.fromisoformat(req.interview_date)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if is_demo:
        profile = demo_store.get_profile(token)
        profile["interviewDate"] = req.interview_date
    else:
        from services.firestore import get_db
        get_db().collection("users").document(uid).set(
            {"interviewDate": req.interview_date}, merge=True
        )

    return {"saved": True, "interview_date": req.interview_date}


@router.get("/countdown")
async def get_countdown(authorization: str = Header(...)):
    """
    Returns days remaining, pace prediction, and daily time needed.
    Requires interviewDate to be set via POST /user/interview-date.
    """
    model, profile, token, is_demo = await _load(authorization)
    interview_date_str = profile.get("interviewDate")
    if not interview_date_str:
        return {"has_date": False}

    try:
        target = datetime.fromisoformat(interview_date_str).replace(tzinfo=timezone.utc)
    except ValueError:
        return {"has_date": False}

    now = datetime.now(timezone.utc)
    days_remaining = max(0, (target - now).days)

    topics = model.get("topics", {})
    total_topics = len(topics)
    mastered = sum(1 for v in topics.values() if v.get("mastery", v.get("knowledge", 0)) >= 0.5)
    uncovered = total_topics - mastered

    # Mastery velocity: topics mastered in last 7 days (from events or estimate from session count)
    events = demo_store.list_events(token, limit=200) if is_demo else []
    cutoff = now.timestamp() - 7 * 86400
    recent_topics_mastered: set[str] = set()
    for e in events:
        ts_str = e.get("ts", "")
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            continue
        if ts >= cutoff and e.get("correct") and e.get("topic"):
            recent_topics_mastered.add(e["topic"])

    velocity_per_day = len(recent_topics_mastered) / 7  # topics per day

    if velocity_per_day > 0 and days_remaining > 0:
        projected_covered = mastered + velocity_per_day * days_remaining
        projected_covered = min(projected_covered, total_topics)
    else:
        projected_covered = mastered

    daily_goal_min = int(profile.get("dailyGoalMinutes", 30))
    avg_min_per_topic = 45  # heuristic: 45 min to meaningfully advance a topic

    if days_remaining > 0 and uncovered > 0:
        if velocity_per_day > 0:
            days_to_cover_all = uncovered / velocity_per_day
            min_needed_per_day = round(daily_goal_min * (days_to_cover_all / days_remaining))
        else:
            min_needed_per_day = round(uncovered * avg_min_per_topic / max(days_remaining, 1))
    else:
        min_needed_per_day = daily_goal_min

    on_track = projected_covered >= total_topics * 0.85

    return {
        "has_date": True,
        "interview_date": interview_date_str,
        "days_remaining": days_remaining,
        "total_topics": total_topics,
        "mastered": mastered,
        "uncovered": uncovered,
        "projected_covered": round(projected_covered),
        "velocity_per_day": round(velocity_per_day, 2),
        "daily_goal_min": daily_goal_min,
        "min_needed_per_day": min_needed_per_day,
        "on_track": on_track,
    }
