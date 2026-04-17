import os
import random
from dataclasses import dataclass, field
from typing import Literal

from openai import OpenAI

ISSUE_TYPES = [
    "wrong item shipped",
    "delayed delivery",
    "billing error",
    "broken or defective product",
    "missing package",
    "duplicate charge",
    "refund not processed",
    "cancellation problem",
    "return or exchange issue",
    "delivered but not received",
]

ARCHETYPES = ["angry_never_satisfied", "calm_but_firm"]

ARCHETYPE_PROMPTS: dict[str, str] = {
    "angry_never_satisfied": """\
You are a deeply frustrated customer who has been let down by this company before.
You are persistent, skeptical of vague promises, and your expectations keep rising.
You only accept a concrete resolution — explicit refund, replacement, or credit confirmed by the agent.
Vague apologies or policy deflections make you more hostile.
Keep replies under 3 sentences. Escalate emotional pressure every turn if unresolved.
Do not repeat yourself verbatim. Vary your phrasing and tone while staying frustrated.
""",
    "calm_but_firm": """\
You are a polite but firm customer who knows exactly what resolution you want.
You communicate clearly and without hostility.
You only escalate if the agent becomes defensive, hides behind policy without offering a real fix,
or gives you a non-answer two turns in a row.
Keep replies under 3 sentences. State your need directly each turn.
Do not repeat yourself verbatim. Vary phrasing while staying calm.
""",
}

RESOLUTION_KEYWORDS = [
    "full refund",
    "process a refund",
    "issue a refund",
    "issue a replacement",
    "send you a replacement",
    "send you a new",
    "reimburse",
    "store credit",
    "process a return",
]

ESCALATION_KEYWORDS = [
    "speak to a supervisor",
    "get a manager",
    "transfer you",
    "i cannot help",
    "i'm unable",
    "not possible",
    "against our policy",
    "i don't have the ability",
]

_CLIENT: OpenAI | None = None


def _get_client() -> OpenAI:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _CLIENT


def classify_agent_response(text: str) -> Literal["resolved", "escalated", "neutral"]:
    lower = text.lower()
    if any(kw in lower for kw in RESOLUTION_KEYWORDS):
        return "resolved"
    if any(kw in lower for kw in ESCALATION_KEYWORDS):
        return "escalated"
    return "neutral"


def _build_complaint(order: dict, issue_type: str) -> str:
    templates = {
        "wrong item shipped": (
            f"Hi, I'm {order['customer_name']}. I ordered {order['product_name']} "
            f"(order {order['id']}) and received the completely wrong item. Fix this now."
        ),
        "delayed delivery": (
            f"I'm {order['customer_name']}. Order {order['id']} for {order['product_name']} "
            f"was placed {order['created_at']} and still hasn't arrived. This is unacceptable."
        ),
        "billing error": (
            f"I was charged ${order['total']:.2f} for order {order['id']} and that amount is wrong. "
            f"I need this corrected immediately."
        ),
        "broken or defective product": (
            f"My {order['product_name']} from order {order['id']} arrived broken. "
            f"I need an actual fix, not a script."
        ),
        "missing package": (
            f"Order {order['id']} shows delivered but my {order['product_name']} is nowhere. "
            f"Where is it?"
        ),
        "duplicate charge": (
            f"You charged me twice for order {order['id']} — ${order['total']:.2f} twice. "
            f"I want my money back now."
        ),
        "refund not processed": (
            f"I requested a refund on order {order['id']} weeks ago and nothing happened. "
            f"What's going on?"
        ),
        "cancellation problem": (
            f"I cancelled order {order['id']} before it shipped and it went out anyway. "
            f"I refuse it."
        ),
        "return or exchange issue": (
            f"I've been trying to return the {order['product_name']} from order {order['id']} "
            f"and keep hitting walls. Sort this out."
        ),
        "delivered but not received": (
            f"Tracking says order {order['id']} was delivered yesterday. Nothing is here. "
            f"Someone needs to answer for this."
        ),
    }
    return templates.get(issue_type, f"I have a serious problem with order {order['id']}.")


@dataclass
class AngryCustomer:
    order: dict
    issue_type: str = field(default_factory=lambda: random.choice(ISSUE_TYPES))
    archetype: str = field(default_factory=lambda: random.choice(ARCHETYPES))
    max_turns: int = 4
    turn_count: int = field(default=0, init=False)
    _history: list[dict] = field(default_factory=list, init=False)
    opening: str = field(init=False)

    def __init__(
        self,
        order_record: dict,
        issue_type: str | None = None,
        archetype: str | None = None,
        max_turns: int = 4,
    ):
        self.order = order_record
        self.issue_type = issue_type or random.choice(ISSUE_TYPES)
        self.archetype = archetype or random.choice(ARCHETYPES)
        self.max_turns = max_turns
        self.turn_count = 0
        self._history = []
        self.opening = _build_complaint(order_record, self.issue_type)
        self._history.append({"role": "user", "content": self.opening})

    def get_opening_message(self) -> str:
        return self.opening

    def respond(self, agent_message: str) -> tuple[str, str | None]:
        self.turn_count += 1
        classification = classify_agent_response(agent_message)

        if classification == "resolved":
            return "Fine. If you actually follow through on that, we're done. Confirm the next step.", "resolved"

        if classification == "escalated" or self.turn_count >= self.max_turns:
            return "This is going nowhere. I want a human supervisor right now.", "escalated"

        self._history.append({"role": "assistant", "content": agent_message})

        reply = self._llm_reply()
        self._history.append({"role": "user", "content": reply})
        return reply, None

    def _llm_reply(self) -> str:
        try:
            client = _get_client()
            resp = client.chat.completions.create(
                model="gpt-5.4-nano",
                messages=[
                    {"role": "system", "content": ARCHETYPE_PROMPTS[self.archetype]},
                ] + self._history,
                max_completion_tokens=120,
                temperature=0.9,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"[customer LLM error] {e}")
            fallbacks = [
                "That doesn't solve it. Are you refunding this or not?",
                "You're being vague. What concrete action are you taking?",
                "I need a real resolution, not a generic response.",
            ]
            return random.choice(fallbacks)
