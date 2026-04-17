# Agentic Framework for Latent State Routing & Counterfactual Probing

## Overview
This project introduces a next-generation agentic orchestration framework that combines **Task-Aware Routing** with **Mechanistic Interpretability (MI)**. 

While traditional agent frameworks (like n8n) rely on explicit outputs and rigid logic trees to route requests or flag errors, this framework peers into the latent cognitive state of Specialized Language Models (SLMs). By using **Counterfactual Probing** and **Activation Patching**, the system can detect when an agent "internally knows" a conversation is failing‚Äîeven if its generated text falsely projects confidence.

## 1. The Core Innovation: Sidestepping the Multi-Turn Steering Problem
Standard activation steering at inference time is fundamentally broken for multi-turn conversational agents. If you inject a steering vector into an agent during turn 3 of a conversation, you alter the output. To see the *result* of that intervention, you would normally have to re-simulate the entire multi-turn interaction from that point forward. However, there is no guarantee the simulated user (or environment) will respond the exact same way, ruining the experimental rollout.

**Our Solution:** Instead of re-running the rollout, we use **Counterfactual Probing**. We replay the *exact same text* from the failed interaction, but inject a steering vector (the difference in mean activations between successful and failed rollouts) into the residual stream at the specific layer where our probe peaks. 

We don't claim the conversation *would* have gone differently. We prove that the model's *internal routing signal* would have classified the outcome differently. This allows for a robust, causal Mechanistic Interpretability story without the need for expensive, noisy re-rollouts.

## 2. Demo Scenario: The "Angry Customer" Verification Loop
To prove this architecture, we utilize a highly constrained, easily verifiable multi-agent simulation:

* **The Environment (Angry Customer LLM):** An LLM initialized with a specific grievance. It is hardcoded with a binary resolution condition (e.g., "concede if the agent offers a refund or apology within 3 turns; otherwise, escalate"). This provides an unambiguous, automated verification signal (Resolved ‚úÖ or Escalated ‚ùå).
* **The Agent (Support SLM):** An agent equipped with external tools (querying a SQLite order history DB). It attempts to resolve the customer's issue. 
* **The Logging:** At every turn, the agent logs the hidden states of its final context token (the summary token where routing/classification signals reside).

Because the verification signal is automated, we can collect 200+ conversational rollouts in minutes, providing a rapid dataset for probe training.

## 3. System Architecture & Technical Pipeline

### Phase 1: Rollout & Hook Logging
Using `nnsight`, we wrap the agent's LLM to trace and cache hidden states during the live rollouts.
* **Target:** The final token position of the agent's hidden state at a given layer $L$.
* **Output:** A dataset mapping the turn ID, the hidden state vector, and the *eventual* retroactive outcome of the conversation (1 for Success, 0 for Escalation).

### Phase 2: Outcome-Retroactive Probe Training
We avoid turn-level labeling (which is noisy during early turns) and instead train our probe on the *last agent turn* before resolution or escalation. 
* **Model:** A linear probe (Logistic Regression).
* **Steering Vector:** Calculated by subtracting the mean failure activations from the mean success activations: 
    $$V_{steer} = \mu_{success} - \mu_{failure}$$

### Phase 3: The Counterfactual Patch Pass
When the system identifies a **False Negative**‚Äîa state where the agent's text was positive, but the actual outcome was an escalation‚Äîwe execute the patch:
1.  Isolate the specific turn.
2.  Run a single forward pass (no generation required).
3.  Inject the steering vector at layer $L$: `hidden_state += alpha * V_steer`.
4.  Feed the patched state back into the offline probe.
5.  **Result:** If the probe now correctly predicts "Escalation", we have proven the model had a recoverable internal signal that was ignored by the generation head.

## 4. UI / UX: The Interpretability Dashboard
The framework features an n8n-style node-based UI, enhanced with a deeply integrated interpretability side panel. 

For every agent turn, the UI exposes:
* **Live Probe Confidence:** e.g., *"Agent internally predicts 73% chance of resolution."*
* **Post-Hoc Counterfactuals:** On flagged false negatives, the UI highlights the turn and displays: *"Probe would have predicted 41% success with corrected activations at $ lpha=1.5$."*
* **Token Attribution Heatmaps:** A cheap, qualitative overlay on the conversation text, showing which specific tokens heavily influenced the probe's latent classification.

## 5. Enterprise Impact & Hackathon Alignment
* **Agentic Workflows:** Orchestrates autonomous tool execution (DB queries) while using secure context exchange.
* **Task-Aware Routing:** Proves that we don't just have to route based on explicit text; we can route based on the *latent cognitive state* of an SLM. If the internal probe confidence drops below a threshold, the orchestrator can securely route the user to a human operator *before* the SLM generates a catastrophic response.
* **Efficiency:** By utilizing outcome-retroactive probing and counterfactual forward passes, this entire interpretability framework runs fast enough to be bolted onto real-time enterprise AI infrastructure.