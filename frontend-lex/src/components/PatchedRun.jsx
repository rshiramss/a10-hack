export default function PatchedRun({ rollout, patchData, onBack }) {
  const turns = rollout?.turns || []
  const patchMeta = patchData
    ? { layer: patchData.layer_idx, direction: patchData.direction, alpha: patchData.alpha }
    : null

  const scoreByTurn = {}
  if (patchData?.turn_scores) {
    for (const ts of patchData.turn_scores) {
      scoreByTurn[ts.turn_index] = ts
    }
  }

  const summary = patchData?.summary

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">
            Patched Run — Layer {patchMeta?.layer ?? '?'}
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-normal ${
              patchMeta?.direction === 'fn'
                ? 'bg-emerald-900/40 text-emerald-300'
                : 'bg-rose-900/40 text-rose-300'
            }`}>
              {patchMeta?.direction === 'fn' ? 'FN → push resolved' : 'FP → push escalated'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">α = {patchMeta?.alpha} · Rollout #{rollout?.id}</p>
        </div>
      </div>

      {summary && (
        <div className="flex gap-4 px-5 py-3 bg-slate-900/60 border-b border-slate-800">
          <StatBlock label="Avg probe (original)" value={summary.original_mean} />
          <div className="text-slate-600 self-center">→</div>
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

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {turns.map((turn, i) => {
          const scores = scoreByTurn[turn.turn_index]
          return <PatchedTurnBubble key={i} turn={turn} scores={scores} />
        })}
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
      <div className={`text-sm font-semibold ${color}`}>{formatted}</div>
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
          <ScorePair
            label="orig"
            value={scores.original_score}
            color={probeColor(scores.original_score)}
          />
          <span className="text-slate-600 text-xs">→</span>
          <ScorePair
            label="patched"
            value={scores.patched_score}
            color={probeColor(scores.patched_score)}
          />
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
