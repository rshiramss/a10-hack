import { useState } from 'react'

export default function McpDrawer({ onClose }) {
  const [fields, setFields] = useState({
    endpoint: 'sqlite://localhost/orders.db',
    excerpt: 'LOOKUP: <order_id> — retrieves status, product, and shipping details from the orders table.',
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
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <span className="text-emerald-400 text-sm font-bold">M</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Orders MCP</h2>
              <p className="text-xs text-slate-500">Tool configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="space-y-4">
          <Field label="Endpoint">
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
              value={fields.endpoint}
              onChange={e => set('endpoint', e.target.value)}
            />
          </Field>
          <Field label="Tool description excerpt">
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono resize-none h-24 focus:outline-none focus:border-emerald-500/50"
              value={fields.excerpt}
              onChange={e => set('excerpt', e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors"
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
