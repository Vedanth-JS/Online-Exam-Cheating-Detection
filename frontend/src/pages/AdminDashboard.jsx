import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const WS_URL = `ws://localhost:3000`

export default function AdminDashboard() {
  const navigate = useNavigate()
  const wsRef = useRef(null)

  const [sessions, setSessions] = useState([])
  const [liveAlerts, setLiveAlerts] = useState([])
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState(null)
  const [wsStatus, setWsStatus] = useState('connecting')

  // AI Exam Generation State
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [examTopic, setExamTopic] = useState('')
  const [examCount, setExamCount] = useState(5)
  const [examDuration, setExamDuration] = useState(60)
  const [generatedLink, setGeneratedLink] = useState('')

  // ─── Load active sessions ─────────────────────────────────────────────────
  const fetchSessions = useCallback(() => {
    fetch('/api/sessions/active')
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSessions()
    const t = setInterval(fetchSessions, 5000)
    return () => clearInterval(t)
  }, [fetchSessions])

  // ─── WebSocket for real-time events ─────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_URL}?role=admin`)
      wsRef.current = ws

      ws.onopen = () => setWsStatus('connected')
      ws.onclose = () => {
        setWsStatus('disconnected')
        setTimeout(connect, 3000) // auto-reconnect
      }
      ws.onerror = () => setWsStatus('error')

      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data)

          if (payload.type === 'student_event') {
            const { sessionId, event } = payload
            const severity = severityOf(event.event_type)

            setLiveAlerts(prev => [{
              id: `${Date.now()}-${Math.random()}`,
              sessionId,
              event_type: event.event_type,
              timestamp: event.timestamp || new Date().toISOString(),
              severity,
            }, ...prev.slice(0, 49)])

            // Update session risk indicator in grid
            setSessions(prev => prev.map(s => {
              if (s.id !== sessionId) return s
              const isSuspicious = ['tab_switch', 'face_missing', 'multiple_faces', 'copy_paste_attempt'].includes(event.event_type)
              return { ...s, recent_alert: isSuspicious ? event.event_type : s.recent_alert }
            }))
          }

          if (payload.type === 'session_ended') {
            fetchSessions()
          }
        } catch (_) {}
      }
    }
    connect()
    return () => { wsRef.current?.close() }
  }, [fetchSessions])

  // ─── Broadcast warning ────────────────────────────────────────────────────
  const sendBroadcast = async () => {
    if (!broadcastTarget || !broadcastMsg.trim()) return
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: broadcastTarget, message: broadcastMsg }),
      })
      const data = await res.json()
      setBroadcastStatus(data.success ? 'sent' : 'error')
      if (data.success) setBroadcastMsg('')
    } catch (_) {
      setBroadcastStatus('error')
    }
    setTimeout(() => setBroadcastStatus(null), 3000)
  }

  // ─── Generate AI Exam ─────────────────────────────────────────────────────
  const generateExam = async () => {
    if (!examTopic.trim()) return
    setIsGenerating(true)
    setGeneratedLink('')
    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${examTopic} Assessment`,
          description: `AI-generated exam evaluating proficiency in ${examTopic}.`,
          topic: examTopic,
          question_count: examCount,
          duration_minutes: examDuration
        })
      })
      const data = await res.json()
      if (res.ok && data.exam_id) {
        setGeneratedLink(`${window.location.origin}/exam/${data.exam_id}`)
      } else {
        alert("Generation failed.")
      }
    } catch (err) {
      console.error(err)
      alert("Error generating exam.")
    }
    setIsGenerating(false)
  }

  return (
    <div className="min-h-screen bg-navy-900 grid-bg">
      {/* Header */}
      <header className="bg-navy-800/90 backdrop-blur border-b border-slate-700/60 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-white">Admin Proctoring Dashboard</h1>
              <p className="text-xs text-slate-500">ExamGuard — Real-time monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* WS status */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400' : wsStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-slate-400 capitalize">{wsStatus}</span>
            </div>
            <button onClick={() => setShowGenerateModal(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-900/20">
              <span>✨</span> Generate AI Exam
            </button>
            <button onClick={() => navigate('/')} className="btn-ghost text-sm py-2 px-3">← Home</button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Sessions" value={sessions.length} icon="👥" color="blue" />
          <StatCard label="Live Alerts" value={liveAlerts.length} icon="🚨" color="red" />
          <StatCard
            label="High Risk"
            value={liveAlerts.filter(a => a.severity === 'red').length}
            icon="⚠️"
            color="red"
          />
          <StatCard
            label="WS Status"
            value={wsStatus === 'connected' ? 'Online' : 'Offline'}
            icon="🔗"
            color={wsStatus === 'connected' ? 'green' : 'red'}
          />
        </div>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Session Grid - 2 cols */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Live Sessions
              </h2>
              <button onClick={fetchSessions} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
            </div>

            {sessions.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-400">No active sessions right now.</p>
                <p className="text-slate-600 text-sm mt-1">Sessions will appear here once students start an exam.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sessions.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    alerts={liveAlerts.filter(a => a.sessionId === s.id)}
                    onViewReport={() => navigate(`/admin/report/${s.id}`)}
                    onBroadcast={(id) => { setBroadcastTarget(id); document.getElementById('broadcast-panel')?.scrollIntoView({ behavior: 'smooth' }) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right col: Live alerts + Broadcast */}
          <div className="space-y-4">
            {/* Broadcast Panel */}
            <div id="broadcast-panel" className="card">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <span>📣</span> Broadcast Warning
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Session ID</label>
                  <input
                    id="broadcast-session-input"
                    value={broadcastTarget}
                    onChange={e => setBroadcastTarget(e.target.value)}
                    placeholder="Paste session UUID..."
                    className="input-field text-xs mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Warning Message</label>
                  <textarea
                    id="broadcast-message-input"
                    rows={2}
                    value={broadcastMsg}
                    onChange={e => setBroadcastMsg(e.target.value)}
                    placeholder="e.g. Stop looking away from the screen!"
                    className="input-field text-sm resize-none"
                  />
                </div>
                <button
                  id="send-broadcast-btn"
                  onClick={sendBroadcast}
                  disabled={!broadcastTarget || !broadcastMsg.trim()}
                  className="btn-danger w-full text-sm"
                >
                  Send Warning
                </button>
                {broadcastStatus === 'sent' && <p className="text-xs text-emerald-400 text-center">✓ Warning delivered</p>}
                {broadcastStatus === 'error' && <p className="text-xs text-red-400 text-center">✗ Student not connected</p>}
              </div>
            </div>

            {/* Live alerts feed */}
            <div className="card flex flex-col" style={{ maxHeight: '480px' }}>
              <h3 className="font-bold text-white mb-3 flex items-center gap-2 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Live Event Feed
                <span className="ml-auto text-xs text-slate-500 font-normal">{liveAlerts.length} events</span>
              </h3>
              <div className="overflow-y-auto space-y-1.5 flex-1">
                {liveAlerts.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">Waiting for events...</p>
                ) : (
                  liveAlerts.map(a => (
                    <div
                      key={a.id}
                      className={`px-3 py-2 rounded-lg border text-xs flex flex-col gap-0.5 ${
                        a.severity === 'red'
                          ? 'bg-red-950/40 border-red-800/50 text-red-300'
                          : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                      }`}
                    >
                      <span className="font-semibold">{EVENT_LABELS[a.event_type] || a.event_type}</span>
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="mono truncate max-w-[100px]">{a.sessionId?.slice(0, 8)}…</span>
                        <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generate AI Exam Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
              <span>✨</span> Generate AI Exam
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Topic</label>
                <input 
                  type="text" 
                  value={examTopic} 
                  onChange={e => setExamTopic(e.target.value)} 
                  placeholder="e.g. React.js, Cybersecurity, SQL" 
                  className="input-field w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Questions</label>
                  <input 
                    type="number" 
                    value={examCount} 
                    onChange={e => setExamCount(parseInt(e.target.value) || 5)} 
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Duration (mins)</label>
                  <input 
                    type="number" 
                    value={examDuration} 
                    onChange={e => setExamDuration(parseInt(e.target.value) || 60)} 
                    className="input-field w-full"
                  />
                </div>
              </div>

              {generatedLink && (
                <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
                  <p className="text-xs text-emerald-400 font-bold mb-1">Exam Generated Successfully!</p>
                  <a href={generatedLink} target="_blank" rel="noreferrer" className="text-sm text-white hover:underline break-all">
                    {generatedLink}
                  </a>
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => { setShowGenerateModal(false); setGeneratedLink(''); }} 
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={generateExam} 
                  disabled={isGenerating || !examTopic.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-colors flex justify-center items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Generating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }) {
  const colors = {
    blue: 'border-blue-700/40 bg-blue-950/20',
    red: 'border-red-700/40 bg-red-950/20',
    green: 'border-emerald-700/40 bg-emerald-950/20',
  }
  return (
    <div className={`card ${colors[color] || colors.blue} py-4`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-400 text-xs font-medium">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function SessionCard({ session, alerts, onViewReport, onBroadcast }) {
  const recentAlerts = alerts.slice(0, 3)
  const hasRisk = alerts.some(a => a.severity === 'red')

  return (
    <div className={`card transition-all duration-300 ${hasRisk ? 'border-red-700/60 glow-red' : 'hover:border-slate-600'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-white">{session.student_name}</p>
          <p className="text-xs text-slate-500">{session.exam_title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {session.is_connected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-xs text-slate-600">Offline</span>
          )}
        </div>
      </div>

      {/* Alert count bar */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">Events:</span>
        <span className="text-xs font-bold text-white">{alerts.length}</span>
        {hasRisk && <span className="badge-high-risk">⚠ HIGH RISK</span>}
      </div>

      {/* Recent alerts */}
      {recentAlerts.length > 0 && (
        <div className="space-y-1 mb-3">
          {recentAlerts.map(a => (
            <div key={a.id} className={`text-xs px-2 py-1 rounded ${a.severity === 'red' ? 'bg-red-950/50 text-red-300' : 'bg-amber-950/50 text-amber-300'}`}>
              {EVENT_LABELS[a.event_type] || a.event_type}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onViewReport()}
          className="flex-1 btn-ghost text-xs py-1.5"
        >
          View Report
        </button>
        <button
          onClick={() => onBroadcast(session.id)}
          className="flex-1 btn-danger text-xs py-1.5"
        >
          📣 Warn
        </button>
      </div>
      <p className="text-xs text-slate-700 mono mt-2 truncate">{session.id}</p>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const EVENT_LABELS = {
  tab_switch: 'Tab switched away',
  focus_lost: 'Window focus lost',
  face_missing: 'Face not detected',
  multiple_faces: 'Multiple faces detected',
  copy_paste_attempt: 'Copy/paste blocked',
  context_menu_attempt: 'Right-click blocked',
  websocket_disconnected: 'Connection dropped',
}

function severityOf(event_type) {
  return ['tab_switch', 'face_missing', 'multiple_faces'].includes(event_type) ? 'red' : 'yellow'
}
