import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from "@xyflow/react";

const nodeTypes = {
  workflow: WorkflowNode,
};

export default function NodeGraph({
  rollouts,
  selectedRollout,
  selectedNodeId,
  onSelectNode,
  onSelectRollout,
}) {
  const latestScore = selectedRollout?.final_probe_score ?? 0;
  const nodes = [
    {
      id: "customer",
      type: "workflow",
      position: { x: 80, y: 180 },
      data: {
        title: "Customer Node",
        subtitle: selectedRollout?.customer_name ?? "Synthetic user",
        preview: selectedRollout?.complaint_text ?? "Select a rollout to inspect the complaint trace.",
        tone: "customer",
        selected: selectedNodeId === "customer",
      },
    },
    {
      id: "agent",
      type: "workflow",
      position: { x: 480, y: 120 },
      data: {
        title: "Agent Node",
        subtitle: selectedRollout?.issue_type ?? "Support LLM",
        preview: selectedRollout
          ? `Last probe score ${(latestScore * 100).toFixed(0)}%`
          : "Agent responses and hidden-state logs appear here.",
        tone: "agent",
        selected: selectedNodeId === "agent",
      },
    },
    {
      id: "verifier",
      type: "workflow",
      position: { x: 470, y: 360 },
      data: {
        title: "Verifier Node",
        subtitle: selectedRollout?.outcome ?? "Outcome tracker",
        preview: selectedRollout
          ? `Turns ${selectedRollout.turns_completed}/${selectedRollout.max_turns}`
          : "Binary outcome from concession rules and turn budget.",
        tone: "verifier",
        selected: selectedNodeId === "verifier",
      },
    },
  ];

  const edges = [
    {
      id: "customer-agent",
      source: "customer",
      target: "agent",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#3658c9", strokeWidth: 2 },
    },
    {
      id: "agent-customer",
      source: "agent",
      target: "customer",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#0f766e", strokeWidth: 2 },
    },
    {
      id: "agent-verifier",
      source: "agent",
      target: "verifier",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#f97316", strokeWidth: 2 },
    },
  ];

  return (
    <section className="overflow-hidden rounded-[32px] border border-white/60 bg-white/75 shadow-panel backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Workflow</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Fixed node topology</h2>
        </div>
        <select
          value={selectedRollout?.id ?? ""}
          onChange={(event) => onSelectRollout(Number(event.target.value))}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
        >
          {rollouts.map((rollout) => (
            <option key={rollout.id} value={rollout.id}>
              Rollout #{rollout.id} · {rollout.issue_type}
            </option>
          ))}
        </select>
      </div>
      <div className="h-[620px] bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(219,234,254,0.7))]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, node) => onSelectNode(node.id)}
        >
          <Background color="#cbd5e1" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}

function WorkflowNode({ data }) {
  const tones = {
    customer: "from-blue-500 to-cyan-500",
    agent: "from-slate-900 to-slate-700",
    verifier: "from-orange-500 to-amber-500",
  };

  return (
    <div
      className={`w-[280px] rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-xl transition ${
        data.selected ? "ring-2 ring-slate-900/80" : "ring-1 ring-slate-200/80"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-0 !bg-slate-300" />
      <div className={`inline-flex rounded-full bg-gradient-to-r ${tones[data.tone]} px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-white`}>
        {data.title}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{data.subtitle}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{data.preview}</p>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-0 !bg-slate-400" />
      {data.tone === "agent" ? (
        <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-0 !bg-orange-400" />
      ) : null}
    </div>
  );
}

