import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ─── Node types ────────────────────────────────────────────────────────────

function AgentNode({ data }) {
  return (
    <div
      onClick={data.onOpen}
      className="cursor-pointer select-none w-48 bg-slate-900 border border-blue-500/40 hover:border-blue-400 rounded-xl p-4 shadow-lg transition-all group"
    >
      <Handle type="target" position={Position.Left} style={{ background: '#3b82f6', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#3b82f6', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#3b82f6', border: 'none', width: 8, height: 8 }} />
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">Customer Support</div>
          <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">Agent</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-slate-500">Qwen2.5 · Tool use</span>
      </div>
    </div>
  )
}

function TesterNode({ data }) {
  return (
    <div
      onClick={data.onOpen}
      className="cursor-pointer select-none w-48 bg-slate-900 border border-amber-500/40 hover:border-amber-400 rounded-xl p-4 shadow-lg transition-all group"
    >
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#f59e0b', border: 'none', width: 8, height: 8 }} />
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">Customer</div>
          <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">Tester</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-xs text-slate-500">Scripted env · LLM</span>
      </div>
    </div>
  )
}

function McpNode({ data }) {
  return (
    <div
      onClick={data.onOpen}
      className="cursor-pointer select-none w-48 bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 rounded-xl p-4 shadow-lg transition-all group"
    >
      <Handle type="target" position={Position.Left} style={{ background: '#10b981', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#10b981', border: 'none', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#10b981', border: 'none', width: 8, height: 8 }} />
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">Orders MCP</div>
          <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">Tool</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-slate-500">sqlite · LOOKUP</span>
      </div>
    </div>
  )
}

const NODE_TYPES = { agentNode: AgentNode, testerNode: TesterNode, mcpNode: McpNode }

// ─── Palette items ──────────────────────────────────────────────────────────

const PALETTE = [
  {
    type: 'agentNode',
    label: 'Agent',
    sub: 'Support LLM',
    border: 'border-blue-500/40 hover:border-blue-400',
    icon: 'text-blue-400',
    dot: 'bg-blue-500/20 border-blue-500/30',
    svg: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
    ),
  },
  {
    type: 'testerNode',
    label: 'Customer Tester',
    sub: 'Scripted env',
    border: 'border-amber-500/40 hover:border-amber-400',
    icon: 'text-amber-400',
    dot: 'bg-amber-500/20 border-amber-500/30',
    svg: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
    ),
  },
  {
    type: 'mcpNode',
    label: 'MCP Tool',
    sub: 'Endpoint',
    border: 'border-emerald-500/40 hover:border-emerald-400',
    icon: 'text-emerald-400',
    dot: 'bg-emerald-500/20 border-emerald-500/30',
    svg: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
    ),
  },
]

// ─── Canvas ─────────────────────────────────────────────────────────────────

const INITIAL_NODES = [
  { id: 'agent-1', type: 'agentNode', position: { x: 120, y: 160 }, data: {} },
  { id: 'tester-1', type: 'testerNode', position: { x: 420, y: 160 }, data: {} },
  { id: 'mcp-1', type: 'mcpNode', position: { x: 270, y: 360 }, data: {} },
]

const INITIAL_EDGES = [
  { id: 'e1', source: 'agent-1', target: 'tester-1', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#475569', strokeWidth: 2 } },
  { id: 'e2', source: 'agent-1', target: 'mcp-1', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 4' } },
  { id: 'e3', source: 'mcp-1', target: 'agent-1', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 4' } },
]

let nodeCounter = 10

export default function Canvas(props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function CanvasInner({ onOpenNode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const reactFlowWrapper = useRef(null)
  const { screenToFlowPosition } = useReactFlow()

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#475569', strokeWidth: 2 } }, eds)
      ),
    [setEdges]
  )

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/reactflow')
      if (!type) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = `${type}-${++nodeCounter}`
      setNodes((nds) => [...nds, { id, type, position, data: {} }])
    },
    [screenToFlowPosition, setNodes]
  )

  const TYPE_TO_ID = { agentNode: 'agent', testerNode: 'customer', mcpNode: 'mcp' }
  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onOpen: () => onOpenNode(TYPE_TO_ID[n.type] ?? 'agent') },
  }))

  return (
    <div className="flex flex-1 h-full">
      {/* Sidebar palette */}
      <div className="w-44 h-full bg-slate-950 border-r border-slate-800 flex flex-col gap-2 p-3 overflow-y-auto z-10">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-medium px-1 mb-1">Nodes</p>
        {PALETTE.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('application/reactflow', item.type)}
            className={`cursor-grab active:cursor-grabbing select-none bg-slate-900 border ${item.border} rounded-xl p-3 transition-all`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-6 h-6 rounded-md ${item.dot} border flex items-center justify-center flex-shrink-0`}>
                <svg className={`w-3 h-3 ${item.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.svg}
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-300">{item.label}</span>
            </div>
            <p className="text-[10px] text-slate-600">{item.sub}</p>
          </div>
        ))}
        <div className="mt-auto pt-2 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 px-1">Drag onto canvas to add. Drag between handles to connect.</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 backdrop-blur">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-xs text-slate-400 font-medium">MI Agent Framework</span>
          </div>
        </div>
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          panOnDrag
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
