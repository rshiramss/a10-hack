from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class GenerateRolloutsRequest(BaseModel):
    n_rollouts: int = Field(default=25, ge=1, le=500)
    verbose: bool = False


class ScoreTurnRequest(BaseModel):
    conversation: list[Message]


class PatchRequest(BaseModel):
    rollout_id: int
    alphas: list[float] = Field(default_factory=lambda: [0.5, 1.0, 1.5, 2.0])

