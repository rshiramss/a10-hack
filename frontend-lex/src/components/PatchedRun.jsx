export default function PatchedRun({ rollout, patchData, onClose }) {
  const turns = rollout?.turns || []
  const patchMeta = patchData
    ? { layer: patchData.layer_idx, direction: patchData.direction, alpha: patchData.alpha, peakLayer: patchData.peak_layer }
    : null

  const scoreByTurn = {}
  if (patchData?.turn_scores) {
    for (const ts of patchData.turn_scores) {
      scoreByTurn[ts.turn_index] = ts
    }
  }

  const summary = patchData?.summary

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6">
      <div className="flex flex-col h-full w-full max-w-[1100px] rounded-2xl border-2 border-violet-500/60 bg-slate-950 shadow-[0_0_80px_rgba(139,92,246,0.35)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/40 bg-gradient-to-r from-violet-900/40 via-slate-900/40 to-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs font-bold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Patched Run
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Rollout #{rollout?.id} · Layer {patchMeta?.layer ?? '?'}
                {patchMeta?.peakLayer != null && patchMeta.layer === patchMeta.peakLayer && (
                  <span className="ml-1.5 text-violet-400 text-xs">★ peak</span>
                )}
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-normal ${
                  patchMeta?.direction === 'fn'
                    ? 'bg-emerald-900/40 text-emerald-300'
                    : 'bg-rose-900/40 text-rose-300'
                }`}>
                  {patchMeta?.direction === 'fn' ? 'FN → push resolved' : 'FP → push escalated'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                α = {patchMeta?.alpha} · steering = E[h | resolved] − E[h | escalated], applied at layer {patchMeta?.layer}, rescored via probe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
            title="ESC"
          >
            Close
          </button>
        </div>

        {summary && (
          <div className="flex gap-6 px-6 py-4 bg-violet-950/20 border-b border-violet-500/20">
            <StatBlock label="Avg probe (original)" value={summary.original_mean} />
            <div className="text-violet-400 self-center text-lg">→</div>
            <StatBlock label="Avg probe (patched)" value={summary.patched_mean} highlight />
            {summary.original_mean != null && summary.patched_mean != null && (
              <StatBlock
                label="Δ mean"
                value={summary.patched_mean - summary.original_mean}
                signed
              />
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {turns.map((turn, i) => {
            const scores = scoreByTurn[turn.turn_index]
            return <PatchedTurnBubble key={i} turn={turn} scores={scores} />
          })}
        </div>
      </div>
    </div>
  )
}

function StatBlock({ label, value, highlight, signed }) {
  const formatted = value == null
    ? '—'
    : signed
      ? (value >= 0 ? '+' : '') + (value * 100).toFixed(1) + '%'
      : (value * 100).toFixed(1) + '%'

  const color = signed
    ? value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-slate-400'
    : highlight ? 'text-violet-300' : 'text-slate-200'

  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{formatted}</div>
    </div>
  )
}

function PatchedTurnBubble({ turn, scores }) {
  const isAgent = turn.speaker === 'agent'
  return (
    <div className={`flex flex-col gap-1 ${isAgent ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-slate-500 px-1">
        {isAgent ? 'Agent' : 'Customer'} · turn {turn.turn_index}
      </span>
      <div className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
        isAgent
          ? 'bg-blue-900/30 border border-blue-700/30 text-slate-200'
          : 'bg-slate-800 border border-slate-700 text-slate-300'
      }`}>
        {turn.text}
      </div>
      {isAgent && scores && (
        <div className="flex items-center gap-4 px-1">
          <ScorePair label="orig" value={scores.original_score} color={probeColor(scores.original_score)} />
          <span className="text-violet-400 text-xs">→</span>
          <ScorePair label="patched" value={scores.patched_score} color={probeColor(scores.patched_score)} />
          {scores.delta != null && (
            <span className={`text-xs ${scores.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {scores.delta >= 0 ? '+' : ''}{(scores.delta * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ScorePair({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-xs text-slate-500">
        <span className="text-slate-600">{label} </span>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function probeColor(score) {
  return score > 0.6 ? 'bg-emerald-500' : score > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
}
