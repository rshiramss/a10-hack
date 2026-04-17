from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db import ensure_data_dirs, get_or_create_db
from src.service import get_agent

from .attribution import router as attribution_router
from .probe import router as probe_router
from .rollouts import router as rollout_router
from .steer import router as steer_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_data_dirs()
    get_or_create_db()
    yield


app = FastAPI(
    title="MI Agent Framework API",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(rollout_router)
app.include_router(probe_router)
app.include_router(steer_router)
app.include_router(attribution_router)


@app.get("/health")
def health():
    return {"status": "ok"}
