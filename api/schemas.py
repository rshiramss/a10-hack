from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class GenerateRolloutsRequest(BaseModel):
    n_rollouts: int = Field(default=25, ge=1, le=500)
    verbose: bool = False
    archetype: str | None = None


class ScoreTurnRequest(BaseModel):
    conversation: list[Message]


class PatchRequest(BaseModel):
    rollout_id: int
    alphas: list[float] = Field(default_factory=lambda: [0.5, 1.0, 1.5, 2.0])


class LayerPatchRequest(BaseModel):
    rollout_id: int
    layer_idx: int
    direction: str = Field(default="fn", pattern="^(fn|fp)$")
    alpha: float = Field(default=1.0, gt=0)

