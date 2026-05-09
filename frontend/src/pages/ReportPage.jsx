import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const SUSPICIOUS = ['tab_switch', 'face_missing', 'multiple_faces', 'copy_paste_attempt']
const EVENT_LABELS = {
  tab_switch: 'Tab Switched Away', face_missing: 'Face Not Detected',
  multiple_faces: 'Multiple Faces', copy_paste_attempt: 'Copy/Paste Blocked',
  focus_lost: 'Window Focus Lost', context_menu_attempt: 'Right-click Blocked',
  websocket_disconnected: 'Connection Dropped',
}
const VERDICT = {
  Clean:      { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', color: '#10b981', label: '✅ CLEAN' },
  Suspicious: { text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   color: '#f59e0b', label: '⚠️ SUSPICIOUS' },
  'High Risk':{ text: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10',     color: '#ef4444', label: '🚨 HIGH RISK' },
}

export default function ReportPage() {
  const { session_id } = useParams()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    fetch(`/api/report/${session_id}`)
      .then(r => { if (!r.ok) throw new Error('Report not found'); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [session_id])

  if (loading) return (
    <div className="min-h-screen hex-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400">Loading integrity report…</p>
      </div>
    </div>
  )
  if (error) return (
    <div className="min-h-screen hex-bg flex items-center justify-center">
      <div className="card text-center max-w-sm">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="font-bold text-white mb-2 heading">Report Not Found</h2>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <button onClick={() => navigate('/admin/dashboard')} className="btn-ghost">← Dashboard</button>
      </div>
    </div>
  )

  const { session, report, events } = data
  const v = VERDICT[report?.verdict] || VERDICT['Clean']
  const risk = report?.risk_score ?? 0
  const suspicious = (events || []).filter(e => SUSPICIOUS.includes(e.event_type))
  const typeCounts = (events || []).reduce((a, e) => { a[e.event_type] = (a[e.event_type] || 0) + 1; return a }, {})

  // Heatmap buckets
  const durationMs = session.ended_at ? new Date(session.ended_at) - new Date(session.started_at) : 3600000
  const BUCKETS = 16
  const heatBuckets = Array.from({ length: BUCKETS }, (_, i) => {
    const s = new Date(session.started_at).getTime() + i * (durationMs / BUCKETS)
    return (events || []).filter(e => { const t = new Date(e.timestamp).getTime(); return t >= s && t < s + durationMs/BUCKETS && SUSPICIOUS.includes(e.event_type) }).length
  })
  const maxB = Math.max(...heatBuckets, 1)

  const copy = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="min-h-screen hex-bg text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#060d1a]/90 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/admin/dashboard')} className="btn-ghost py-1.5 px-3 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Dashboard
          </button>
          <div className="text-center">
            <h1 className="font-bold text-white heading">Integrity Report</h1>
            <p className="text-xs text-slate-500 mono">{session_id?.slice(0, 20)}…</p>
          </div>
          <button onClick={() => copy(session_id)} className="btn-ghost py-1.5 px-3 text-sm">
            {copied ? '✓ Copied' : 'Copy ID'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Hero verdict card */}
        <div className={`card border ${v.border} ${v.bg}`}>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl font-black text-white border border-white/10">
                  {session.student_name?.[0] || '?'}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white heading">{session.student_name}</h2>
                  <p className="text-slate-400 text-sm">{session.exam_title}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['Started',  new Date(session.started_at).toLocaleTimeString()],
                  ['Ended',    session.ended_at ? new Date(session.ended_at).toLocaleTimeString() : '—'],
                  ['Duration', calcDuration(session.started_at, session.ended_at)],
                  ['Events',   `${events?.length ?? 0} total`],
                ].map(([l, v]) => (
                  <div key={l} className="glass p-3 rounded-xl">
                    <p className="text-xs text-slate-500">{l}</p>
                    <p className="text-sm font-bold text-white mono">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk dial */}
            <div className={`flex flex-col items-center gap-3 p-6 rounded-2xl border ${v.border} bg-black/20 min-w-[180px]`}>
              <RiskGauge score={risk} color={v.color} />
              <div className="text-center">
                <p className={`text-xl font-extrabold heading ${v.text}`}>{v.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">Integrity Verdict</p>
                <p className={`text-3xl font-black mono mt-1 ${v.text}`}>{risk}<span className="text-sm font-normal">/100</span></p>
              </div>
            </div>
          </div>

          {report?.summary && (
            <div className="mt-5 p-4 bg-black/20 rounded-xl border border-white/8">
              <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">🤖 AI Analysis</p>
              <p className="text-slate-300 text-sm leading-relaxed">{report.summary}</p>
            </div>
          )}
        </div>

        {/* Heatmap */}
        <div className="card">
          <h3 className="font-bold text-white heading mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Violation Heatmap
          </h3>
          <div className="flex gap-1 items-end h-24">
            {heatBuckets.map((count, i) => {
              const pct = count / maxB
              const h = Math.max(pct * 96, count > 0 ? 10 : 4)
              const col = pct > 0.7 ? '#ef4444' : pct > 0.4 ? '#f59e0b' : pct > 0 ? '#fbbf24' : '#1e3a5f'
              return (
                <div key={i} title={`${count} violation${count !== 1 ? 's' : ''}`}
                  className="flex-1 flex flex-col items-center justify-end group cursor-default">
                  <div className="w-full rounded-sm transition-all duration-500 group-hover:opacity-80"
                    style={{ height: `${h}px`, backgroundColor: col }} />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-600 mono">
            <span>Start</span><span>────────────────── time ──────────────────</span><span>End</span>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs">
            {[['#1e3a5f','Clean'],['#fbbf24','Warning'],['#ef4444','Critical']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} /><span className="text-slate-500">{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Event breakdown + timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold text-white heading mb-4">Event Breakdown</h3>
            {Object.keys(typeCounts).length === 0 ? (
              <p className="text-slate-500 text-sm italic text-center py-6">No events recorded.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const isSusp = SUSPICIOUS.includes(type)
                  const max = Math.max(...Object.values(typeCounts))
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isSusp ? 'text-red-300' : 'text-slate-400'}`}>
                          {isSusp ? '🔴' : '🟡'} {EVENT_LABELS[type] || type}
                        </span>
                        <span className="text-xs font-bold text-white mono">{count}×</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${isSusp ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card overflow-hidden flex flex-col" style={{ maxHeight: 360 }}>
            <h3 className="font-bold text-white heading mb-4 flex-shrink-0">Event Timeline</h3>
            <div className="overflow-y-auto flex-1 space-y-1">
              {(!events || events.length === 0) ? (
                <p className="text-slate-500 text-sm italic text-center py-6">No events recorded.</p>
              ) : events.map((e, i) => {
                const s = SUSPICIOUS.includes(e.event_type)
                return (
                  <div key={e.id || i}
                    className={`flex items-center gap-2.5 text-xs px-3 py-2 rounded-lg ${s ? 'bg-red-950/40 text-red-300' : 'bg-white/3 text-slate-400'}`}>
                    <span className="flex-shrink-0">{s ? '🔴' : '🟡'}</span>
                    <span className="flex-1 font-medium">{EVENT_LABELS[e.event_type] || e.event_type}</span>
                    <span className="mono flex-shrink-0 opacity-60">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Flagged events table */}
        {suspicious.length > 0 && (
          <div className="card border border-red-500/20">
            <h3 className="font-bold heading mb-4 flex items-center gap-2 text-red-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Flagged Events ({suspicious.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Event', 'Time', 'Metadata'].map(h => (
                      <th key={h} className="text-left pb-2 text-xs text-slate-500 font-medium pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {suspicious.map((e, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-red-300 font-medium text-xs">{EVENT_LABELS[e.event_type] || e.event_type}</td>
                      <td className="py-2 pr-4 mono text-xs text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 text-xs text-slate-500 mono">{e.metadata ? JSON.stringify(JSON.parse(e.metadata)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RiskGauge({ score, color }) {
  const r = 36, c = 2 * Math.PI * r
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#0f2344" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-black text-white mono">{score}</span>
      </div>
    </div>
  )
}

function calcDuration(s, e) {
  if (!s || !e) return '—'
  const ms = new Date(e) - new Date(s)
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`
}
