import { useEffect, useMemo, useState } from "react";
import NodeGraph from "./components/NodeGraph";
import ProbeMonitor from "./components/ProbeMonitor";
import SidePanel from "./components/SidePanel";

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
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const rolloutPayload = await getJson("/rollouts?limit=25");
      const dashboardPayload = await getJson("/probe/dashboard").catch(() => ({
        curve: [],
        outcomes: { resolved: 0, escalated: 0 },
        live_feed: [],
        false_positives: [],
        probe_ready: false,
      }));
      if (!mounted) {
        return;
      }
      setRollouts(rolloutPayload.items);
      setDashboard(dashboardPayload);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(226,232,240,0.92)_40%,_rgba(191,219,254,0.85)_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-panel backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-slate-500">MI Agent Framework</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                n8n-style support routing with live probe telemetry
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
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

        <div className="flex gap-3">
          <TabButton active={activeTab === "control"} onClick={() => setActiveTab("control")}>
            Control Room
          </TabButton>
          <TabButton active={activeTab === "monitor"} onClick={() => setActiveTab("monitor")}>
            Probe Monitor
          </TabButton>
        </div>

        {activeTab === "control" ? (
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
    mint: "from-teal-400/20 to-teal-500/10 text-teal-700",
    ember: "from-orange-400/20 to-orange-500/10 text-orange-700",
    slateblue: "from-blue-500/20 to-indigo-500/10 text-indigo-700",
    ink: "from-slate-300/40 to-slate-400/10 text-slate-700",
  };

  return (
    <div className={`rounded-3xl border border-white/60 bg-gradient-to-br ${tones[tone]} p-4 shadow-sm`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white shadow-lg"
          : "border border-white/70 bg-white/70 text-slate-700 backdrop-blur"
      }`}
    >
      {children}
    </button>
  );
}
