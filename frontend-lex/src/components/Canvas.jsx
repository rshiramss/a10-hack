import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const NODES = [
  { id: 'agent', type: 'agentNode', position: { x: 120, y: 180 }, data: {} },
  { id: 'tester', type: 'testerNode', position: { x: 420, y: 180 }, data: {} },
]

const EDGES = [
  {
    id: 'e-agent-tester',
    source: 'agent',
    target: 'tester',
    type: 'smoothstep',
    style: { stroke: '#475569', strokeWidth: 2 },
    animated: true,
  },
]

function AgentNode({ data }) {
  return (
    <div
      onClick={data.onOpen}
      className="cursor-pointer select-none w-48 bg-slate-900 border border-blue-500/40 hover:border-blue-400 rounded-xl p-4 shadow-lg transition-all group"
    >
      <Handle type="source" position={Position.Right} style={{ background: '#3b82f6', border: 'none', width: 8, height: 8 }} />
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

const nodeTypes = {
  agentNode: AgentNode,
  testerNode: TesterNode,
}

export default function Canvas({ onOpenAgent, onOpenTester }) {
  const nodes = NODES.map(n => ({
    ...n,
    data: {
      onOpen: n.id === 'agent' ? onOpenAgent : onOpenTester,
    },
  }))

  return (
    <div className="flex-1 h-full relative">
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 backdrop-blur">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="text-xs text-slate-400 font-medium">MI Agent Framework</span>
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={EDGES}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
      </ReactFlow>
    </div>
  )
}
