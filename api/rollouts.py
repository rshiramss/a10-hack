from fastapi import APIRouter, HTTPException

from .schemas import GenerateRolloutsRequest
from src.service import generate_rollouts, get_rollout_detail, get_rollout_summaries

router = APIRouter(prefix="/rollouts", tags=["rollouts"])


@router.get("")
def list_rollouts(limit: int = 50):
    return {"items": get_rollout_summaries(limit=limit)}


@router.get("/{rollout_id}")
def rollout_detail(rollout_id: int):
    detail = get_rollout_detail(rollout_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Rollout not found")
    return detail


@router.post("/generate")
def generate(payload: GenerateRolloutsRequest):
    return generate_rollouts(payload.n_rollouts, verbose=payload.verbose, archetype=payload.archetype)

