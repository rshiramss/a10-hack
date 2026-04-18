import { useCallback, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

const LLM_OPTIONS = ["Qwen2.5-7B-Instruct", "Qwen2.5-3B-Instruct", "gpt-4o-mini", "claude-haiku-4-5", "gemini-flash-2.0"];

const INITIAL_CONFIGS = {
  customer: {
    llm: "Qwen2.5-3B-Instruct",
    systemPrompt:
      "You are a synthetic angry customer. You have a specific grievance and will only concede if the agent offers a concrete resolution within 3 turns.",
  },
  agent: {
    llm: "Qwen2.5-7B-Instruct",
    systemPrompt:
      "You are a professional customer support agent for an e-commerce company. You have access to a LOOKUP tool to retrieve order details. Be empathetic and offer concrete resolutions.",
  },
  mcp: {
    endpoint: "sqlite://localhost/orders.db",
    excerpt: "LOOKUP: <order_id> — retrieves status, product, and shipping details from the orders table.",
  },
};

const INITIAL_NODES = [
  {
    id: "customer",
    type: "customerNode",
    position: { x: 60, y: 180 },
    data: { label: "Customer Tester" },
  },
  {
    id: "agent",
    type: "agentNode",
    position: { x: 420, y: 100 },
    data: { label: "Support Agent" },
  },
  {
    id: "mcp",
    type: "mcpNode",
    position: { x: 420, y: 340 },
    data: { label: "Orders MCP" },
  },
];

const INITIAL_EDGES = [
  {
    id: "c-a",
    source: "customer",
    target: "agent",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#3658c9", strokeWidth: 2 },
  },
  {
    id: "a-c",
    source: "agent",
    target: "customer",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#18e7b2", strokeWidth: 2 },
  },
  {
    id: "a-m",
    source: "agent",
    target: "mcp",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#a78bfa", strokeWidth: 2 },
  },
  {
    id: "m-a",
    source: "mcp",
    target: "agent",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#a78bfa", strokeWidth: 2 },
  },
];

function CustomerNode({ data }) {
  return (
    <div className={`node-card ${data.selected ? "ring-2 ring-signal/70" : "ring-1 ring-white/10"}`}>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-0 !bg-signal" />
      <Handle type="target" position={Position.Right} id="in" style={{ top: "65%" }} className="!h-3 !w-3 !border-0 !bg-signal" />
      <div className="node-badge bg-gradient-to-r from-slateblue to-signal">Customer Tester</div>
      <p className="mt-3 text-sm font-semibold text-white">Synthetic user</p>
      <p className="mt-1 text-xs text-slate-400">Angry archetype · binary concession rule</p>
      <div className="node-line from-signal/80 via-slateblue/50" />
    </div>
  );
}

function AgentNode({ data }) {
  return (
    <div className={`node-card ${data.selected ? "ring-2 ring-plasma/70" : "ring-1 ring-white/10"}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-0 !bg-plasma" />
      <Handle type="source" position={Position.Left} id="out" style={{ top: "65%" }} className="!h-3 !w-3 !border-0 !bg-plasma" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-0 !bg-violet-400" />
      <Handle type="target" position={Position.Bottom} id="mcp-in" style={{ left: "65%" }} className="!h-3 !w-3 !border-0 !bg-violet-400" />
      <div className="node-badge bg-gradient-to-r from-plasma via-slateblue to-signal">Support Agent</div>
      <p className="mt-3 text-sm font-semibold text-white">Support LLM</p>
      <p className="mt-1 text-xs text-slate-400">Tool use · hidden-state logging</p>
      <div className="node-line from-plasma/80 via-signal/50" />
    </div>
  );
}

function MCPNode({ data }) {
  return (
    <div className={`node-card ${data.selected ? "ring-2 ring-mint/70" : "ring-1 ring-white/10"}`}>
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-0 !bg-mint" />
      <Handle type="source" position={Position.Top} id="out" style={{ left: "65%" }} className="!h-3 !w-3 !border-0 !bg-mint" />
      <div className="node-badge bg-gradient-to-r from-mint/80 to-teal-400">MCP Tool</div>
      <p className="mt-3 text-sm font-semibold text-white">Orders DB</p>
      <p className="mt-1 text-xs text-slate-400">LOOKUP · sqlite endpoint</p>
      <div className="node-line from-mint/80 via-teal-400/50" />
    </div>
  );
}

const NODE_TYPES = { customerNode: CustomerNode, agentNode: AgentNode, mcpNode: MCPNode };

export default function AgentBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedId, setSelectedId] = useState(null);
  const [configs, setConfigs] = useState(INITIAL_CONFIGS);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedId(node.id);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, selected: n.id === node.id } }))
    );
  }, [setNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, selected: false } })));
  }, [setNodes]);

  const updateConfig = (id, field, value) =>
    setConfigs((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  return (
    <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
      <section className="mesh-panel overflow-hidden rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.78)] shadow-panel backdrop-blur-xl">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">Builder</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Agent topology</h2>
        </div>
        <div className="relative h-[580px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            nodesDraggable
            nodesConnectable
          >
            <Background color="rgba(140,243,255,0.10)" gap={28} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </section>

      <section className="mesh-panel rounded-[36px] border border-white/10 bg-[rgba(7,14,28,0.82)] p-6 shadow-panel backdrop-blur-xl">
        {selectedId ? (
          <ConfigPanel id={selectedId} config={configs[selectedId]} onChange={updateConfig} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              <span className="text-lg">⚙</span>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">No node selected</p>
            <p className="text-sm text-slate-500">Click a node to configure it</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ConfigPanel({ id, config, onChange }) {
  const meta = {
    customer: { title: "Customer Tester", badge: "from-slateblue to-signal", type: "llm+prompt" },
    agent:    { title: "Support Agent",   badge: "from-plasma via-slateblue to-signal", type: "llm+prompt" },
    mcp:      { title: "MCP Tool",        badge: "from-mint/80 to-teal-400", type: "mcp" },
  }[id];

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <div className={`inline-flex rounded-full bg-gradient-to-r ${meta.badge} px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-white shadow-neon`}>
          {meta.title}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-white">Node config</h3>
        <p className="mt-1 text-xs text-slate-500">Changes are cosmetic — no live effect</p>
      </div>

      <div className="flex flex-col gap-4">
        {meta.type === "llm+prompt" ? (
          <>
            <Field label="LLM">
              <select
                value={config.llm}
                onChange={(e) => onChange(id, "llm", e.target.value)}
                className="input-field"
              >
                {LLM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label="System prompt">
              <textarea
                value={config.systemPrompt}
                onChange={(e) => onChange(id, "systemPrompt", e.target.value)}
                rows={7}
                className="input-field resize-none"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Endpoint">
              <input
                value={config.endpoint}
                onChange={(e) => onChange(id, "endpoint", e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Tool description excerpt">
              <textarea
                value={config.excerpt}
                onChange={(e) => onChange(id, "excerpt", e.target.value)}
                rows={5}
                className="input-field resize-none"
              />
            </Field>
          </>
        )}
      </div>

      <div className="mt-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Status</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_8px_rgba(24,231,178,0.8)]" />
            <span className="text-sm text-slate-300">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">{label}</label>
      {children}
    </div>
  );
}
