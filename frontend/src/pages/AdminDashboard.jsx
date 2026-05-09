import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const WS_URL = `ws://localhost:3000`

const SEVERITY = {
  tab_switch: 'high', face_missing: 'high', multiple_faces: 'high', copy_paste_attempt: 'high',
  focus_lost: 'medium', context_menu_attempt: 'low', websocket_disconnected: 'medium',
}
const EVENT_LABELS = {
  tab_switch: 'Tab Switched', face_missing: 'Face Missing', multiple_faces: 'Multiple Faces',
  copy_paste_attempt: 'Copy/Paste', focus_lost: 'Focus Lost', context_menu_attempt: 'Right-click',
  websocket_disconnected: 'WS Dropped',
}
const SEV_COLORS = { high: 'text-red-400 bg-red-500/10 border-red-500/30', medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30', low: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
const SEV_DOT   = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-blue-400' }

export default function AdminDashboard() {
  const navigate = useNavigate()
  const wsRef = useRef(null)

  const [sessions, setSessions]         = useState([])
  const [liveAlerts, setLiveAlerts]     = useState([])
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState(null)
  const [wsStatus, setWsStatus]         = useState('connecting')
  const [selectedSession, setSelectedSession] = useState(null)
  const [activeTab, setActiveTab]       = useState('sessions') // 'sessions' | 'alerts' | 'generate'

  // AI Exam Generation
  const [isGenerating, setIsGenerating]     = useState(false)
  const [examTopic, setExamTopic]           = useState('')
  const [examCount, setExamCount]           = useState(5)
  const [examDuration, setExamDuration]     = useState(60)
  const [generatedLink, setGeneratedLink]   = useState('')
  const [generateWarning, setGenerateWarning] = useState('')

  // Stats
  const totalAlerts    = liveAlerts.length
  const highRiskAlerts = liveAlerts.filter(a => a.severity === 'high').length
  const activeSessions = sessions.filter(s => s.is_connected).length

  // Load sessions
  const fetchSessions = useCallback(() => {
    fetch('/api/sessions/active')
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSessions()
    const t = setInterval(fetchSessions, 5000)
    return () => clearInterval(t)
  }, [fetchSessions])

  // WebSocket
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_URL}?role=admin`)
      wsRef.current = ws
      ws.onopen  = () => setWsStatus('connected')
      ws.onclose = () => { setWsStatus('disconnected'); setTimeout(connect, 3000) }
      ws.onerror = () => setWsStatus('error')
      ws.onmessage = (msg) => {
        try {
          const p = JSON.parse(msg.data)
          if (p.type === 'student_event') {
            const sev = SEVERITY[p.event.event_type] || 'low'
            setLiveAlerts(prev => [{
              id: `${Date.now()}-${Math.random()}`,
              sessionId: p.sessionId,
              sessionIdShort: p.sessionId?.slice(0, 8),
              event_type: p.event.event_type,
              timestamp: p.event.timestamp || new Date().toISOString(),
              severity: sev,
            }, ...prev.slice(0, 79)])
            setSessions(prev => prev.map(s =>
              s.id !== p.sessionId ? s : {
                ...s,
                alert_count: (s.alert_count || 0) + 1,
                recent_alert: p.event.event_type,
                threat: Math.min(100, (s.threat || 0) + (sev === 'high' ? 15 : sev === 'medium' ? 8 : 3))
              }
            ))
          }
          if (p.type === 'session_ended') fetchSessions()
        } catch (_) {}
      }
    }
    connect()
    return () => wsRef.current?.close()
  }, [fetchSessions])

  // Auto-fill broadcast target when selecting session
  const handleSelectSession = (s) => {
    setSelectedSession(s)
    setBroadcastTarget(s.id)
  }

  const sendBroadcast = async () => {
    if (!broadcastTarget || !broadcastMsg.trim()) return
    try {
      const r = await fetch('/api/admin/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: broadcastTarget, message: broadcastMsg }),
      })
      const d = await r.json()
      setBroadcastStatus(d.success ? 'sent' : 'error')
      if (d.success) setBroadcastMsg('')
    } catch { setBroadcastStatus('error') }
    setTimeout(() => setBroadcastStatus(null), 3000)
  }

  const generateExam = async () => {
    if (!examTopic.trim()) return
    setIsGenerating(true); setGeneratedLink(''); setGenerateWarning('')
    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${examTopic} Assessment`, topic: examTopic, question_count: examCount, duration_minutes: examDuration })
      })
      const data = await res.json()
      if (res.ok && data.exam_id) {
        setGeneratedLink(`${window.location.origin}/exam/${data.exam_id}`)
        setGenerateWarning(data.rate_limited ? data.message : '')
      } else alert(data.error || 'Generation failed.')
    } catch { alert('Network error — backend not running?') }
    setIsGenerating(false)
  }

  const threatColor = (t = 0) => t >= 70 ? 'bg-red-500' : t >= 40 ? 'bg-amber-500' : t >= 10 ? 'bg-yellow-400' : 'bg-emerald-500'
  const threatLabel = (t = 0) => t >= 70 ? 'HIGH RISK' : t >= 40 ? 'SUSPICIOUS' : t >= 10 ? 'LOW RISK' : 'CLEAN'
  const threatClass = (t = 0) => t >= 70 ? 'text-red-400' : t >= 40 ? 'text-amber-400' : t >= 10 ? 'text-yellow-400' : 'text-emerald-400'

  return (
    <div className="min-h-screen hex-bg text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#060d1a]/90 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-black heading text-white text-lg">Exam<span className="text-gradient-blue">Guard</span></span>
            <span className="badge-info text-xs py-0.5">Proctor</span>
          </div>

          <div className="flex-1" />

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-3">
            <StatPill label="Active" value={activeSessions} color="text-emerald-400" />
            <StatPill label="Alerts" value={totalAlerts} color="text-amber-400" />
            <StatPill label="Critical" value={highRiskAlerts} color="text-red-400" />
          </div>

          {/* WS status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            wsStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : wsStatus === 'connecting' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : wsStatus === 'connecting' ? 'bg-blue-400 animate-pulse' : 'bg-red-400'}`} />
            {wsStatus === 'connected' ? 'LIVE' : wsStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-1 pb-3">
          {[
            { id: 'sessions', label: '🖥️ Sessions', count: sessions.length },
            { id: 'alerts',   label: '⚡ Live Alerts', count: liveAlerts.length },
            { id: 'broadcast',label: '📣 Broadcast' },
            { id: 'generate', label: '✨ AI Exam' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}>
              {tab.label}
              {tab.count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-500/30' : 'bg-white/10'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* ── SESSIONS TAB ──────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Session grid */}
            <div className="xl:col-span-2 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-white heading">Active Sessions</h2>
                <button onClick={fetchSessions} className="btn-ghost py-1.5 px-3 text-xs">↻ Refresh</button>
              </div>

              {sessions.length === 0 ? (
                <div className="card text-center py-16">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-slate-400 font-medium">No active sessions</p>
                  <p className="text-slate-600 text-sm mt-1">Students who start an exam will appear here</p>
                </div>
              ) : (
                sessions.map(s => (
                  <div key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`session-card rounded-2xl transition-all ${
                      s.threat >= 70 ? 'border-l-red-500' : s.threat >= 40 ? 'border-l-amber-500' : 'border-l-emerald-500'
                    } ${selectedSession?.id === s.id ? 'ring-2 ring-blue-500/40' : ''}`}>
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 ${
                        s.threat >= 70 ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {s.student_name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-white truncate">{s.student_name || `Student ${s.student_id}`}</span>
                          {s.is_connected
                            ? <span className="badge-clean text-xs">● LIVE</span>
                            : <span className="badge-warn text-xs">○ Offline</span>}
                        </div>
                        <p className="text-xs text-slate-500 truncate">Exam: {s.exam_title} · ID: {s.id?.slice(0, 12)}…</p>
                        {/* Threat bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="threat-bar flex-1">
                            <div className={`threat-fill ${threatColor(s.threat)}`} style={{ width: `${s.threat || 0}%` }} />
                          </div>
                          <span className={`text-xs font-bold mono w-16 text-right ${threatClass(s.threat)}`}>{threatLabel(s.threat)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-500 mono">{(s.alert_count || 0)} alerts</span>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/report/${s.id}`) }}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                          View Report →
                        </button>
                      </div>
                    </div>
                    {s.recent_alert && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                        Last: {EVENT_LABELS[s.recent_alert] || s.recent_alert}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Session detail */}
            <div className="space-y-4">
              {selectedSession ? (
                <>
                  <div className="card-glow">
                    <h3 className="font-bold text-white heading mb-4">Session Detail</h3>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 bg-blue-500/15 rounded-2xl flex items-center justify-center text-2xl font-black text-blue-400">
                        {selectedSession.student_name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-white">{selectedSession.student_name}</p>
                        <p className="text-xs text-slate-500">{selectedSession.exam_title}</p>
                        <span className={`text-xs font-bold ${threatClass(selectedSession.threat)}`}>{threatLabel(selectedSession.threat)}</span>
                      </div>
                    </div>
                    {/* Threat gauge */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Threat Level</span><span className="mono">{selectedSession.threat || 0}/100</span>
                      </div>
                      <div className="threat-bar">
                        <div className={`threat-fill ${threatColor(selectedSession.threat)}`} style={{ width: `${selectedSession.threat || 0}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="glass p-2 rounded-xl">
                        <p className="text-slate-500">Alerts</p>
                        <p className="font-bold text-white text-lg">{selectedSession.alert_count || 0}</p>
                      </div>
                      <div className="glass p-2 rounded-xl">
                        <p className="text-slate-500">Status</p>
                        <p className={`font-bold text-sm ${selectedSession.is_connected ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {selectedSession.is_connected ? '● Live' : '○ Offline'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => navigate(`/admin/report/${selectedSession.id}`)}
                      className="btn-primary w-full mt-4 text-sm">View Full Report</button>
                  </div>
                </>
              ) : (
                <div className="card text-center py-10">
                  <p className="text-slate-600 text-sm">Select a session to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-white heading">Live Alert Feed</h2>
              {liveAlerts.length > 0 && (
                <button onClick={() => setLiveAlerts([])} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Clear all</button>
              )}
            </div>
            {liveAlerts.length === 0 ? (
              <div className="card text-center py-16">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-slate-400 font-medium">No alerts yet</p>
                <p className="text-slate-600 text-sm mt-1">Violations will stream here in real time</p>
              </div>
            ) : (
              liveAlerts.map((a, i) => (
                <div key={a.id} className={`slide-in flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${SEV_COLORS[a.severity]}`}
                  style={{ animationDelay: `${Math.min(i, 5) * 30}ms` }}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEV_DOT[a.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{EVENT_LABELS[a.event_type] || a.event_type}</span>
                    <span className="text-xs opacity-60 ml-2">Session {a.sessionIdShort}…</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs opacity-60 mono">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    <button onClick={() => { setActiveTab('broadcast'); setBroadcastTarget(a.sessionId) }}
                      className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-medium">
                      Warn →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── BROADCAST TAB ──────────────────────────────────────────── */}
        {activeTab === 'broadcast' && (
          <div className="max-w-xl">
            <div className="card-glow space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center text-xl">📣</div>
                <div>
                  <h2 className="font-bold text-white heading">Broadcast Warning</h2>
                  <p className="text-xs text-slate-500">Send a real-time warning to a student session</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Target Session</label>
                <select className="select-field" value={broadcastTarget} onChange={e => setBroadcastTarget(e.target.value)}>
                  <option value="">— Select session or paste ID —</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.student_name} · {s.id?.slice(0, 16)}…</option>
                  ))}
                </select>
                <input className="input-field mt-2 mono text-sm" placeholder="Or paste full session UUID"
                  value={broadcastTarget} onChange={e => setBroadcastTarget(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Warning Message</label>
                <textarea rows={4} className="input-field resize-none" placeholder="e.g. Please look at your screen only."
                  value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} />
                <div className="flex gap-2 mt-2">
                  {['⚠️ Suspicious behavior detected', '👁️ You are being monitored', '🚫 Phone detected — stop immediately'].map(t => (
                    <button key={t} onClick={() => setBroadcastMsg(t)}
                      className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={sendBroadcast} disabled={!broadcastTarget || !broadcastMsg.trim()} className="btn-warning w-full flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Send Warning
              </button>

              {broadcastStatus === 'sent' && <div className="alert-green text-sm">✅ Warning delivered to student.</div>}
              {broadcastStatus === 'error' && <div className="alert-red text-sm">✗ Student not connected or session not found.</div>}
            </div>
          </div>
        )}

        {/* ── GENERATE TAB ───────────────────────────────────────────── */}
        {activeTab === 'generate' && (
          <div className="max-w-xl">
            <div className="card-glow space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-500/15 rounded-xl flex items-center justify-center text-xl">✨</div>
                <div>
                  <h2 className="font-bold text-white heading">AI Exam Generator</h2>
                  <p className="text-xs text-slate-500">Powered by Gemini 2.0 Flash</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Topic / Subject</label>
                <input className="input-field" placeholder="e.g. JavaScript ES6, Machine Learning, SQL..."
                  value={examTopic} onChange={e => setExamTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateExam()} />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {['JavaScript', 'Python', 'Machine Learning', 'SQL', 'React', 'Cloud Computing'].map(t => (
                    <button key={t} onClick={() => setExamTopic(t)}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-blue-500/15 hover:border-blue-500/30 transition-all text-slate-400 hover:text-blue-300">
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Questions: <span className="text-white">{examCount}</span></label>
                  <input type="range" min={3} max={15} value={examCount} onChange={e => setExamCount(+e.target.value)}
                    className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Duration: <span className="text-white">{examDuration}m</span></label>
                  <input type="range" min={10} max={180} step={10} value={examDuration} onChange={e => setExamDuration(+e.target.value)}
                    className="w-full accent-blue-500" />
                </div>
              </div>

              <button onClick={generateExam} disabled={isGenerating || !examTopic.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {isGenerating ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating with Gemini AI…</>
                ) : (<>✨ Generate AI Exam</>)}
              </button>

              {generateWarning && (
                <div className="alert-yellow text-xs">{generateWarning}</div>
              )}
              {generatedLink && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                  <p className="text-xs text-emerald-400 font-bold mb-2">{generateWarning ? '📋 Exam Created (Sample)' : '✨ AI Exam Ready!'}</p>
                  <a href={generatedLink} target="_blank" rel="noreferrer"
                    className="text-sm text-white hover:text-blue-300 transition-colors break-all font-mono underline-offset-2 hover:underline">
                    {generatedLink}
                  </a>
                  <button onClick={() => navigator.clipboard.writeText(generatedLink)}
                    className="btn-ghost py-1.5 px-3 text-xs mt-3 w-full">
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div className="glass px-3 py-1.5 flex items-center gap-2 rounded-xl">
      <span className={`text-lg font-extrabold heading ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}
