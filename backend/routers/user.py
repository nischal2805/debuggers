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
        demo_store.save_profile(token, profile)
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


@router.get("/solve_history")
async def get_solve_history(authorization: str = Header(...)):
    """
    Return recent solve events with rich behavioral metadata for the Profile page.
    Shows: problem title, topic, correctness, timing, hints used, behavioral notes.
    """
    uid, is_demo, token = await _resolve_token(authorization)

    # Problem title lookup — import here to avoid circular deps
    from data.coding_problems import get_problem

    if is_demo:
        events = demo_store.list_events(token, limit=100)
    else:
        # For firebase users, load from events subcollection
        try:
            from services.firestore import get_db
            db = get_db()
            snaps = (
                db.collection("users").document(uid).collection("events")
                .order_by("ts", direction="DESCENDING").limit(50).stream()
            )
            events = [s.to_dict() for s in snaps]
        except Exception:
            events = []

    # Filter to solve/judge submits only
    solve_events = [
        e for e in events
        if e.get("kind") in ("solve_submit", "judge_submit")
    ]

    rows = []
    for e in solve_events[:30]:
        problem_id = e.get("problem_id", "")
        p = get_problem(problem_id)
        title = p["title"] if p else problem_id.replace("_", " ").title()
        lc = p.get("lc", "") if p else ""

        total_ms = e.get("total_time_ms", 0) or 0
        minutes = round(total_ms / 60000, 1) if total_ms else None
        first_ks = e.get("first_keystroke_ms", 0) or 0

        # Build behavioral insight string
        notes = []
        if e.get("approach_written"):
            notes.append("Planned approach first")
        if e.get("hints_requested", 0) == 0 and e.get("correct"):
            notes.append("Solved without hints")
        elif e.get("hints_requested", 0) >= 3:
            notes.append(f"Used {e.get('hints_requested')} hints")
        if first_ks > 60000:
            notes.append("Long planning phase")
        elif first_ks < 5000 and not e.get("correct"):
            notes.append("Rushed start")
        if e.get("timed_out"):
            notes.append("TLE — needs optimization")
        if e.get("num_runs", 0) >= 5:
            notes.append("Many test runs")

        rows.append({
            "problem_id": problem_id,
            "lc": lc,
            "title": title,
            "topic": e.get("topic", ""),
            "pattern": e.get("pattern", ""),
            "correct": bool(e.get("correct", False)),
            "passed": e.get("passed"),
            "total": e.get("total"),
            "language": e.get("language", "python"),
            "mastery_delta": e.get("mastery_delta", 0),
            "total_time_min": minutes,
            "hints_requested": e.get("hints_requested", 0),
            "approach_written": bool(e.get("approach_written", False)),
            "num_runs": e.get("num_runs", 0),
            "timed_out": bool(e.get("timed_out", False)),
            "behavioral_insight": " · ".join(notes) if notes else None,
            "ts": e.get("ts", ""),
        })

    # Summary stats
    total_solved = len(rows)
    correct_count = sum(1 for r in rows if r["correct"])
    topics_touched = len({r["topic"] for r in rows if r["topic"]})

    return {
        "history": rows,
        "summary": {
            "total_solved": total_solved,
            "correct": correct_count,
            "accuracy": round(correct_count / total_solved * 100) if total_solved else 0,
            "topics_touched": topics_touched,
        },
    }


@router.get("/events")
async def get_events(
    kind: str = "interview_submit",
    limit: int = 20,
    authorization: str = Header(...),
):
    """Return raw events filtered by kind. Used by Profile for interview history."""
    uid, is_demo, token = await _resolve_token(authorization)
    if is_demo:
        all_events = demo_store.list_events(token, limit=200)
    else:
        try:
            from services.firestore import get_db
            db = get_db()
            snaps = (
                db.collection("users").document(uid).collection("events")
                .order_by("ts", direction="DESCENDING").limit(100).stream()
            )
            all_events = [s.to_dict() for s in snaps]
        except Exception:
            all_events = []
    filtered = [e for e in all_events if e.get("kind") == kind][:limit]
    return {"events": filtered}


@router.get("/tminus")
async def get_tminus(authorization: str = Header(...)):
    """
    T-Minus Protocol: diagnostic for the 48h before an interview.
    Returns top 3 highest-risk topics (high importance × low recent accuracy)
    and a focused 2-hour review plan.
    """
    model, profile, token, is_demo = await _load(authorization)
    from data.coding_problems import TOPIC_PROBLEMS, CODING_PROBLEMS

    # Importance weights by topic (rough heuristic — frequency in FAANG interviews)
    IMPORTANCE = {
        "arrays": 0.95, "strings": 0.9, "linked_lists": 0.85,
        "trees": 0.95, "graphs": 0.88, "dynamic_programming": 0.85,
        "sliding_window": 0.82, "two_pointers": 0.82, "binary_search": 0.80,
        "stack": 0.78, "heap": 0.80, "recursion": 0.75, "backtracking": 0.72,
        "hashing": 0.85, "sorting": 0.70, "greedy": 0.72, "trie": 0.65,
        "bit_manipulation": 0.60, "math": 0.55,
    }

    topics = model.get("topics", {})
    scored = []
    for topic_id, stat in topics.items():
        mastery = stat.get("mastery", stat.get("knowledge", 0))
        attempts = stat.get("attempts", 0)
        importance = IMPORTANCE.get(topic_id, 0.5)
        # Risk = importance × (1 - mastery), amplified if low attempts
        coverage = min(1.0, attempts / 3)
        risk = importance * (1 - mastery) * (0.5 + 0.5 * (1 - coverage))
        if attempts > 0 or mastery > 0:
            scored.append({
                "topic": topic_id,
                "mastery": round(mastery, 3),
                "importance": importance,
                "risk_score": round(risk, 3),
                "attempts": attempts,
            })

    scored.sort(key=lambda x: x["risk_score"], reverse=True)
    top3 = scored[:3]

    # Build review plan: 2-3 problems per topic
    review_plan = []
    for item in top3:
        topic_id = item["topic"]
        pids = TOPIC_PROBLEMS.get(topic_id, [])
        # Pick easy-medium problems for quick reinforcement
        problems = []
        for pid in pids[:6]:
            p = CODING_PROBLEMS.get(pid)
            if p and p.get("difficulty") in ("easy", "medium"):
                problems.append({"id": pid, "title": p["title"], "difficulty": p.get("difficulty", "medium")})
            if len(problems) >= 3:
                break
        review_plan.append({
            "topic": topic_id,
            "mastery": item["mastery"],
            "risk_score": item["risk_score"],
            "importance": item["importance"],
            "why": f"{'Completely unstudied' if item['attempts'] == 0 else 'Low accuracy'} — appears in ~{round(item['importance'] * 100)}% of FAANG interviews",
            "time_allocation_min": 40,
            "problems": problems,
        })

    stop_topics = [t["topic"] for t in scored[3:8] if t["risk_score"] < 0.3]

    interview_date = profile.get("interviewDate")
    return {
        "top_risk": review_plan,
        "stop_studying": stop_topics[:3],
        "total_time_min": 120,
        "interview_date": interview_date,
    }

