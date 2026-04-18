import { useEffect } from 'react'
import RunsTable from './RunsTable.jsx'
import SingleRun from './SingleRun.jsx'
import ProbeStats from './ProbeStats.jsx'

export default function Panel({
  view,
  rollouts,
  selectedRollout,
  selectedRolloutId,
  layers,
  peakLayer,
  probeReady,
  trainingProbe,
  onSelectRollout,
  onOpenProbeStats,
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
        <RunsTable
          rollouts={rollouts}
          onSelect={onSelectRollout}
          probeReady={probeReady}
          onOpenProbeStats={onOpenProbeStats}
          onTrainProbe={onTrainProbe}
          trainingProbe={trainingProbe}
        />
      )}
      {view === 'singleRun' && (
        <SingleRun
          rollout={selectedRollout}
          probeReady={probeReady}
          onBack={onBack}
          onTrainProbe={onTrainProbe}
          onOpenPatch={() => onSelectRollout(selectedRollout?.id, 'probeStats')}
        />
      )}
      {(view === 'probeStats' || view === 'patchedRun') && (
        <ProbeStats
          layers={layers}
          peakLayer={peakLayer}
          rolloutCount={rollouts.length}
          onBack={onBack}
          onPatch={onPatch}
          canPatch={Boolean(selectedRolloutId)}
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
