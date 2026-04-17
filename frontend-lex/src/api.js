const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(err.detail || r.statusText)
  }
  return r.json()
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}

export const listRollouts = (limit = 100) => get(`/rollouts?limit=${limit}`)
export const getRollout = (id) => get(`/rollouts/${id}`)
export const generateRollouts = (n, archetype) =>
  post('/rollouts/generate', { n_rollouts: n, archetype: archetype || null })
export const trainProbe = () => post('/probe/train', {})
export const getLayerCurve = () => get('/probe/layer_curve')
export const patchLayer = (rollout_id, layer_idx, direction, alpha = 1.0) =>
  post('/steer/patch/layer', { rollout_id, layer_idx, direction, alpha })
