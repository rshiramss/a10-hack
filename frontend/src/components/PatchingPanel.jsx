export default function PatchingPanel({ patchResult, flagged, attribution }) {
  return (
    <section className="grid gap-4">
      <div className="rounded-[28px] bg-white/8 p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">Patch Analysis</div>
        <div className="mt-3 text-sm text-slate-200">
          {flagged
            ? "This rollout is currently flagged as a probe false positive."
            : "Select a rollout and run a counterfactual patch to inspect score drift."}
        </div>
        {patchResult ? (
          <div className="mt-4 space-y-2 text-sm">
            <div className="rounded-2xl bg-white/6 p-3">
              Original score: {(patchResult.original_probe_score * 100).toFixed(1)}%
            </div>
            {Object.entries(patchResult.patched_probe_scores).map(([alpha, value]) => (
              <div key={alpha} className="rounded-2xl bg-white/6 p-3">
                α {alpha}: {(value * 100).toFixed(1)}%{" "}
                <span className="text-slate-400">
                  ({patchResult.delta_by_alpha[alpha] >= 0 ? "+" : ""}
                  {(patchResult.delta_by_alpha[alpha] * 100).toFixed(1)} pts)
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-[28px] bg-white/8 p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">Token Attribution</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {attribution?.tokens?.slice(0, 48).map((item, index) => (
            <span
              key={`${item.token}-${index}`}
              className="rounded-full px-3 py-1 text-xs"
              style={{
                backgroundColor: `rgba(249, 115, 22, ${Math.min(item.score * 3, 0.9)})`,
              }}
            >
              {item.token}
            </span>
          )) ?? <span className="text-sm text-slate-400">Attribution appears after a rollout is selected.</span>}
        </div>
      </div>
    </section>
  );
}

