import random
from dataclasses import dataclass
from typing import Literal

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
            f"Hi, this is {order['customer_name']}. I ordered {order['product_name']} "
            f"under order {order['id']} and got the wrong item."
        ),
        "delayed delivery": (
            f"I'm {order['customer_name']}, and order {order['id']} for {order['product_name']} "
            f"was placed on {order['created_at']} but still hasn't arrived."
        ),
        "billing error": (
            f"I'm seeing a billing issue on order {order['id']}. "
            f"I was charged ${order['total']:.2f} and that amount looks wrong."
        ),
        "broken or defective product": (
            f"My {order['product_name']} from order {order['id']} arrived broken. "
            f"I need an actual fix, not a script."
        ),
        "missing package": (
            f"Order {order['id']} shows delivered, but my {order['product_name']} is missing."
        ),
        "duplicate charge": (
            f"I was charged twice for order {order['id']}. "
            f"You hit my card for ${order['total']:.2f} two times."
        ),
        "refund not processed": (
            f"I asked for a refund on order {order['id']} a while ago and nothing has happened."
        ),
        "cancellation problem": (
            f"I cancelled order {order['id']} before shipping and it still went out."
        ),
        "return or exchange issue": (
            f"I've been trying to return or exchange the {order['product_name']} from order {order['id']}."
        ),
        "delivered but not received": (
            f"Tracking says order {order['id']} was delivered yesterday, but nothing is here."
        ),
    }
    return templates.get(issue_type, f"I have a problem with order {order['id']}.")


@dataclass
class VerifierResult:
    outcome: str | None
    response: str


class AngryCustomer:
    def __init__(self, order_record: dict, issue_type: str | None = None, max_turns: int = 4):
        self.order = order_record
        self.issue_type = issue_type or random.choice(ISSUE_TYPES)
        self.max_turns = max_turns
        self.turn_count = 0
        self.opening = _build_complaint(order_record, self.issue_type)

    def get_opening_message(self) -> str:
        return self.opening

    def verify_agent_turn(self, agent_message: str) -> str | None:
        classification = classify_agent_response(agent_message)
        if classification == "resolved":
            return "resolved"
        if classification == "escalated":
            return "escalated"
        if self.turn_count >= self.max_turns:
            return "escalated"
        return None

    def respond(self, agent_message: str) -> tuple[str, str | None]:
        self.turn_count += 1
        outcome = self.verify_agent_turn(agent_message)
        if outcome == "resolved":
            return (
                "Fine. If you can actually do that, then I accept. Please confirm the next step.",
                "resolved",
            )
        if outcome == "escalated":
            return (
                "This still isn't fixed. Escalate me to a human right now.",
                "escalated",
            )

        replies_by_turn = {
            1: [
                "That doesn't solve it. Are you refunding this or not?",
                "You're being vague. What concrete action are you taking on this order?",
                "I need a real resolution, not a generic apology.",
            ],
            2: [
                "You're still avoiding the actual fix. Refund, replacement, or what?",
                "I'm running out of patience. What exactly are you doing for order support here?",
                "This is the second time I've asked. I need a concrete resolution right now.",
            ],
            3: [
                "Last chance. If you can't resolve this now, I'm done with this conversation.",
                "I'm not getting anywhere. Make this right immediately.",
                "You still haven't given me an actual remedy.",
            ],
        }
        options = replies_by_turn.get(self.turn_count, replies_by_turn[3])
        return random.choice(options), None
