import os
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

_firebase_enabled = False


async def _init_piston():
    """Install Piston runtimes if PISTON_URL is set. Runs once at startup."""
    piston_url = os.environ.get("PISTON_URL", "").rstrip("/")
    if not piston_url:
        return

    import httpx
    runtimes = [
        {"language": "python", "version": "3.10.0"},
        {"language": "javascript", "version": "18.15.0"},
        {"language": "java", "version": "18.0.2.1"},
        {"language": "cpp", "version": "11.2.0"},
        {"language": "go", "version": "1.21.0"},
    ]

    # Wait for Piston to be ready (up to 60s)
    print("Piston URL detected — waiting for Piston to be ready...")
    for attempt in range(20):
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{piston_url}/api/v2/runtimes")
                if r.status_code == 200:
                    installed = {rt["language"] for rt in r.json()}
                    print(f"Piston ready. Installed runtimes: {installed}")
                    # Install missing runtimes
                    for rt in runtimes:
                        if rt["language"] not in installed:
                            print(f"Installing Piston runtime: {rt['language']} {rt['version']}...")
                            try:
                                ir = await c.post(
                                    f"{piston_url}/api/v2/packages",
                                    json=rt,
                                    timeout=120,
                                )
                                print(f"  -> {rt['language']}: {ir.status_code}")
                            except Exception as e:
                                print(f"  -> {rt['language']} install failed: {e}")
                    return
        except Exception:
            pass
        await asyncio.sleep(3)
        print(f"Waiting for Piston... ({attempt + 1}/20)")

    print("Piston not ready after 60s — will fall back to Judge0 cloud.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _firebase_enabled
    import firebase_admin
    from firebase_admin import credentials

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccount.json")

    if not firebase_admin._apps:
        try:
            if sa_json:
                cred = credentials.Certificate(json.loads(sa_json))
            elif os.path.exists(sa_path):
                cred = credentials.Certificate(sa_path)
            else:
                raise FileNotFoundError("No Firebase credentials found")
            firebase_admin.initialize_app(cred)
            _firebase_enabled = True
            print("Firebase Admin initialized.")
        except Exception as e:
            print(f"Firebase Admin NOT initialized ({e}). Only demo mode available.")
    else:
        _firebase_enabled = True

    # Initialize Piston runtimes in background (don't block startup)
    asyncio.create_task(_init_piston())

    yield


app = FastAPI(title="NeuralDSA API", lifespan=lifespan)

allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth, session, user, judge, solve, advisor

app.include_router(auth.router)
app.include_router(session.router)
app.include_router(user.router)
app.include_router(judge.router)
app.include_router(solve.router)
app.include_router(advisor.router)


@app.get("/health")
async def health():
    return {"status": "ok", "firebase": _firebase_enabled}
