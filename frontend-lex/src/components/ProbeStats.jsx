import { useState } from 'react'

function pct(v) {
  if (v == null) return '—'
  return (v * 100).toFixed(1) + '%'
}

export default function ProbeStats({
  layers,
  peakLayer,
  rolloutCount,
  onBack,
  onPatch,
  patching,
  canPatch,
}) {
  const [patchingLayer, setPatchingLayer] = useState(null)

  function handlePatch(layerIdx, direction) {
    if (!onPatch) return
    setPatchingLayer(`${layerIdx}-${direction}`)
    onPatch(layerIdx, direction).finally(() => setPatchingLayer(null))
  }

  const peak = layers.find(l => l.layer === peakLayer) ?? null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Probe Statistics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Global · over {rolloutCount ?? '—'} rollout{rolloutCount === 1 ? '' : 's'} · peak layer {peakLayer ?? '—'} · {layers.length} layers
          </p>
        </div>
      </div>

      {layers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No probe data. Train the probe first.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {peak && (
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">
                Peak layer {peak.layer} · global metrics
              </div>
              <div className="grid grid-cols-5 gap-2">
                <MetricTile label="AUC" value={peak.auc} accent="violet" />
                <MetricTile label="Accuracy" value={peak.accuracy} />
                <MetricTile label="Precision" value={peak.precision} />
                <MetricTile label="Recall" value={peak.recall} />
                <MetricTile label="F1" value={peak.f1} />
              </div>
            </div>
          )}

          <div className="px-5 pt-4 pb-2 text-xs uppercase tracking-wide text-slate-500">
            Per-layer breakdown
          </div>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
              <tr>
                <Th>Layer</Th>
                <Th>Acc</Th>
                <Th>AUC</Th>
                <Th>Prec</Th>
                <Th>Rec</Th>
                <Th>F1</Th>
                {canPatch && <Th>Patch</Th>}
              </tr>
            </thead>
            <tbody>
              {layers.map(l => {
                const isPeak = l.layer === peakLayer
                return (
                  <tr
                    key={l.layer}
                    className={`border-b border-slate-800/50 ${isPeak ? 'bg-violet-900/20' : 'hover:bg-slate-800/30'}`}
                  >
                    <td className="px-3 py-2.5 font-mono text-slate-300">
                      {l.layer}
                      {isPeak && (
                        <span className="ml-1.5 text-violet-400 text-xs">★</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{pct(l.accuracy)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{pct(l.auc)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{pct(l.precision)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{pct(l.recall)}</td>
                    <td className="px-3 py-2.5">
                      <F1Bar value={l.f1} />
                    </td>
                    {canPatch && (
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <PatchBtn
                            label="FN"
                            color="emerald"
                            loading={patchingLayer === `${l.layer}-fn`}
                            onClick={() => handlePatch(l.layer, 'fn')}
                            title="Push toward resolution (mean_resolved − mean_escalated)"
                          />
                          <PatchBtn
                            label="FP"
                            color="rose"
                            loading={patchingLayer === `${l.layer}-fp`}
                            onClick={() => handlePatch(l.layer, 'fp')}
                            title="Push toward escalation (inverse)"
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MetricTile({ label, value, accent }) {
  const tone = accent === 'violet' ? 'text-violet-300' : 'text-slate-100'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{pct(value)}</div>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{children}</th>
}

function F1Bar({ value }) {
  if (value == null) return <span className="text-slate-600">—</span>
  const p = Math.round(value * 100)
  const color = p > 70 ? 'bg-emerald-500' : p > 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-slate-300 w-8">{p}%</span>
    </div>
  )
}

function PatchBtn({ label, color, loading, onClick, title }) {
  const cls = color === 'emerald'
    ? 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/30'
    : 'border-rose-700/50 text-rose-400 hover:bg-rose-900/30'
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors disabled:opacity-40 ${cls}`}
    >
      {loading ? '…' : label}
    </button>
  )
}
