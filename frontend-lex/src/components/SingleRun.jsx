export default function SingleRun({ rollout, probeReady, onBack, onTrainProbe, onOpenProbeStats }) {
  const turns = rollout?.turns || []
  const agentTurns = turns.filter(t => t.speaker === 'agent')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-300 transition-colors" title="ESC">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 truncate">
            Rollout #{rollout?.id}
            {rollout?.archetype && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-normal ${
                rollout.archetype === 'angry_never_satisfied'
                  ? 'bg-rose-900/40 text-rose-300'
                  : 'bg-blue-900/40 text-blue-300'
              }`}>
                {rollout.archetype === 'angry_never_satisfied' ? 'Angry' : 'Calm'}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {rollout?.issue_type?.replace(/_/g, ' ')} ·{' '}
            <span className={rollout?.outcome === 'resolved' ? 'text-emerald-400' : 'text-rose-400'}>
              {rollout?.outcome}
            </span>
          </p>
        </div>
        <div className="flex-shrink-0">
          {probeReady ? (
            <button
              onClick={onOpenProbeStats}
              className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
            >
              Probe Statistics →
            </button>
          ) : (
            <button
              onClick={onTrainProbe}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
            >
              Train Probe
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {turns.map((turn, i) => (
          <TurnBubble key={i} turn={turn} />
        ))}
      </div>
    </div>
  )
}

function TurnBubble({ turn }) {
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
      {isAgent && turn.probe_score != null && (
        <div className="flex items-center gap-2 px-1">
          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                turn.probe_score > 0.6 ? 'bg-emerald-500' : turn.probe_score > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${turn.probe_score * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            probe {(turn.probe_score * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}
