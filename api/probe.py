from fastapi import APIRouter

from .schemas import ScoreTurnRequest
from src.service import get_probe_curve, get_probe_dashboard, score_live_turn, train_probe_from_db

router = APIRouter(prefix="/probe", tags=["probe"])


@router.post("/train")
def train_probe():
    return train_probe_from_db()


@router.post("/score")
def score_turn(payload: ScoreTurnRequest):
    return score_live_turn([message.model_dump() for message in payload.conversation])


@router.get("/layer_curve")
def layer_curve():
    return {"items": get_probe_curve()}


@router.get("/dashboard")
def dashboard():
    return get_probe_dashboard()

