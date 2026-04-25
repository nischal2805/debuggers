import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

_firebase_enabled = False


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
