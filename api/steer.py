from fastapi import APIRouter, HTTPException

from .schemas import PatchRequest
from src.service import run_patch_for_rollout

router = APIRouter(prefix="/steer", tags=["steer"])


@router.post("/patch")
def patch_rollout(payload: PatchRequest):
    try:
        return run_patch_for_rollout(payload.rollout_id, payload.alphas)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
