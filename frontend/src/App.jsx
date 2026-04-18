import { useEffect, useMemo, useState } from "react";
import NodeGraph from "./components/NodeGraph";
import ProbeMonitor from "./components/ProbeMonitor";
import SidePanel from "./components/SidePanel";
import AgentBuilder from "./components/AgentBuilder";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return response.json();
}

export default function App() {
  const [activeTab, setActiveTab] = useState("control");
  const [rollouts, setRollouts] = useState([]);
  const [selectedRolloutId, setSelectedRolloutId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState("agent");
  const [dashboard, setDashboard] = useState({
    curve: [],
    outcomes: { resolved: 0, escalated: 0 },
    live_feed: [],
    false_positives: [],
    turn_metrics: [],
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [rolloutPayload, dashboardPayload, turnMetricsPayload] = await Promise.all([
        getJson("/rollouts?limit=1000"),
        getJson("/probe/dashboard").catch(() => ({
          curve: [],
          outcomes: { resolved: 0, escalated: 0 },
          live_feed: [],
          false_positives: [],
          probe_ready: false,
        })),
        getJson("/probe/turn_metrics").catch(() => ({ items: [] })),
      ]);
      if (!mounted) {
        return;
      }
      setRollouts(rolloutPayload.items);
      setDashboard({ ...dashboardPayload, turn_metrics: turnMetricsPayload.items ?? [] });
      setSelectedRolloutId((current) => current ?? rolloutPayload.items[0]?.id ?? null);
    }

    load().catch(console.error);
    const timer = window.setInterval(() => load().catch(console.error), 8000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const selectedRollout = useMemo(
    () => rollouts.find((rollout) => rollout.id === selectedRolloutId) ?? null,
    [rollouts, selectedRolloutId]
  );

  return (
    <div className="relative min-h-screen overflow-hidden text-mist">
      <div className="orb left-[-120px] top-[80px] h-72 w-72 bg-slateblue/30" />
      <div className="orb right-[6%] top-[12%] h-64 w-64 bg-mint/20" />
      <div className="orb bottom-[10%] left-[42%] h-72 w-72 bg-ember/10" />
      <div className="pointer-events-none absolute inset-0 bg-control-grid bg-[length:48px_48px] opacity-30" />

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="mesh-panel scanline rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.82)] p-6 shadow-panel backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-signal/20 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.38em] text-signal">
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_16px_rgba(24,231,178,0.9)]" />
                MI Agent Framework
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white md:text-5xl">
                Counterfactual support ops with a live mechanistic control room
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Fixed workflow topology, synthetic rollout storage, probe-layer monitoring, and
                counterfactual patch inspection in one local surface.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <MetricCard label="Resolved" value={dashboard.outcomes.resolved} tone="mint" />
              <MetricCard label="Escalated" value={dashboard.outcomes.escalated} tone="ember" />
              <MetricCard label="False Positives" value={dashboard.false_positives.length} tone="slateblue" />
              <MetricCard label="Tracked Turns" value={dashboard.live_feed.length} tone="ink" />
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-3">
          <TabButton active={activeTab === "control"} onClick={() => setActiveTab("control")}>
            Control Room
          </TabButton>
          <TabButton active={activeTab === "monitor"} onClick={() => setActiveTab("monitor")}>
            Probe Monitor
          </TabButton>
          <TabButton active={activeTab === "builder"} onClick={() => setActiveTab("builder")}>
            Agent Builder
          </TabButton>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-300">
            {dashboard.probe_ready ? "Probe Online" : "Probe Offline"}
          </div>
        </div>

        {activeTab === "builder" ? (
          <AgentBuilder />
        ) : activeTab === "control" ? (
          <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
            <NodeGraph
              rollouts={rollouts}
              selectedRollout={selectedRollout}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onSelectRollout={setSelectedRolloutId}
            />
            <SidePanel
              apiUrl={API_URL}
              selectedNodeId={selectedNodeId}
              selectedRollout={selectedRollout}
              rollouts={rollouts}
              falsePositives={dashboard.false_positives}
              onSelectRollout={setSelectedRolloutId}
            />
          </div>
        ) : (
          <ProbeMonitor dashboard={dashboard} />
        )}

      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }) {
  const tones = {
    mint: "from-mint/25 via-mint/10 to-transparent",
    ember: "from-ember/25 via-ember/10 to-transparent",
    slateblue: "from-slateblue/30 via-plasma/10 to-transparent",
    ink: "from-white/12 via-white/5 to-transparent",
  };

  return (
    <div className={`mesh-panel rounded-[28px] border border-white/10 bg-gradient-to-br ${tones[tone]} p-4 shadow-glow`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "border border-signal/30 bg-white/10 text-white shadow-glow backdrop-blur"
          : "border border-white/10 bg-white/5 text-slate-300 backdrop-blur hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
