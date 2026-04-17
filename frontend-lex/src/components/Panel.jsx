import { useEffect } from 'react'
import RunsTable from './RunsTable.jsx'
import SingleRun from './SingleRun.jsx'
import ProbeStats from './ProbeStats.jsx'
import PatchedRun from './PatchedRun.jsx'

export default function Panel({
  view,
  rollouts,
  selectedRollout,
  layers,
  peakLayer,
  patchData,
  probeReady,
  trainingProbe,
  onSelectRollout,
  onBack,
  onTrainProbe,
  onPatch,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="w-[520px] flex-shrink-0 h-full border-l border-slate-800 bg-slate-950 flex flex-col">
      {view === 'runsTable' && (
        <RunsTable rollouts={rollouts} onSelect={onSelectRollout} />
      )}
      {view === 'singleRun' && (
        <SingleRun
          rollout={selectedRollout}
          probeReady={probeReady}
          onBack={onBack}
          onTrainProbe={onTrainProbe}
          onOpenProbeStats={() => onSelectRollout(selectedRollout?.id, 'probeStats')}
        />
      )}
      {view === 'probeStats' && (
        <ProbeStats
          layers={layers}
          peakLayer={peakLayer}
          onBack={onBack}
          onPatch={onPatch}
        />
      )}
      {view === 'patchedRun' && (
        <PatchedRun
          rollout={selectedRollout}
          patchData={patchData}
          onBack={onBack}
        />
      )}

      {trainingProbe && (
        <div className="absolute bottom-4 right-4 bg-violet-900/80 border border-violet-700 rounded-lg px-4 py-2 text-xs text-violet-200 backdrop-blur">
          Training probe…
        </div>
      )}
    </div>
  )
}
