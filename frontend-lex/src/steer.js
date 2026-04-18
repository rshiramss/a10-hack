// Live steering: iterate the 32 DENY+INJECT claims (or any subset), call Modal
// ablate_and_generate per claim in parallel batches, stream verdicts back via
// an onProgress callback so the UI can render each row as it arrives.
//
// Non-injected claims are assumed α-invariant and passed through unchanged;
// that holds empirically (flash-attention + in-place hook = deterministic on
// non-injected inputs) and saves demo time.

const STEER_URL = '/api/steer'

function parseVerdict(raw) {
  if (!raw) return { verdict: null, justification: null }
  // Try strict JSON object
  const m = raw.match(/\{[\s\S]*?\}/)
  if (m) {
    try {
      const obj = JSON.parse(m[0])
      const v = (obj.verdict || '').toUpperCase()
      if (v === 'APPROVED' || v === 'DENIED') {
        return { verdict: v, justification: obj.justification || null }
      }
    } catch (_) {}
  }
  // Fallback: keyword scan
  const up = raw.toUpperCase()
  if (up.includes('APPROVED')) return { verdict: 'APPROVED', justification: raw.slice(0, 200) }
  if (up.includes('DENIED')) return { verdict: 'DENIED', justification: raw.slice(0, 200) }
  return { verdict: null, justification: raw.slice(0, 200) }
}

async function steerOne({ claim, systemPrompt, direction, fromLayer, alpha, signal }) {
  const res = await fetch(STEER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      user: claim.narrative,
      direction,
      from_layer: fromLayer,
      alpha,
      max_new_tokens: 300,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Steer failed for ${claim.claim_id}: ${res.status}`)
  const body = await res.json()
  const parsed = parseVerdict(body.response)
  return { ...claim, verdict: parsed.verdict, justification: parsed.justification, probe_prob: null }
}

export async function runLiveSteering({
  claims,
  systemPrompt,
  direction,
  fromLayer,
  alpha,
  batchSize = 6,
  onProgress,
  signal,
}) {
  // Only injected-deny claims need re-running; clean rows pass through.
  const targets = claims.filter((c) => c.is_injected)
  const passthrough = claims.filter((c) => !c.is_injected)

  const results = new Map()
  let done = 0
  const total = targets.length

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize)
    const settled = await Promise.allSettled(
      batch.map((c) =>
        steerOne({ claim: c, systemPrompt, direction, fromLayer, alpha, signal })
      )
    )
    settled.forEach((s, idx) => {
      const claim = batch[idx]
      if (s.status === 'fulfilled') {
        results.set(claim.claim_id, s.value)
      } else {
        results.set(claim.claim_id, { ...claim, verdict: null, justification: `error: ${s.reason}` })
      }
      done++
    })
    if (onProgress) {
      const interleaved = [
        ...passthrough,
        ...targets.map((c) => results.get(c.claim_id) ?? { ...c, verdict: '…', justification: null, probe_prob: null }),
      ]
      onProgress({ done, total, claims: interleaved })
    }
  }

  const final = [
    ...passthrough,
    ...targets.map((c) => results.get(c.claim_id) ?? c),
  ]
  return final
}
