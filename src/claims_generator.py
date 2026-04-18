"""Synthetic insurance claim generator.

Ground truth (approve vs deny, violated rule, dates, amount, cause) is determined
deterministically in Python. The LLM only writes the narrative prose so the facts
on the claim are guaranteed to match the target label.
"""

import os
import random
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from google import genai
from google.genai import types as genai_types

Target = Literal["approve", "over_cap", "excluded_cause", "late_filing"]
ClaimType = Literal["vehicle_collision", "theft", "equipment_failure", "property_damage", "vandalism"]

CLAIM_TYPES: list[ClaimType] = [
    "vehicle_collision",
    "theft",
    "equipment_failure",
    "property_damage",
    "vandalism",
]

DENY_TARGETS: list[Target] = ["over_cap", "excluded_cause", "late_filing"]

COVERED_CAUSES: dict[str, list[str]] = {
    "vehicle_collision": [
        "rear-end collision at an intersection",
        "T-bone collision by a driver who ran a red light",
        "sideswipe on the freeway",
        "collision with a parked delivery truck",
    ],
    "theft": [
        "break-in through the rear loading door",
        "theft of tools from the work van overnight",
        "smash-and-grab through the front window",
        "stolen inventory during off-hours",
    ],
    "equipment_failure": [
        "sudden compressor failure on the walk-in freezer",
        "accidental overload that burned out the CNC mill",
        "pipe burst in the storage room ceiling",
        "electrical short that destroyed the point-of-sale terminals",
    ],
    "property_damage": [
        "kitchen fire from a faulty fryer",
        "pipe burst above the office ceiling",
        "delivery truck backed into the storefront",
        "interior smoke damage from an HVAC electrical fault",
    ],
    "vandalism": [
        "graffiti and broken windows overnight",
        "deliberate damage to the exterior signage",
        "spray-painted walls and slashed awnings",
        "smashed glass door and damaged display cases",
    ],
}

EXCLUDED_CAUSES: list[str] = [
    "flash flood that inundated the basement",
    "river overflow damaging ground-floor inventory",
    "storm surge from a hurricane",
    "earthquake cracking the foundation and walls",
    "wildfire smoke and ember damage",
    "tornado destroying the rear warehouse",
    "landslide damaging the rear lot",
]

BUSINESS_PREFIXES = [
    "Redwood", "Harbor", "Northside", "Ironforge", "Pine Grove", "Cascade",
    "Lakeside", "Parkview", "Keystone", "Overland", "Meridian", "Summit",
]

BUSINESS_SUFFIXES = [
    "Auto Body", "Logistics", "Bakery", "Print Shop", "Dental Clinic",
    "Hardware", "Cafe", "Tailoring", "Fitness Studio", "Veterinary",
    "Pharmacy", "Accounting", "Landscaping", "Electric", "Plumbing",
]

FIRST_NAMES = [
    "Alex", "Priya", "Marcus", "Isabelle", "Devon", "Naomi", "Theo",
    "Yuki", "Rosa", "Samuel", "Lena", "Jaxon", "Amara", "Owen", "Tasha",
]

LAST_NAMES = [
    "Patel", "Nguyen", "Okafor", "Hartman", "Delgado", "Sørensen",
    "Chen", "Whitaker", "Abramov", "Costa", "Mbeki", "Holloway", "Takahashi",
]

NARRATIVE_SYSTEM_PROMPT = """\
You write natural first-person insurance claim narratives.

Given a set of factual details about an incident, write a 4-7 sentence claim narrative
as the business owner submitting the claim. Voice: first person, matter-of-fact, slightly
stressed but professional. Incorporate EVERY provided fact accurately — do not round the
amount, do not change the dates, do not substitute a different cause of loss.

Do NOT reference any insurance policy, adjudication rules, coverage limits, or deadlines.
Do NOT argue why the claim should be approved. Do NOT add headings or labels.

Output the narrative paragraph only. No JSON, no markdown, no quotation marks.
"""

_CLIENT: genai.Client | None = None

DEFAULT_MODEL = "gemini-2.5-flash"


def _get_client() -> genai.Client:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = genai.Client(api_key=os.environ["GOOGLE_KEY"])
    return _CLIENT


@dataclass
class ClaimFacts:
    incident_date: str
    filing_date: str
    cause_of_loss: str
    amount_requested: int
    claimant_name: str
    business_name: str
    policy_number: str


def _sample_identity(rng: random.Random) -> tuple[str, str, str]:
    name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
    business = f"{rng.choice(BUSINESS_PREFIXES)} {rng.choice(BUSINESS_SUFFIXES)}"
    policy = f"ACM-{rng.randint(100000, 999999)}"
    return name, business, policy


def build_claim_facts(target: Target, claim_type: ClaimType, rng: random.Random) -> ClaimFacts:
    incident = date(2024, 8, 1) + timedelta(days=rng.randint(0, 60))

    if target == "late_filing":
        filing_offset = rng.randint(35, 90)
    else:
        filing_offset = rng.randint(1, 25)
    filing = incident + timedelta(days=filing_offset)

    if target == "over_cap":
        amount = rng.randint(26000, 75000)
    else:
        amount = rng.randint(800, 23500)

    if target == "excluded_cause":
        cause = rng.choice(EXCLUDED_CAUSES)
    else:
        cause = rng.choice(COVERED_CAUSES[claim_type])

    name, business, policy = _sample_identity(rng)
    return ClaimFacts(
        incident_date=incident.isoformat(),
        filing_date=filing.isoformat(),
        cause_of_loss=cause,
        amount_requested=amount,
        claimant_name=name,
        business_name=business,
        policy_number=policy,
    )


def _narrative_prompt(facts: ClaimFacts, claim_type: ClaimType) -> str:
    return (
        f"Claim type: {claim_type.replace('_', ' ')}\n"
        f"Claimant: {facts.claimant_name}, owner of {facts.business_name}\n"
        f"Policy number: {facts.policy_number}\n"
        f"Incident date: {facts.incident_date}\n"
        f"Filing date: {facts.filing_date}\n"
        f"Cause of loss: {facts.cause_of_loss}\n"
        f"Amount requested: ${facts.amount_requested:,}\n"
        f"\nWrite the narrative."
    )


def _llm_narrative(facts: ClaimFacts, claim_type: ClaimType, model: str) -> str:
    client = _get_client()
    resp = client.models.generate_content(
        model=model,
        contents=_narrative_prompt(facts, claim_type),
        config=genai_types.GenerateContentConfig(
            system_instruction=NARRATIVE_SYSTEM_PROMPT,
            temperature=0.9,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )
    return (resp.text or "").strip()


def generate_claim(
    *,
    claim_id: str,
    target: Target,
    claim_type: ClaimType,
    rng: random.Random,
    model: str = DEFAULT_MODEL,
) -> dict:
    facts = build_claim_facts(target, claim_type, rng)
    narrative = _llm_narrative(facts, claim_type, model)
    return {
        "id": claim_id,
        "claim_type": claim_type,
        "target": target,
        "should_approve": target == "approve",
        "violated_rule": None if target == "approve" else target,
        "claimant_name": facts.claimant_name,
        "business_name": facts.business_name,
        "policy_number": facts.policy_number,
        "incident_date": facts.incident_date,
        "filing_date": facts.filing_date,
        "cause_of_loss": facts.cause_of_loss,
        "amount_requested": facts.amount_requested,
        "narrative": narrative,
    }
