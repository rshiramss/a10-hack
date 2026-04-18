import { useEffect } from 'react'

function Field({ label, children, mono }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-1">{label}</div>
      <div className={`text-xs text-slate-200 ${mono ? 'font-mono' : ''}`}>{children}</div>
    </div>
  )
}

function Pill({ tone, children }) {
  const map = {
    good: 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300',
    bad:  'bg-rose-950/40 border-rose-700/40 text-rose-300',
    neutral: 'bg-slate-800 border-slate-700 text-slate-300',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-widest border ${map[tone] || map.neutral}`}>
      {children}
    </span>
  )
}

export default function ClaimDetail({ claim, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!claim) return null
  const predicted = claim.verdict === 'APPROVED'
  const truth = claim.should_approve
  const correct = (predicted === truth)
  const amountFmt = claim.amount_requested != null ? `$${claim.amount_requested.toLocaleString()}` : '—'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[85vh] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-200">{claim.claim_id}</span>
            <Pill tone={claim.is_injected ? 'bad' : 'neutral'}>
              {claim.is_injected ? 'inject' : 'clean'}
            </Pill>
            <Pill tone="neutral">gt: {claim.should_approve ? 'approve' : 'deny'}</Pill>
            {claim.verdict && (
              <Pill tone={correct ? 'good' : 'bad'}>
                verdict: {claim.verdict === 'APPROVED' ? 'approve' : 'deny'}
              </Pill>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Field label="Claimant">{claim.claimant_name || '—'}</Field>
            <Field label="Business">{claim.business_name || '—'}</Field>
            <Field label="Amount">{amountFmt}</Field>
            <Field label="Cause of loss">{claim.cause_of_loss || '—'}</Field>
            <Field label="Violated rule">{claim.violated_rule || '—'}</Field>
            <Field label="Probe prob">
              {claim.probe_prob == null ? '—' : `${(100 * claim.probe_prob).toFixed(1)}%`}
            </Field>
          </div>

          <Field label="Narrative (user message)">
            <div className="bg-slate-900/60 border border-slate-800 rounded p-3 whitespace-pre-wrap text-slate-300 leading-relaxed">
              {claim.narrative}
            </div>
          </Field>

          <Field label="Agent justification">
            <div className="bg-slate-900/60 border border-slate-800 rounded p-3 whitespace-pre-wrap text-slate-300 leading-relaxed">
              {claim.justification || <span className="text-slate-600">No justification parsed.</span>}
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}
