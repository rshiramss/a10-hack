from fastapi import APIRouter, HTTPException

from src.service import get_token_attribution

router = APIRouter(prefix="/attribution", tags=["attribution"])


@router.get("/tokens/{rollout_id}")
def token_attribution(rollout_id: int):
    try:
        return get_token_attribution(rollout_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
