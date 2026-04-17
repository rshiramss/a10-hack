import { useEffect, useMemo, useState } from "react";
import PatchingPanel from "./PatchingPanel";

export default function SidePanel({
  apiUrl,
  selectedNodeId,
  selectedRollout,
  rollouts,
  falsePositives,
  onSelectRollout,
}) {
  const [detail, setDetail] = useState(null);
  const [patchResult, setPatchResult] = useState(null);
  const [attribution, setAttribution] = useState(null);

  useEffect(() => {
    if (!selectedRollout) {
      return;
    }
    setPatchResult(null);
    fetch(`${apiUrl}/rollouts/${selectedRollout.id}`)
      .then((response) => response.json())
      .then((payload) => setDetail(payload))
      .catch(console.error);

    fetch(`${apiUrl}/attribution/tokens/${selectedRollout.id}`)
      .then((response) => response.json())
      .then((payload) => setAttribution(payload))
      .catch(() => setAttribution(null));
  }, [apiUrl, selectedRollout]);

  const falsePositiveLookup = useMemo(
    () => new Set(falsePositives.map((item) => item.rollout_id)),
    [falsePositives]
  );

  async function runPatch() {
    if (!selectedRollout) {
      return;
    }
    const response = await fetch(`${apiUrl}/steer/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollout_id: selectedRollout.id, alphas: [0.5, 1.0, 1.5, 2.0] }),
    });
    const payload = await response.json();
    setPatchResult(payload);
  }

  return (
    <aside className="flex h-full flex-col gap-5 rounded-[32px] border border-white/60 bg-slate-950/95 p-5 text-white shadow-panel">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Inspector</p>
        <h2 className="mt-2 text-2xl font-semibold">{selectedNodeId} panel</h2>
      </div>

      <div className="rounded-[28px] bg-white/8 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">Rollouts</div>
            <div className="mt-1 text-sm text-slate-200">Recent synthetic support runs</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {rollouts.map((rollout) => (
            <button
              key={rollout.id}
              onClick={() => onSelectRollout(rollout.id)}
              className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                selectedRollout?.id === rollout.id
                  ? "bg-white text-slate-950"
                  : "bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">#{rollout.id} · {rollout.issue_type}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] ${
                  rollout.outcome === "resolved" ? "bg-teal-500/20 text-teal-200" : "bg-orange-500/20 text-orange-200"
                }`}>
                  {rollout.outcome ?? "pending"}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">{rollout.customer_name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] bg-white/8 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">Conversation Trace</div>
            <div className="mt-1 text-sm text-slate-200">Per-turn state and outcome</div>
          </div>
          {selectedRollout ? (
            <button
              onClick={runPatch}
              className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Run Counterfactual
            </button>
          ) : null}
        </div>
        <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {detail?.turns?.map((turn, index) => (
            <div key={`${turn.turn_index}-${index}`} className="rounded-2xl bg-white/6 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono uppercase tracking-[0.25em] text-slate-400">{turn.speaker}</span>
                {typeof turn.probe_score === "number" ? (
                  <span className="text-slate-200">{Math.round(turn.probe_score * 100)}%</span>
                ) : null}
              </div>
              {typeof turn.probe_score === "number" ? (
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-teal-300"
                    style={{ width: `${Math.max(turn.probe_score * 100, 8)}%` }}
                  />
                </div>
              ) : null}
              <p className="mt-3 text-sm leading-6 text-slate-100">{turn.text}</p>
            </div>
          ))}
        </div>
      </div>

      <PatchingPanel
        patchResult={patchResult}
        flagged={selectedRollout ? falsePositiveLookup.has(selectedRollout.id) : false}
        attribution={attribution}
      />
    </aside>
  );
}
