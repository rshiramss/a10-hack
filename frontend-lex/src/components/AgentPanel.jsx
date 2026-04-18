import { useState } from 'react'
import ConfusionMatrix from './ConfusionMatrix.jsx'
import ClaimList from './ClaimList.jsx'
import ClaimDetail from './ClaimDetail.jsx'

export default function AgentPanel({
  title,
  subtitle,
  claims,
  onOpenSteer,
  onClose,
  showSteerButton = true,
  footer,
  rightOffset = 0,
}) {
  const [selected, setSelected] = useState(null)
  return (
    <div
      className="absolute top-0 h-full w-[520px] bg-slate-950/95 border-l border-slate-800 backdrop-blur-md z-30 flex flex-col"
      style={{ right: rightOffset }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title || 'Claim Adjudicator'}</div>
          {subtitle && <div className="text-[10px] text-slate-500">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {showSteerButton && (
            <button
              onClick={onOpenSteer}
              className="text-xs px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white font-medium transition"
            >
              Steer
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none px-1"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <ConfusionMatrix claims={claims} />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-2">
            Claims ({claims.length})
          </div>
          <ClaimList claims={claims} onSelectClaim={setSelected} />
        </div>
        {footer}
      </div>

      {selected && <ClaimDetail claim={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
