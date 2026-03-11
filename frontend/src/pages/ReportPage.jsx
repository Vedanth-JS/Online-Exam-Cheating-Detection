import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function ReportPage() {
  const { session_id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/report/${session_id}`)
      .then(r => {
        if (!r.ok) throw new Error('Report not found')
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [session_id])

  if (loading) return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading integrity report...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="card text-center max-w-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="font-bold text-white mb-2">Report Not Found</h2>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <button onClick={() => navigate('/admin/dashboard')} className="btn-ghost">← Dashboard</button>
      </div>
    </div>
  )

  const { session, report, events } = data
  const verdictInfo = VERDICT_CONFIG[report?.verdict] || VERDICT_CONFIG['Clean']
  const riskScore = report?.risk_score ?? 0

  // Group events by type for severity visualization
  const eventTypeCounts = (events || []).reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1
    return acc
  }, {})

  // Build timeline segments (10-minute buckets)
  const durationMs = session.ended_at
    ? new Date(session.ended_at) - new Date(session.started_at)
    : 3600000
  const BUCKETS = 12
  const bucketMs = durationMs / BUCKETS
  const heatBuckets = Array.from({ length: BUCKETS }, (_, i) => {
    const bucketStart = new Date(session.started_at).getTime() + i * bucketMs
    const bucketEnd = bucketStart + bucketMs
    const count = (events || []).filter(e => {
      const t = new Date(e.timestamp).getTime()
      return t >= bucketStart && t < bucketEnd && SUSPICIOUS_TYPES.includes(e.event_type)
    }).length
    return count
  })
  const maxBucket = Math.max(...heatBuckets, 1)

  return (
    <div className="min-h-screen bg-navy-900 grid-bg">
      {/* Header */}
      <header className="bg-navy-800/90 backdrop-blur border-b border-slate-700/60 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/admin/dashboard')} className="btn-ghost text-sm py-2 px-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </button>
          <div className="text-center">
            <h1 className="font-bold text-white">Integrity Report</h1>
            <p className="text-xs text-slate-500 mono">{session_id?.slice(0, 16)}…</p>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Student + Verdict Hero */}
        <div className="card-glow">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl font-bold text-white">
                  {session.student_name?.[0] || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{session.student_name}</h2>
                  <p className="text-slate-400 text-sm">{session.exam_title}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <InfoItem label="Started" value={formatTime(session.started_at)} />
                <InfoItem label="Ended" value={formatTime(session.ended_at)} />
                <InfoItem label="Duration" value={calcDuration(session.started_at, session.ended_at)} />
                <InfoItem label="Total Events" value={events?.length ?? 0} />
              </div>
            </div>

            {/* Risk Score */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-xl border min-w-[180px]"
              style={{ borderColor: verdictInfo.borderColor, background: verdictInfo.bgColor }}>
              <RiskGauge score={riskScore} color={verdictInfo.color} />
              <div className="text-center">
                <p className={`text-2xl font-extrabold ${verdictInfo.textClass}`}>{report?.verdict || 'Pending'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Integrity Verdict</p>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {report?.summary && (
            <div className="mt-5 p-4 bg-navy-700/50 rounded-xl border border-slate-600/50">
              <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">AI Analysis Summary</p>
              <p className="text-slate-300 text-sm leading-relaxed">{report.summary}</p>
            </div>
          )}
        </div>

        {/* Severity Heatmap */}
        <div className="card">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Severity Heatmap — Timeline
          </h3>
          <div className="flex gap-1 items-end h-20">
            {heatBuckets.map((count, i) => {
              const pct = count / maxBucket
              const h = Math.max(pct * 80, count > 0 ? 8 : 4)
              const color = pct > 0.7 ? '#ef4444' : pct > 0.4 ? '#f59e0b' : pct > 0 ? '#fbbf24' : '#1e293b'
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`Bucket ${i+1}: ${count} events`}>
                  <div className="rounded-sm w-full transition-all duration-500"
                    style={{ height: `${h}px`, backgroundColor: color, opacity: count > 0 ? 1 : 0.3 }} />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-600">
            <span>Start</span>
            <span>← time →</span>
            <span>End</span>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-800 block"/><span className="text-slate-500">Clean</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 block"/><span className="text-slate-500">Warning</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 block"/><span className="text-slate-500">High Risk</span></span>
          </div>
        </div>

        {/* Event breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type breakdown */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">Event Type Breakdown</h3>
            {Object.keys(eventTypeCounts).length === 0 ? (
              <p className="text-slate-500 text-sm italic">No events recorded.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(eventTypeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const maxCount = Math.max(...Object.values(eventTypeCounts))
                    const isSuspicious = SUSPICIOUS_TYPES.includes(type)
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${isSuspicious ? 'text-red-300' : 'text-slate-400'}`}>
                            {isSuspicious ? '🔴' : '🟡'} {EVENT_LABELS[type] || type}
                          </span>
                          <span className="text-xs font-bold text-white">{count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isSuspicious ? 'bg-red-500' : 'bg-amber-500'}`}
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Full event timeline */}
          <div className="card flex flex-col" style={{ maxHeight: '360px' }}>
            <h3 className="font-bold text-white mb-4 shrink-0">Full Event Timeline</h3>
            <div className="overflow-y-auto space-y-1.5 flex-1">
              {(!events || events.length === 0) ? (
                <p className="text-slate-500 text-sm italic">No events recorded.</p>
              ) : (
                events.map((e, i) => {
                  const isSuspicious = SUSPICIOUS_TYPES.includes(e.event_type)
                  return (
                    <div key={e.id || i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${isSuspicious ? 'bg-red-950/40 text-red-300' : 'bg-slate-800/50 text-slate-400'}`}>
                      <span className="shrink-0 mt-0.5">{isSuspicious ? '🔴' : '🟡'}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{EVENT_LABELS[e.event_type] || e.event_type}</span>
                      </div>
                      <span className="mono shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Flagged events detail */}
        {report?.flagged_events?.length > 0 && (
          <div className="card border-red-700/40">
            <h3 className="font-bold text-red-400 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Flagged Suspicious Events ({report.flagged_events.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60">
                    <th className="text-left pb-2 text-xs text-slate-500 font-medium pr-4">Event</th>
                    <th className="text-left pb-2 text-xs text-slate-500 font-medium pr-4">Timestamp</th>
                    <th className="text-left pb-2 text-xs text-slate-500 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {report.flagged_events.map((e, i) => (
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

// ─── Sub-components ────────────────────────────────────────────────────────

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-white mono">{value || '—'}</p>
    </div>
  )
}

function RiskGauge({ score, color }) {
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="40" cy="40" r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-extrabold text-white">{score}</span>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const SUSPICIOUS_TYPES = ['tab_switch', 'face_missing', 'multiple_faces', 'copy_paste_attempt']

const EVENT_LABELS = {
  tab_switch: 'Tab switched away',
  focus_lost: 'Window focus lost',
  face_missing: 'Face not detected',
  multiple_faces: 'Multiple faces detected',
  copy_paste_attempt: 'Copy/paste blocked',
  context_menu_attempt: 'Right-click blocked',
  websocket_disconnected: 'Connection dropped',
}

const VERDICT_CONFIG = {
  Clean: { textClass: 'text-emerald-400', color: '#10b981', borderColor: '#065f46', bgColor: 'rgba(6,95,70,0.2)' },
  Suspicious: { textClass: 'text-amber-400', color: '#f59e0b', borderColor: '#92400e', bgColor: 'rgba(146,64,14,0.2)' },
  'High Risk': { textClass: 'text-red-400', color: '#ef4444', borderColor: '#7f1d1d', bgColor: 'rgba(127,29,29,0.2)' },
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function calcDuration(start, end) {
  if (!start || !end) return '—'
  const ms = new Date(end) - new Date(start)
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}
