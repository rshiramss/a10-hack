import { useEffect, useRef, useState } from 'react'
import Canvas from './components/Canvas.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import SteerPanel from './components/SteerPanel.jsx'
import { runLiveSteering } from './steer.js'

export default function App() {
  const [claims, setClaims] = useState([])
  const [directionMeta, setDirectionMeta] = useState(null)
  const [loadErr, setLoadErr] = useState(null)

  const [agentOpen, setAgentOpen] = useState(false)
  const [steerOpen, setSteerOpen] = useState(false)

  const [steeredClaims, setSteeredClaims] = useState(null)
  const [steerAlpha, setSteerAlpha] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/claims.json').then((r) => r.json()),
      fetch('/direction.json').then((r) => r.json()),
    ])
      .then(([c, d]) => {
        setClaims(c)
        setDirectionMeta(d)
      })
      .catch((e) => setLoadErr(String(e)))
  }, [])

  async function handleRunSteer(alpha) {
    if (!directionMeta) return
    setRunning(true)
    setSteerAlpha(alpha)
    setProgress({ done: 0, total: claims.filter((c) => c.is_injected).length })
    setSteeredClaims(claims.map((c) => (c.is_injected ? { ...c, verdict: '…', justification: null } : c)))

    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await runLiveSteering({
        claims,
        systemPrompt: directionMeta.system_prompt,
        direction: directionMeta.direction,
        fromLayer: directionMeta.peak_layer,
        alpha,
        batchSize: 6,
        signal: ctrl.signal,
        onProgress: ({ done, total, claims: live }) => {
          setProgress({ done, total })
          setSteeredClaims(live)
        },
      })
    } catch (e) {
      console.error('steering failed', e)
    } finally {
      setRunning(false)
    }
  }

  function closeSteer() {
    if (running && abortRef.current) abortRef.current.abort()
    setSteerOpen(false)
    setSteeredClaims(null)
    setSteerAlpha(null)
    setProgress(null)
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950">
      <Canvas onOpenNode={() => setAgentOpen(true)} />

      {loadErr && (
        <div className="absolute top-4 right-4 z-50 rounded border border-rose-700 bg-rose-950/80 px-3 py-2 text-xs text-rose-200">
          Failed to load claims.json / direction.json — did you run <code>scripts/export_frontend_data.py</code>?
        </div>
      )}

      {agentOpen && (
        <AgentPanel
          title="Claim Adjudicator"
          subtitle={`Qwen 2.5 7B · ${claims.length} claims · peak probe layer ${directionMeta?.peak_layer ?? '—'}`}
          claims={claims}
          onOpenSteer={() => setSteerOpen(true)}
          onClose={() => {
            setAgentOpen(false)
            closeSteer()
          }}
        />
      )}

      {agentOpen && steeredClaims && (
        <AgentPanel
          title={`Steered · α=${steerAlpha?.toFixed(1)}`}
          subtitle={
            running
              ? `Live intervention · ${progress?.done ?? 0}/${progress?.total ?? 0}`
              : 'Post-steer verdicts'
          }
          claims={steeredClaims}
          showSteerButton={false}
          rightOffset={520}
          onClose={() => {
            setSteeredClaims(null)
            setSteerAlpha(null)
            setProgress(null)
          }}
        />
      )}

      {agentOpen && steerOpen && (
        <SteerPanel
          directionMeta={directionMeta}
          onRun={handleRunSteer}
          onClose={closeSteer}
          running={running}
          progress={progress}
          rightOffset={steeredClaims ? 1040 : 520}
        />
      )}
    </div>
  )
}
