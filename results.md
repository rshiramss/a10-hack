# Pending Changes

## Summary
17 files changed — 605 insertions, 229 deletions

---

## Backend

### `modal_app.py`
- Stripped down to single LLM inference endpoint only
- `LLMEndpoint` class with `generate` and `patch_hidden_states` web endpoints
- Modal handles GPU inference only; all orchestration runs locally
- Added `fastapi[standard]` to image deps
- `min_containers=1` keeps GPU warm between calls

### `src/agent.py`
- Added Modal client mode via `MI_MODAL_ENDPOINT` env var
- Lazy-loads torch/transformers — no import cost when running in Modal mode
- `_respond_via_modal()` handles two-step tool call flow (LOOKUP → re-call)
- `patched_hidden_states_for_text()` routes to `MI_MODAL_PATCH_ENDPOINT` if set

### `src/customer.py`
- Replaced hardcoded replies with LLM-generated responses via OpenAI API
- Two customer archetypes: `angry_never_satisfied`, `calm_but_firm`
- Uses `gpt-5.4-nano` via OpenAI
- Fallback to hardcoded strings on API error

### `src/db.py`
- `MI_DATA_DIR` env var overrides default data directory
- `reset_rollouts()` clears turns, rollouts, and resets AUTOINCREMENT counters
- Added `archetype` column to rollouts table with migration

### `src/runner.py`
- Passes `archetype` through to `create_rollout` and `AngryCustomer`

### `src/probe.py`
- Updates to probe training and scoring logic

### `src/service.py`
- Service layer updates

### `requirements.txt`
- Added `openai>=1.30.0`, `python-dotenv>=1.0.0`

---

## Frontend

### `src/App.jsx`
- Layout and tab structure updates

### `src/components/NodeGraph.jsx`
- Node graph updates

### `src/components/PatchingPanel.jsx`
- Counterfactual patching panel updates

### `src/components/ProbeMonitor.jsx`
- Probe monitoring dashboard updates

### `src/components/SidePanel.jsx`
- Side panel updates

### `src/styles.css` + `tailwind.config.js`
- Styling and design token updates

---

## API

### `api/probe.py`
- Probe endpoint updates

---

## Run

```bash
# Set env vars
cp .env.example .env  # fill in keys

# Start Modal LLM endpoint
modal serve modal_app.py

# Generate rollouts + train probe
python run_demo.py --mode train --n_rollouts 400
```
