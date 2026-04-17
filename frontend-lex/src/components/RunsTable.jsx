const OUTCOME_STYLE = {
  resolved: 'text-emerald-400 bg-emerald-400/10',
  escalated: 'text-rose-400 bg-rose-400/10',
}

function fmt(val) {
  if (val == null) return '—'
  return (val * 100).toFixed(0) + '%'
}

export default function RunsTable({ rollouts, onSelect }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Parallel Customers</h2>
          <p className="text-xs text-slate-500 mt-0.5">{rollouts.length} rollout{rollouts.length !== 1 ? 's' : ''} · click to inspect</p>
        </div>
        <div className="flex gap-2">
          <Pill label={rollouts.filter(r => r.outcome === 'resolved').length} color="emerald" text="resolved" />
          <Pill label={rollouts.filter(r => r.outcome === 'escalated').length} color="rose" text="escalated" />
        </div>
      </div>

      {rollouts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No rollouts yet — click the Tester node to generate some.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
              <tr>
                <Th>ID</Th>
                <Th>Archetype</Th>
                <Th>Issue</Th>
                <Th>Outcome</Th>
                <Th>Probe</Th>
                <Th>Turns</Th>
              </tr>
            </thead>
            <tbody>
              {rollouts.map(r => (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-400 font-mono">#{r.id}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.archetype ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        r.archetype === 'angry_never_satisfied'
                          ? 'bg-rose-900/40 text-rose-300'
                          : 'bg-blue-900/40 text-blue-300'
                      }`}>
                        {r.archetype === 'angry_never_satisfied' ? 'Angry' : 'Calm'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{r.issue_type?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${OUTCOME_STYLE[r.outcome] || 'text-slate-400'}`}>
                      {r.outcome || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProbeBar score={r.final_probe_score} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.turns_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{children}</th>
}

function Pill({ label, color, text }) {
  const cls = color === 'emerald'
    ? 'bg-emerald-400/10 text-emerald-400'
    : 'bg-rose-400/10 text-rose-400'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label} {text}
    </span>
  )
}

function ProbeBar({ score }) {
  if (score == null) return <span className="text-slate-600">—</span>
  const pct = Math.round(score * 100)
  const color = score > 0.6 ? 'bg-emerald-500' : score > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-400 w-7 text-right">{pct}%</span>
    </div>
  )
}
