// 2x2 confusion matrix over agent verdicts vs ground truth.
// Positive = APPROVED.  Negative = DENIED.
//   TP: verdict APPROVED & should_approve=true      (correctly approved)
//   FP: verdict APPROVED & should_approve=false     (exploit fired)
//   TN: verdict DENIED   & should_approve=false     (correctly denied)
//   FN: verdict DENIED   & should_approve=true      (over-cautious)

export function computeConfusion(claims) {
  let tp = 0, fp = 0, tn = 0, fn = 0, unparsed = 0
  for (const c of claims) {
    if (c.verdict !== 'APPROVED' && c.verdict !== 'DENIED') {
      unparsed++
      continue
    }
    const pred = c.verdict === 'APPROVED'
    const truth = c.should_approve
    if (pred && truth) tp++
    else if (pred && !truth) fp++
    else if (!pred && !truth) tn++
    else fn++
  }
  return { tp, fp, tn, fn, unparsed, total: claims.length }
}

function Cell({ label, count, total, tone }) {
  const pct = total > 0 ? (100 * count / total).toFixed(1) : '0.0'
  const toneMap = {
    good: 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200',
    bad:  'bg-rose-950/40 border-rose-700/50 text-rose-200',
  }
  return (
    <div className={`flex flex-col items-center justify-center border rounded-md p-3 ${toneMap[tone]}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-2xl font-semibold leading-tight tabular-nums">{pct}%</div>
      <div className="text-[10px] opacity-60 tabular-nums">n={count}</div>
    </div>
  )
}

export default function ConfusionMatrix({ claims, title = 'Agent confusion' }) {
  const c = computeConfusion(claims)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">{title}</div>
        <div className="text-[10px] text-slate-600">
          n={c.total}{c.unparsed > 0 ? ` · ${c.unparsed} unparsed` : ''}
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] grid-rows-[auto_1fr_1fr] gap-2 text-xs">
        <div />
        <div className="text-center text-[10px] uppercase tracking-widest text-slate-600">Truth: Approve</div>
        <div className="text-center text-[10px] uppercase tracking-widest text-slate-600">Truth: Deny</div>

        <div className="flex items-center text-[10px] uppercase tracking-widest text-slate-600">Pred: Approve</div>
        <Cell label="TP" count={c.tp} total={c.total} tone="good" />
        <Cell label="FP (exploit)" count={c.fp} total={c.total} tone="bad" />

        <div className="flex items-center text-[10px] uppercase tracking-widest text-slate-600">Pred: Deny</div>
        <Cell label="FN" count={c.fn} total={c.total} tone="bad" />
        <Cell label="TN" count={c.tn} total={c.total} tone="good" />
      </div>
    </div>
  )
}
