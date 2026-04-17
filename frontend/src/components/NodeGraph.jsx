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
    <section className="mesh-panel overflow-hidden rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.78)] shadow-panel backdrop-blur-xl">
      <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">Workflow</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Fixed node topology</h2>
        </div>
        <select
          value={selectedRollout?.id ?? ""}
          onChange={(event) => onSelectRollout(Number(event.target.value))}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-sm outline-none backdrop-blur"
        >
          {rollouts.map((rollout) => (
            <option key={rollout.id} value={rollout.id}>
              Rollout #{rollout.id} · {rollout.issue_type}
            </option>
          ))}
        </select>
      </div>
      <div className="relative h-[620px] bg-[radial-gradient(circle_at_top,rgba(91,108,255,0.18),transparent_35%),linear-gradient(180deg,rgba(2,8,23,0.9),rgba(4,12,28,0.98))]">
        <div className="grid-fade absolute inset-0 opacity-60" />
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
          <Background color="rgba(140,243,255,0.12)" gap={28} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}

function WorkflowNode({ data }) {
  const tones = {
    customer: "from-slateblue to-signal",
    agent: "from-plasma via-slateblue to-signal",
    verifier: "from-ember to-amber-300",
  };

  return (
    <div
      className={`scanline w-[290px] rounded-[30px] border border-white/10 bg-[rgba(10,18,34,0.86)] p-5 shadow-glow transition ${
        data.selected ? "ring-2 ring-signal/60" : "ring-1 ring-white/5"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-0 !bg-signal" />
      <div className={`inline-flex rounded-full bg-gradient-to-r ${tones[data.tone]} px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-white shadow-neon`}>
        {data.title}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{data.subtitle}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{data.preview}</p>
      <div className="mt-4 h-px w-full origin-left rounded-full bg-gradient-to-r from-signal/80 via-slateblue/60 to-transparent animate-pulseline" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-0 !bg-signal" />
      {data.tone === "agent" ? (
        <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-0 !bg-ember" />
      ) : null}
    </div>
  );
}
