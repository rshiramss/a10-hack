from fastapi import APIRouter, HTTPException

from .schemas import LayerPatchRequest, PatchRequest
from src.service import run_layer_patch, run_patch_for_rollout

router = APIRouter(prefix="/steer", tags=["steer"])


@router.post("/patch")
def patch_rollout(payload: PatchRequest):
    try:
        return run_patch_for_rollout(payload.rollout_id, payload.alphas)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/patch/layer")
def patch_rollout_at_layer(payload: LayerPatchRequest):
    try:
        return run_layer_patch(payload.rollout_id, payload.layer_idx, payload.direction, payload.alpha)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
