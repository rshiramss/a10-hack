import { useCallback, useEffect, useRef, useState } from 'react'
import Canvas from './components/Canvas.jsx'
import Panel from './components/Panel.jsx'
import AgentDrawer from './components/AgentDrawer.jsx'
import TesterDrawer from './components/TesterDrawer.jsx'
import { generateRollouts, getRollout, getLayerCurve, listRollouts, patchLayer, trainProbe } from './api.js'

const POLL_MS = 4000

export default function App() {
  const [rollouts, setRollouts] = useState([])
  const [view, setView] = useState('runsTable')
  const [selectedRolloutId, setSelectedRolloutId] = useState(null)
  const [selectedRollout, setSelectedRollout] = useState(null)
  const [layers, setLayers] = useState([])
  const [peakLayer, setPeakLayer] = useState(null)
  const [patchData, setPatchData] = useState(null)
  const [probeReady, setProbeReady] = useState(false)
  const [trainingProbe, setTrainingProbe] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [testerOpen, setTesterOpen] = useState(false)
  const pollRef = useRef(null)

  // Load rollouts + layer curve
  async function refresh() {
    try {
      const [{ items }, curveRes] = await Promise.all([
        listRollouts(100),
        getLayerCurve().catch(() => ({ items: [] })),
      ])
      setRollouts(items)
      const curve = curveRes.items ?? []
      setLayers(curve)
      setProbeReady(curve.length > 0)
      if (curve.length > 0) {
        const peak = curve.reduce((best, l) => l.auc > best.auc ? l : best, curve[0])
        setPeakLayer(peak.layer)
      }
    } catch (_) {}
  }

  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [])

  const selectRollout = useCallback(async (id, targetView = 'singleRun') => {
    setSelectedRolloutId(id)
    setView(targetView)
    try {
      const detail = await getRollout(id)
      setSelectedRollout(detail)
    } catch (_) {}
  }, [])

  const goBack = useCallback(() => {
    setView(prev => {
      if (prev === 'patchedRun') return 'probeStats'
      if (prev === 'probeStats') return 'singleRun'
      if (prev === 'singleRun') return 'runsTable'
      return 'runsTable'
    })
  }, [])

  async function handleTrainProbe() {
    setTrainingProbe(true)
    try {
      await trainProbe()
      await refresh()
    } finally {
      setTrainingProbe(false)
    }
  }

  async function handleGenerate(n, archetype) {
    setTesterOpen(false)
    setGenerating(true)
    try {
      await generateRollouts(n, archetype)
      await refresh()
    } finally {
      setGenerating(false)
    }
  }

  async function handlePatch(layerIdx, direction) {
    if (!selectedRolloutId) return
    const result = await patchLayer(selectedRolloutId, layerIdx, direction)
    setPatchData(result)
    setView('patchedRun')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <Canvas
        onOpenAgent={() => setAgentOpen(true)}
        onOpenTester={() => setTesterOpen(true)}
      />

      <Panel
        view={view}
        rollouts={rollouts}
        selectedRollout={selectedRollout}
        layers={layers}
        peakLayer={peakLayer}
        patchData={patchData}
        probeReady={probeReady}
        trainingProbe={trainingProbe}
        onSelectRollout={selectRollout}
        onBack={goBack}
        onTrainProbe={handleTrainProbe}
        onPatch={handlePatch}
      />

      {generating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-900/80 border border-amber-700 rounded-lg px-4 py-2 text-xs text-amber-200 backdrop-blur">
          Generating rollouts…
        </div>
      )}

      {agentOpen && <AgentDrawer onClose={() => setAgentOpen(false)} />}
      {testerOpen && (
        <TesterDrawer
          onClose={() => setTesterOpen(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}
    </div>
  )
}
