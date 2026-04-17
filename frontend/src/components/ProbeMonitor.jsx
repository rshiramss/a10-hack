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
      <section className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-xl">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Layer Curve</div>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Probe accuracy by transformer depth</h2>
        <div className="mt-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dashboard.curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="layer" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[0, 1]} />
              <Tooltip />
              <Line type="monotone" dataKey="auc" stroke="#3658c9" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="accuracy" stroke="#14b8a6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-xl">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Outcome Breakdown</div>
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

        <div className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-xl">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Live Probe Feed</div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...dashboard.live_feed].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rollout_id" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 1]} />
                <Tooltip />
                <Bar dataKey="probe_score" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-xl xl:col-span-2">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">False Positives</div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Rollout</th>
                <th className="pb-3">Issue</th>
                <th className="pb-3">Original Probe Score</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.false_positives.map((item) => (
                <tr key={item.rollout_id} className="border-t border-slate-200/80">
                  <td className="py-3 font-medium text-slate-900">#{item.rollout_id}</td>
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

