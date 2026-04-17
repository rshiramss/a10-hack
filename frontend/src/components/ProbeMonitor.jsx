import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ProbeMonitor({ dashboard }) {
  const outcomeData = [
    { name: "Resolved", value: dashboard.outcomes.resolved, color: "#14b8a6" },
    { name: "Escalated", value: dashboard.outcomes.escalated, color: "#f97316" },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="mesh-panel rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.8)] p-6 shadow-panel backdrop-blur-xl">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal">Layer Curve</div>
        <h2 className="mt-2 text-2xl font-semibold text-white">Probe accuracy by transformer depth</h2>
        <div className="mt-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dashboard.curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="layer" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 1]} />
              <Tooltip />
              <Line type="monotone" dataKey="auc" stroke="#8cf3ff" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="accuracy" stroke="#18e7b2" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="mesh-panel rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.8)] p-6 shadow-panel backdrop-blur-xl">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal">Outcome Breakdown</div>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={outcomeData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>
                  {outcomeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mesh-panel rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.8)] p-6 shadow-panel backdrop-blur-xl">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal">Live Probe Feed</div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...dashboard.live_feed].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="rollout_id" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 1]} />
                <Tooltip />
                <Bar dataKey="probe_score" fill="#5b6cff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {(dashboard.turn_metrics ?? []).length > 0 && (
        <section className="mesh-panel rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.8)] p-6 shadow-panel backdrop-blur-xl xl:col-span-2">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal">Probe Signal by Turn</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">When does the latent signal emerge?</h2>
          <div className="mt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.turn_metrics} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="turn_index"
                  stroke="#94a3b8"
                  tickFormatter={(v) => `T${v}`}
                  label={{ value: "Agent Turn", position: "insideBottom", offset: -4, fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis stroke="#94a3b8" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  formatter={(value, name) => [`${(value * 100).toFixed(1)}%`, name === "auc" ? "AUC" : "Accuracy"]}
                  labelFormatter={(label) => `Turn ${label}`}
                />
                <Bar dataKey="auc" name="auc" fill="#8cf3ff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="accuracy" name="accuracy" fill="#18e7b2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-slate-400">
            {dashboard.turn_metrics.map((item) => (
              <span key={item.turn_index} className="font-mono">
                T{item.turn_index}: {item.n_examples} examples
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mesh-panel rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.8)] p-6 shadow-panel backdrop-blur-xl xl:col-span-2">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal">False Positives</div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Rollout</th>
                <th className="pb-3">Issue</th>
                <th className="pb-3">Original Probe Score</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.false_positives.map((item) => (
                <tr key={item.rollout_id} className="border-t border-white/10">
                  <td className="py-3 font-medium text-white">#{item.rollout_id}</td>
                  <td className="py-3">{item.issue_type}</td>
                  <td className="py-3">{(item.original_probe_score * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
