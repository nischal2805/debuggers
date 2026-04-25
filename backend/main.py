import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if sa_json:
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
    else:
        sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccount.json")
        cred = credentials.Certificate(sa_path)

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)

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

from routers import auth, session, user

app.include_router(auth.router)
app.include_router(session.router)
app.include_router(user.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
