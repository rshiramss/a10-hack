import { useState } from 'react'

export default function SteerPanel({ directionMeta, onRun, onClose, running, progress, rightOffset = 520 }) {
  const [alpha, setAlpha] = useState(10.5)
  const norm = directionMeta?.direction_norm ?? 0
  const peakLayer = directionMeta?.peak_layer ?? '—'

  return (
    <div
      className="absolute top-0 h-full w-[360px] bg-slate-950/95 border-l border-slate-800 backdrop-blur-md z-30 flex flex-col"
      style={{ right: rightOffset }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <div className="text-sm font-semibold text-slate-100">Activation Steering</div>
          <div className="text-[10px] text-slate-500">Directional intervention at layer {peakLayer}</div>
        </div>
        <button
          onClick={onClose}
          disabled={running}
          className="text-slate-500 hover:text-slate-300 text-lg leading-none px-1 disabled:opacity-30"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Direction</div>
          <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/50 border border-slate-800 rounded p-3">
            <span className="font-mono text-slate-300">r</span> = <span className="font-mono text-rose-300">E[h | FP]</span> − <span className="font-mono text-emerald-300">E[h | TN]</span>
            <div className="mt-1 text-slate-500 text-[10px]">
              mean hidden state of exploit-fired claims minus mean of resisted claims, at layer {peakLayer}
            </div>
            <div className="mt-2 text-slate-500 text-[10px]">
              ‖r‖ = {norm.toFixed(3)} · dim = {directionMeta?.direction?.length ?? 0}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">α (scalar)</div>
            <div className="text-sm font-mono text-violet-300">{alpha.toFixed(1)}</div>
          </div>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.5}
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            disabled={running}
            className="w-full accent-violet-500"
          />
          <div className="flex justify-between text-[9px] text-slate-600 tabular-nums">
            <span>−10 (toward fired)</span>
            <span>0 (no-op)</span>
            <span>+10 (toward resisted)</span>
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed mt-2 bg-slate-900/50 border border-slate-800 rounded p-2 font-mono">
            x' = x − α·r̂     (at every token, layers ≥ {peakLayer})
          </div>
        </div>

        <button
          onClick={() => onRun(alpha)}
          disabled={running}
          className="w-full px-4 py-2.5 rounded bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium transition"
        >
          {running ? `Steering… ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Steer'}
        </button>

        {progress && (
          <div className="space-y-1">
            <div className="h-1 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${progress.total > 0 ? (100 * progress.done / progress.total) : 0}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-600 text-right tabular-nums">
              {progress.done}/{progress.total} claims
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
