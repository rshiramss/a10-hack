import { useState } from 'react'

export default function AgentDrawer({ onClose }) {
  const [fields, setFields] = useState({
    systemPrompt: 'You are a professional customer support agent...',
    mcpEndpoint: 'https://mcp.internal/v1',
    mcpToken: '••••••••••••••••',
    toolSchema: '{"tools": [{"name": "lookup_order", "description": "..."}]}',
  })

  function set(key, val) {
    setFields(f => ({ ...f, [key]: val }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[480px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <span className="text-blue-400 text-sm font-bold">A</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Customer Support Agent</h2>
              <p className="text-xs text-slate-500">Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="space-y-4">
          <Field label="System Prompt">
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 resize-none h-20 focus:outline-none focus:border-blue-500/50"
              value={fields.systemPrompt}
              onChange={e => set('systemPrompt', e.target.value)}
            />
          </Field>
          <Field label="MCP Endpoint URL">
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
              value={fields.mcpEndpoint}
              onChange={e => set('mcpEndpoint', e.target.value)}
            />
          </Field>
          <Field label="MCP Auth Token">
            <input
              type="password"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
              value={fields.mcpToken}
              onChange={e => set('mcpToken', e.target.value)}
            />
          </Field>
          <Field label="Tool Schema (JSON)">
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono resize-none h-20 focus:outline-none focus:border-blue-500/50"
              value={fields.toolSchema}
              onChange={e => set('toolSchema', e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
