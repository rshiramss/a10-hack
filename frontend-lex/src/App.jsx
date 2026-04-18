import { useCallback, useEffect, useRef, useState } from 'react'
import Canvas from './components/Canvas.jsx'
import Panel from './components/Panel.jsx'
import NodeConfigDrawer from './components/NodeConfigDrawer.jsx'
import TesterDrawer from './components/TesterDrawer.jsx'
import PatchedRun from './components/PatchedRun.jsx'
import { generateRollouts, getRollout, getLayerCurve, listRollouts, patchLayer, trainProbe } from './api.js'

const POLL_MS = 4000
const INITIAL_BUILDER_CONFIGS = {
  customer: {
    llm: 'Qwen2.5-3B-Instruct',
    systemPrompt:
      'You are a synthetic angry customer. Stay adversarial, press for specifics, and only concede after a concrete remediation plan appears.',
  },
  agent: {
    llm: 'Qwen2.5-7B-Instruct',
    systemPrompt:
      'You are a professional customer support agent. Resolve the issue, stay calm, and reach for tools when they improve confidence.',
  },
  mcp: {
    endpoint: 'https://mcp.internal/v1/orders',
    systemPromptExcerpt:
      'lookup_order(order_id) returns order state, shipping context, replacement eligibility, and relevant internal notes.',
  },
}

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
  const [activeNodeId, setActiveNodeId] = useState(null)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [builderConfigs, setBuilderConfigs] = useState(INITIAL_BUILDER_CONFIGS)
  const pollRef = useRef(null)

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
        const peak = curve.reduce((best, layer) => (layer.auc > best.auc ? layer : best), curve[0])
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
    setView((current) => {
      if (current === 'patchedRun') return selectedRolloutId ? 'singleRun' : 'runsTable'
      if (current === 'probeStats') return selectedRolloutId ? 'singleRun' : 'runsTable'
      if (current === 'singleRun') return 'runsTable'
      return 'runsTable'
    })
  }, [selectedRolloutId])

  const openProbeStats = useCallback(() => {
    setSelectedRolloutId(null)
    setSelectedRollout(null)
    setView('probeStats')
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
    setLauncherOpen(false)
    setGenerating(true)
    try {
      await generateRollouts(n, archetype)
      await refresh()
    } finally {
      setGenerating(false)
    }
  }

  async function handlePatch(layerIdx, direction) {
    if (!selectedRolloutId) {
      alert('Pick a rollout first (Runs → row → Patch →).')
      return
    }
    try {
      const result = await patchLayer(selectedRolloutId, layerIdx, direction)
      setPatchData(result)
      setView('patchedRun')
    } catch (e) {
      console.error('Patch failed', e)
      alert(`Patch failed: ${e?.message || e}`)
    }
  }

  const closePatched = useCallback(() => {
    setPatchData(null)
    setView(selectedRolloutId ? 'singleRun' : 'runsTable')
  }, [selectedRolloutId])

  useEffect(() => {
    if (view !== 'patchedRun') return
    function onKey(e) {
      if (e.key === 'Escape') closePatched()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, closePatched])

  const updateBuilderConfig = useCallback((nodeId, field, value) => {
    setBuilderConfigs((current) => ({
      ...current,
      [nodeId]: {
        ...current[nodeId],
        [field]: value,
      },
    }))
  }, [])

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <Canvas
        activeNodeId={activeNodeId}
        configs={builderConfigs}
        onOpenNode={setActiveNodeId}
      />

      <Panel
        view={view}
        rollouts={rollouts}
        selectedRollout={selectedRollout}
        selectedRolloutId={selectedRolloutId}
        layers={layers}
        peakLayer={peakLayer}
        patchData={patchData}
        probeReady={probeReady}
        trainingProbe={trainingProbe}
        generating={generating}
        onSelectRollout={selectRollout}
        onOpenProbeStats={openProbeStats}
        onBack={goBack}
        onTrainProbe={handleTrainProbe}
        onPatch={handlePatch}
        onOpenGenerator={() => setLauncherOpen(true)}
      />

      {generating && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-amber-700 bg-amber-900/80 px-4 py-2 text-xs text-amber-200 backdrop-blur">
          Generating rollouts…
        </div>
      )}

      {activeNodeId && (
        <NodeConfigDrawer
          nodeId={activeNodeId}
          config={builderConfigs[activeNodeId]}
          onChange={updateBuilderConfig}
          onClose={() => setActiveNodeId(null)}
        />
      )}

      {launcherOpen && (
        <TesterDrawer
          onClose={() => setLauncherOpen(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

      {view === 'patchedRun' && patchData && (
        <PatchedRun
          rollout={selectedRollout}
          patchData={patchData}
          onClose={closePatched}
        />
      )}
    </div>
  )
}
