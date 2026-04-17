import { useState } from 'react'

const ARCHETYPES = [
  { value: 'angry_never_satisfied', label: 'Angry — Never Satisfied' },
  { value: 'calm_but_firm', label: 'Calm but Firm' },
  { value: null, label: 'Random (mixed)' },
]

export default function TesterDrawer({ onClose, onGenerate, generating }) {
  const [archetype, setArchetype] = useState(null)
  const [count, setCount] = useState(10)

  function handleRun() {
    onGenerate(count, archetype)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[420px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <span className="text-amber-400 text-sm font-bold">T</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Customer Tester</h2>
              <p className="text-xs text-slate-500">Run synthetic rollouts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Customer Archetype</label>
            <div className="space-y-2">
              {ARCHETYPES.map(a => (
                <label key={String(a.value)} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      archetype === a.value
                        ? 'border-amber-500 bg-amber-500'
                        : 'border-slate-600 group-hover:border-slate-400'
                    }`}
                    onClick={() => setArchetype(a.value)}
                  >
                    {archetype === a.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-slate-300">{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Number of Rollouts</label>
            <input
              type="number"
              min={1}
              max={200}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={handleRun}
            disabled={generating}
            className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {generating ? 'Running…' : `Run ${count} Rollouts`}
          </button>
        </div>
      </div>
    </div>
  )
}
