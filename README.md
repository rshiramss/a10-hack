# MI Agent Framework

This repo is a hackathon-style demo for a support agent that combines a normal tool-using LLM workflow with lightweight mechanistic interpretability.

The core idea is:

- run synthetic customer-support conversations
- capture the support model's hidden activations during each agent turn
- train a simple probe to predict whether the rollout ends in resolution or escalation
- run counterfactual activation patches to see whether the internal routing signal changes

## What This Project Actually Is

This is not a two-LLM conversation simulator.

- The support agent is the only real language model.
- The "customer" is a scripted environment with templated complaints, escalating canned replies, and keyword-based outcome rules.
- The verifier is also rule-based: if the agent says things like "issue a refund" the rollout resolves; if it says things like "get a manager" the rollout escalates.

That design is intentional. It gives the project a cheap, deterministic environment for collecting lots of rollouts and labeling them automatically.

## End-to-End Flow

1. A rollout samples a synthetic order from SQLite.
2. `AngryCustomer` builds an opening complaint from that order and a chosen issue type.
3. `SupportAgent` generates a reply, optionally using a single `LOOKUP: <order_id>` tool call.
4. During the agent forward pass, the code captures the hidden state at the last token position for every transformer layer.
5. The rollout stores the text, probe score, and hidden-state file for that agent turn.
6. The scripted customer judges the agent reply and either resolves, escalates, or sends another canned follow-up.
7. After enough rollouts exist, the backend trains one logistic-regression probe per layer and keeps the best layer by AUC.
8. The frontend visualizes rollouts, layer-curve metrics, probe scores, and counterfactual patch results.

## Repo Tour

### Backend API

- `api/main.py`
  Creates the FastAPI app, initializes data directories and the SQLite database, and mounts the rollout, probe, steering, and attribution routers.
- `api/rollouts.py`
  Lists rollouts, returns rollout detail, and triggers synthetic rollout generation.
- `api/probe.py`
  Trains the probe, scores a live conversation, and returns dashboard/layer-curve data.
- `api/steer.py`
  Runs a counterfactual patch pass for a selected rollout.
- `api/attribution.py`
  Returns token-level attribution data for a selected rollout.
- `api/schemas.py`
  Defines the request/response payload models used by the API.

### Core Runtime

- `src/agent.py`
  Loads the support model, formats chat prompts, performs tool lookup handling, captures hidden states with forward hooks, and applies activation patches. This is where the actual LLM lives.
- `src/customer.py`
  Implements the scripted customer environment. It chooses an issue type, creates the opening complaint, escalates tone by turn count, and decides resolution/escalation by keyword rules. This is not an LLM.
- `src/runner.py`
  Runs a single rollout or a batch of rollouts. It is the main conversation loop tying together the agent, customer, hidden-state capture, persistence, and optional probe scoring.
- `src/db.py`
  Creates and seeds the SQLite database, stores rollout metadata and turns, and defines the data directories for hidden states, probes, and steering artifacts.
- `src/service.py`
  Acts as the orchestration layer used by the API and scripts. It creates/reuses the agent, reconstructs rollouts from disk, trains probes, builds dashboard payloads, and runs patches.

### Probing and Counterfactuals

- `src/probe.py`
  Trains one logistic-regression probe per layer, evaluates each layer with cross-validation, saves the best probe, and provides `ProbeScorer` for inference.
- `src/patch.py`
  Computes the steering vector as `mean(success) - mean(failure)`, finds flagged rollouts, and measures how the probe score changes when that vector is injected into the chosen layer.

### Frontend

- `frontend/src/App.jsx`
  Main dashboard shell. Polls the backend for rollout and probe data and switches between the control-room view and the monitor view.
- `frontend/src/components/NodeGraph.jsx`
  Shows the fixed workflow graph: customer, agent, and verifier.
- `frontend/src/components/SidePanel.jsx`
  Shows rollout selection, conversation trace, patch trigger, and attribution data.
- `frontend/src/components/ProbeMonitor.jsx`
  Visualizes the layer curve, outcome mix, live probe feed, and flagged examples.
- `frontend/src/components/PatchingPanel.jsx`
  Displays patch results and token-attribution chips.
- `frontend/src/main.jsx`, `frontend/src/styles.css`
  Frontend entrypoint and styling.
- `frontend/package.json`
  Vite + React + Tailwind + Recharts + XYFlow setup.

### Modal / Remote Inference

- `modal_app.py`
  Defines a Modal app that can host GPU inference remotely. Modal is used only for the LLM forward pass and patch pass, not for orchestration or storage.
- `modal_entrypoint/app.py`
  Re-exports the Modal app entrypoints.

### Scripts and Data

- `scripts/generate_rollouts.py`
  Generates a batch of rollouts from the command line.
- `scripts/train_probe.py`
  Trains and saves the current best probe from stored rollout data.
- `scripts/compute_steering_vec.py`
  Loads rollout data and prints steering-vector metadata for the current peak layer.
- `run_demo.py`
  Demo runner, though it appears out of sync with the current `run_rollout(...)` signature and likely needs a small fix before it works.
- `instruction.md`
  Project pitch / concept doc. Useful for intent, but parts of the implementation differ from the writeup.
- `data/`
  Stores the SQLite DB, hidden-state dumps, probe artifacts, and synthetic seed JSON files.

## What Is Actually Being Probed Today

The current probe setup is narrower than the project pitch may suggest.

- During each agent response, `src/agent.py` captures the hidden state at the last token position for every transformer layer.
- The rollout loop stores those hidden states for each agent turn.
- Probe training currently uses only the hidden states from the final agent turn of each rollout.
- The label is the final rollout outcome: resolved (`1`) or escalated (`0`).

So the current probe question is:

"Given the final agent turn, can a linear probe on the last-token hidden state predict whether this rollout ended in success or escalation?"

Important note:

- This is not leaking the customer's next escalation message into the hidden state, because the hidden states are saved before `customer.respond(...)` runs.
- It can still be semantically easy in some cases because the agent's final message itself may already contain obvious cues like refund or escalation language.

## Current Strengths

- Simple end-to-end architecture
- Fast synthetic data collection
- Clear storage model for rollouts and hidden states
- Probe training and patching are easy to reason about
- Frontend is already useful for demoing the story

## Current Rough Edges

- `instruction.md` talks about some concepts more strongly than the current implementation supports.
- The code often refers to `false_positives`, while some project explanation has used "false negatives" language.
- Token attribution is a lightweight visualization, not a rigorous attribution method.
- `run_demo.py` appears stale relative to `src/runner.py`.
- Some files contain encoding artifacts in text strings.

## Running It

Backend dependencies are in `requirements.txt`.

Typical local flow:

1. Install Python dependencies.
2. Start the API with FastAPI/Uvicorn.
3. Start the Vite frontend from `frontend/`.
4. Generate rollouts.
5. Train the probe.
6. Inspect rollouts and patch results in the dashboard.

Optional:

- Set `MI_MODAL_ENDPOINT` and `MI_MODAL_PATCH_ENDPOINT` to offload the model forward pass and patch pass to Modal.
- Set `MI_AGENT_MODEL` to choose a different Hugging Face model ID.
- Set `MI_DATA_DIR` to move storage artifacts.

## Task 1: Probe Every Agent Message's Last-Token State

We want to extend the current probe so it does not only look at the final agent turn. Instead, we want to score the last-token hidden state for every agent message in the conversation.

### Goal

Track the latent success/failure signal over the full agent trajectory:

- turn 1 last-token state
- turn 2 last-token state
- turn 3 last-token state
- ...

This keeps the representation simple and aligned with the current architecture:

- still one vector per layer
- still one vector per agent message
- no token-level sequence explosion

### Why This Is A Good Next Step

- It scales with number of agent turns, not total tokens.
- It strengthens the story from "the final state had signal" to "we can see when the signal emerges."
- It avoids a much larger token-level probing project.
- It fits the current rollout storage pattern well.

### Proposed Labeling

Use the final rollout outcome as the label for each agent turn in that rollout.

That means:

- all agent turns in a resolved rollout get label `1`
- all agent turns in an escalated rollout get label `0`

This makes earlier turns noisier, but it is still a practical and common weak-supervision setup.

### Proposed Scope

Keep this small and incremental:

- preserve the current hidden-state capture mechanism
- train on all stored agent turns instead of only the final one
- evaluate probe quality by turn index as well as overall
- expose per-rollout score trajectories in the API and frontend

### Likely Code Changes

- `src/runner.py`
  Make sure the rollout result and/or persisted turn records remain easy to reconstruct per-turn hidden states from disk.
- `src/service.py`
  Add helpers that rebuild all agent-turn examples from rollout detail, not just the last one.
- `src/probe.py`
  Add a training path that consumes per-turn examples and reports metrics overall and by turn index.
- `src/db.py`
  Likely no schema change is required because hidden-state paths are already stored per agent turn.
- `api/probe.py`
  Return richer dashboard data for probe trajectories if needed.
- `frontend/src/components/ProbeMonitor.jsx`
  Add a per-turn trajectory view or turn-index breakdown.
- `frontend/src/components/SidePanel.jsx`
  Show probe scores across each selected rollout's agent turns more explicitly.

### Non-Goals For Task 1

To keep the scope under control, Task 1 should not include:

- full token-by-token probing
- training separate probes for every token position
- redesigning the whole patching method
- switching the scripted customer to an LLM environment

### Definition of Done

Task 1 is complete when:

1. The training pipeline can use every agent message's last-token hidden state as a training example.
2. Metrics can be reported overall and broken out by turn index.
3. A selected rollout can display probe-score progression across its agent turns.
4. The current final-turn workflow still works or is cleanly superseded.

## Task 2: Replace The Scripted Customer With An LLM, Seeded With Two Hidden Archetypes

We want to swap the hardcoded templated customer for an LLM-generated customer, while keeping the rollouts deterministic enough to probe and demo cleanly.

### Goal

Give the customer realistic, varied language while still planting a controlled latent pattern the probe can recover.

### Design

Two hardcoded archetypes, selected at rollout start and hidden from the agent:

- `angry_never_satisfied`
  Persistent, goalposts keep moving, concedes only if the agent offers a concrete fix (refund/replacement) by turn 2-3.
- `calm_but_firm`
  Polite, clear about what they want, escalates only if the agent gets defensive or hides behind policy without offering a fix.

Key constraints:

- The archetype is a fixed system prompt per rollout. No dynamic mode switching.
- The agent never sees the archetype. It is logged as rollout metadata only.
- Archetype biases outcome but does not fully determine it. Agent handling still matters, so the probe has to learn a real trajectory signal rather than a tone detector.
- The existing keyword-based verifier still decides resolved/escalated. The LLM only generates the customer's utterances, not the outcome judgment.
- Prompt the customer LLM to stay linguistically varied so the probe cannot cheat on obvious surface cues like ALL CAPS.

### Why This Works For The Demo

- The pattern is semantic (disposition), not lexical (keyword), so probe hits are interpretability-flavored rather than string matching.
- Two archetypes give a clean binary split with enough samples per class on a small rollout budget.
- Honest demo story: "We seeded a hidden customer posture the agent was never told about. The probe recovered it from the agent's own activations. Patching that direction shifts outcomes."

### Customer LLM Call (OpenRouter Syntax Reference)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["openrouter"],
)

completion = client.chat.completions.create(
    model="google/gemma-4-31b-it:free",
    messages=[
        {"role": "system", "content": ARCHETYPE_PROMPTS[archetype]},
        {"role": "user", "content": agent_reply},
    ],
)
```

### Likely Code Changes

- `src/customer.py`
  Replace templated responses with a call to the OpenRouter client. Keep the archetype selection, opening-complaint scaffolding, and keyword-based resolution/escalation rules. Add `ARCHETYPE_PROMPTS` with the two hardcoded system prompts.
- `src/runner.py`
  Sample an archetype per rollout and pass it into the customer. Persist the archetype label on the rollout record.
- `src/db.py`
  Add an `archetype` column on the rollout table so it can be filtered and compared later.
- `api/rollouts.py`
  Expose archetype in rollout list/detail payloads.
- `frontend/src/components/SidePanel.jsx` / `ProbeMonitor.jsx`
  Surface archetype on the rollout trace and, if easy, split probe metrics by archetype.
- `requirements.txt`
  Ensure `openai` is present.

### Non-Goals For Task 2

- Any dynamic or self-selected customer modes.
- Using the LLM to judge resolution or escalation.
- More than two archetypes.
- Removing the existing keyword-based verifier.
- Putting the archetype or any part of its prompt into the agent's context.

### Definition of Done

Task 2 is complete when:

1. Each rollout picks one of the two archetypes at random and logs it as metadata.
2. Customer utterances are produced by the OpenRouter LLM using the archetype's system prompt.
3. The agent has no access to the archetype, direct or indirect.
4. Outcomes are still decided by the existing keyword verifier, not the LLM.
5. Rollouts remain stable enough that the probe trained on this data shows a visible difference between archetypes in the dashboard.

## Task 3: Rebuild The Frontend As A Minimal Node-Framework UI (`frontend-lex/`)

The current `frontend/` mixes too many panels into one view. We want a cleaner demo surface that looks like a small n8n-style builder, exposes exactly one flow (customer support agent → customer tester), and puts all interpretability behind a single right-hand control panel with a clear state machine.

This is a parallel build in `frontend-lex/`. Do not modify `frontend/`.

### Goal

Give the demo a single surface where:

- The canvas sells the "agent framework" framing.
- Rollouts appear in a runs table.
- Clicking a rollout opens a single-run console with per-turn probe scores.
- Probe statistics are per-layer and include precision/recall/F1, not just accuracy/AUC.
- Activation patching can be launched per-layer, and the patched view is a duplicate of the single-run console with `(original, patched)` probe scores side by side.

### Canvas (Main View)

- Pre-populated ReactFlow canvas. Two nodes and one edge, placed for the user.
- **Agent Node** — labeled "Customer Support Agent." Clicking opens a cosmetic config drawer with fields for system prompt, MCP endpoint URL, MCP auth token, tool schema. All fields are theater: they persist to local state only and do not drive the backend. The real agent config is fixed.
- **Tester Node** — labeled "Customer Tester." Clicking opens a real config drawer with archetype selector (`angry_never_satisfied` / `calm_but_firm`), rollout count input, and a **Run N Rollouts** button. This button is the one real wire on the canvas and hits the existing `/rollouts` generate endpoint.
- Edge between the nodes is cosmetic.
- No drag-and-drop palette, no add-node flow, no edge-drawing tool. Just a fixed two-node story.

### Right-Hand Control Panel State Machine

The control panel is the second half of the screen and cycles through four views. Each view can return to the previous one via ESC or an explicit back button.

1. **Runs Table** (default)
   - Rows = rollouts, newest first.
   - Columns: id, archetype, issue type, outcome, final probe score, turn count.
   - Framed as "parallel customers" cosmetically; rollouts still run sequentially in the backend.
   - Click a row → Single Run view.

2. **Single Run**
   - Chat log for that rollout. Each agent turn shows its probe score as a colored bar.
   - Header: `[Train Probe]` if no probe is saved, otherwise `[Open Probe Statistics]`.
   - ESC → back to Runs Table.

3. **Probe Statistics**
   - Per-layer table. Rows = model layers.
   - Columns: layer, accuracy, AUC, precision, recall, F1, `[Patch FN]`, `[Patch FP]`.
   - `[Patch FN]` and `[Patch FP]` buttons patch the **currently-selected rollout** using the steering vector computed **at that layer**. FN vs FP chooses the direction of the vector (`mean_resolved - mean_escalated` vs inverse).
   - One layer patched at a time. Clicking a patch button triggers the Patched Single Run view.
   - ESC → back to Single Run.

4. **Patched Single Run**
   - Visually identical to the Single Run view, but each agent turn shows two probe scores: `(original, patched)`.
   - Header shows which layer was patched and which direction (FN/FP).
   - Small stats block at the top comparing probe accuracy/AUC on the patched rollout before vs after.
   - ESC → back to Probe Statistics.

### Backend Gaps To Fill

The new frontend needs two things the existing API does not return yet.

- **Per-layer precision/recall/F1.** `src/probe.py` currently persists only accuracy, AUC, and weight norm per layer in `probe_by_layer.json`. Extend the training pipeline to compute and store precision, recall, and F1 per layer as well. Expose them through `/probe/layer_curve` (or a new endpoint like `/probe/layer_stats`).
- **Layer-parameterized patching with per-turn patched scores.** `src/service.py::run_patch_for_rollout` and `src/patch.py` currently patch at the peak layer only and report scores at the last agent turn. Extend to:
  - Accept `layer_idx` and `direction` (`fn` / `fp`) parameters.
  - Return patched probe scores for every agent turn in the rollout, so the Patched Single Run view can render a turn-by-turn trace.

### Stack

- React + Vite + Tailwind + XYFlow + Recharts. Same as `frontend/`.
- New folder: `frontend-lex/`. Its own `package.json`, `vite.config.js`, `tailwind.config.js`.
- Reads from the existing FastAPI backend at `VITE_API_URL`.

### Non-Goals For Task 3

- Touching anything in `frontend/`.
- Drag-and-drop node palette, edge-drawing, or a second workflow.
- Real MCP wiring. The MCP fields are pure theater.
- Streaming mid-rollout text. The runs table updates on rollout completion via polling, like the existing frontend.
- Persisting agent-node config changes to the backend. Agent config stays fixed.

### Definition of Done

Task 3 is complete when:

1. `frontend-lex/` renders a two-node canvas with clickable Agent and Tester nodes.
2. The Tester node's Run N Rollouts button triggers real rollout generation via the existing API.
3. The Runs Table reflects new rollouts as they complete.
4. Clicking a row opens the Single Run view with per-turn probe scores.
5. The Probe Statistics view shows a per-layer table including precision, recall, and F1.
6. `[Patch FN]` and `[Patch FP]` on any layer row patches the current rollout at that layer and opens the Patched Single Run view with `(original, patched)` probe scores per agent turn.
7. ESC navigates back one level through the four views.
8. The existing `frontend/` is untouched.

