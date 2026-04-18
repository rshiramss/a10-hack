function ProbeBar({ prob }) {
  if (prob == null) return <div className="w-16 h-1.5 rounded bg-slate-800" />
  const pct = Math.round(prob * 100)
  const hue = prob > 0.5 ? 'bg-rose-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded bg-slate-800 overflow-hidden">
        <div className={`h-full ${hue}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-slate-500 w-7">{pct}%</span>
    </div>
  )
}

function VariantPill({ variant, is_injected }) {
  if (is_injected) {
    return <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest bg-rose-950/40 border border-rose-700/40 text-rose-300">inject</span>
  }
  return <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest bg-slate-800 border border-slate-700 text-slate-400">clean</span>
}

function VerdictPill({ verdict, should_approve }) {
  if (!verdict) return <span className="text-[10px] text-slate-600">—</span>
  const correct = (verdict === 'APPROVED') === should_approve
  const tone = correct
    ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300'
    : 'bg-rose-950/40 border-rose-700/40 text-rose-300'
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest border ${tone}`}>
      {verdict === 'APPROVED' ? 'approve' : 'deny'}
    </span>
  )
}

function ClaimRow({ claim, onClick }) {
  return (
    <div
      onClick={() => onClick?.(claim)}
      className="flex items-center gap-3 px-3 py-2 border-b border-slate-900 text-xs hover:bg-slate-900/60 cursor-pointer"
    >
      <div className="w-20 font-mono text-slate-500 truncate">{claim.claim_id}</div>
      <VariantPill variant={claim.variant} is_injected={claim.is_injected} />
      <div className="w-16 text-[10px] text-slate-500">
        gt: <span className="text-slate-300">{claim.should_approve ? 'approve' : 'deny'}</span>
      </div>
      <VerdictPill verdict={claim.verdict} should_approve={claim.should_approve} />
      <div className="flex-1" />
      <ProbeBar prob={claim.probe_prob} />
    </div>
  )
}

export default function ClaimList({ claims, emptyHint, onSelectClaim }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="flex items-center justify-center text-[11px] text-slate-600 p-6 border border-dashed border-slate-800 rounded">
        {emptyHint || 'No claims'}
      </div>
    )
  }
  return (
    <div className="border border-slate-800 rounded bg-slate-950/60 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 text-[9px] uppercase tracking-widest text-slate-500 font-medium">
        <div className="w-20">Claim</div>
        <div className="w-14">Variant</div>
        <div className="w-16">Truth</div>
        <div className="w-16">Verdict</div>
        <div className="flex-1" />
        <div>Probe</div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {claims.map((c) => (
          <ClaimRow key={`${c.claim_id}-${c.variant}`} claim={c} onClick={onSelectClaim} />
        ))}
      </div>
    </div>
  )
}
