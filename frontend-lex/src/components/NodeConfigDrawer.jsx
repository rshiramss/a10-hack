import { useState } from 'react'

const LLM_OPTIONS = [
  'Qwen2.5-7B-Instruct',
  'Qwen2.5-3B-Instruct',
  'gpt-4o-mini',
  'claude-haiku-4-5',
  'gemini-flash-2.0',
]

const META = {
  customer: {
    label: 'Customer Tester',
    color: 'amber',
    accent: 'border-amber-500/40 focus:border-amber-500/50',
    btn: 'bg-amber-600 hover:bg-amber-500',
    dot: 'bg-amber-500/20 border-amber-500/40',
    letter: 'T',
    letterColor: 'text-amber-400',
    type: 'llm',
  },
  agent: {
    label: 'Customer Support Agent',
    color: 'blue',
    accent: 'border-blue-500/40 focus:border-blue-500/50',
    btn: 'bg-blue-600 hover:bg-blue-500',
    dot: 'bg-blue-500/20 border-blue-500/40',
    letter: 'A',
    letterColor: 'text-blue-400',
    type: 'llm',
  },
  mcp: {
    label: 'Orders MCP',
    color: 'emerald',
    accent: 'border-emerald-500/40 focus:border-emerald-500/50',
    btn: 'bg-emerald-700 hover:bg-emerald-600',
    dot: 'bg-emerald-500/20 border-emerald-500/40',
    letter: 'M',
    letterColor: 'text-emerald-400',
    type: 'mcp',
  },
}

const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none'

export default function NodeConfigDrawer({ nodeId, config, onChange, onClose }) {
  const meta = META[nodeId]
  if (!meta) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[480px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${meta.dot} border flex items-center justify-center`}>
              <span className={`${meta.letterColor} text-sm font-bold`}>{meta.letter}</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{meta.label}</h2>
              <p className="text-xs text-slate-500">Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="space-y-4">
          {meta.type === 'llm' ? (
            <>
              <Field label="LLM">
                <select
                  className={`${INPUT} ${meta.accent}`}
                  value={config.llm}
                  onChange={e => onChange(nodeId, 'llm', e.target.value)}
                >
                  {LLM_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                  ))}
                </select>
              </Field>
              <Field label="System Prompt">
                <textarea
                  className={`${INPUT} ${meta.accent} resize-none h-28`}
                  value={config.systemPrompt}
                  onChange={e => onChange(nodeId, 'systemPrompt', e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Endpoint">
                <input
                  className={`${INPUT} ${meta.accent}`}
                  value={config.endpoint}
                  onChange={e => onChange(nodeId, 'endpoint', e.target.value)}
                />
              </Field>
              <Field label="Tool Description Excerpt">
                <textarea
                  className={`${INPUT} ${meta.accent} font-mono resize-none h-24`}
                  value={config.systemPromptExcerpt}
                  onChange={e => onChange(nodeId, 'systemPromptExcerpt', e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={onClose} className={`px-4 py-2 text-xs ${meta.btn} text-white rounded-lg transition-colors`}>
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
