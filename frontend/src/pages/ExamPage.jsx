import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import WebcamMonitor from '../components/WebcamMonitor'
import ExamQuestions from '../components/ExamQuestions'
import TimerBar from '../components/TimerBar'
import AlertBanner from '../components/AlertBanner'

const WS_URL = `ws://localhost:3000`

export default function ExamPage() {
  const { exam_id } = useParams()
  const [searchParams] = useSearchParams()
  const studentId = searchParams.get('student_id') || '1'
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | setup | active | submitting | done
  const [alerts, setAlerts] = useState([])
  const [adminMessage, setAdminMessage] = useState(null)
  const [answers, setAnswers] = useState({})
  const [events, setEvents] = useState([])

  const wsRef = useRef(null)
  const alertTimerRef = useRef(null)

  // ─── Load exam data ───────────────────────────────────────────────────────
  useEffect(() => {
    // Use seeded exam from DB; questions come from questions_json
    fetch(`/api/exam/${exam_id}`)
      .then(r => r.json())
      .catch(() => null)
      .then(data => {
        if (data && data.id) {
          setExam({ ...data, questions: JSON.parse(data.questions_json) })
        } else {
          // Fallback demo exam
          setExam({
            id: exam_id,
            title: 'Computer Science 101 Midterm',
            duration: 60,
            questions: [
              { id: 1, text: 'What does CPU stand for?', type: 'short_answer' },
              { id: 2, text: 'Which data structure uses LIFO order?', type: 'short_answer' },
              { id: 3, text: 'What is the time complexity of binary search?', type: 'short_answer' },
              { id: 4, text: 'Explain the difference between RAM and ROM.', type: 'short_answer' },
              { id: 5, text: 'What does HTML stand for?', type: 'short_answer' },
            ]
          })
        }
        setPhase('setup')
      })
  }, [exam_id])

  // ─── Start session & WebSocket ────────────────────────────────────────────
  const startExam = useCallback(async () => {
    setPhase('active')

    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen()
    } catch (_) {}

    // Start session
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: Number(studentId), exam_id: Number(exam_id) }),
    })
    const data = await res.json()
    setSession(data)

    // Connect WebSocket
    const ws = new WebSocket(`${WS_URL}?role=student&sessionId=${data.sessionId}`)
    wsRef.current = ws

    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data)
        if (payload.type === 'admin_warning') {
          setAdminMessage(payload.message)
          setTimeout(() => setAdminMessage(null), 10000)
        }
      } catch (_) {}
    }
  }, [studentId, exam_id])

  // ─── Log proctoring event ────────────────────────────────────────────────
  const logEvent = useCallback((event_type, metadata = {}) => {
    if (!session) return

    const event = { event_type, metadata, timestamp: new Date().toISOString() }
    setEvents(prev => [...prev, event])

    // Show local alert
    const alertMsg = EVENT_LABELS[event_type] || event_type
    setAlerts(prev => [{ id: Date.now(), msg: alertMsg, type: severityOf(event_type) }, ...prev.slice(0, 4)])

    // Send to backend via REST (reliable)
    fetch('/api/event/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.sessionId, event_type, metadata }),
    }).catch(() => {})

    // Also send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'event', event: { event_type, metadata } }))
    }
  }, [session])

  // ─── Tab visibility detection ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const handleVisibility = () => {
      if (document.hidden) logEvent('tab_switch', { hidden: true })
    }
    const handleBlur = () => logEvent('focus_lost', {})
    const handleContextMenu = e => { e.preventDefault(); logEvent('context_menu_attempt', {}) }
    const handleKeydown = e => {
      // Block common shortcuts
      if ((e.ctrlKey || e.metaKey) && ['c','v','a','u','s'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v') {
          logEvent('copy_paste_attempt', { key: e.key })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [phase, logEvent])

  // ─── Submit exam ──────────────────────────────────────────────────────────
  const submitExam = useCallback(async () => {
    setPhase('submitting')
    if (document.fullscreenElement) {
      try { await document.exitFullscreen() } catch (_) {}
    }
    if (wsRef.current) wsRef.current.close()

    const res = await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.sessionId }),
    })
    await res.json()
    navigate(`/admin/report/${session.sessionId}`)
  }, [session, navigate])

  if (phase === 'loading') return <LoadingScreen />
  if (phase === 'setup') return (
    <SetupScreen exam={exam} studentId={studentId} onStart={startExam} />
  )
  if (phase === 'done') return null

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col" onContextMenu={e => e.preventDefault()}>
      {/* Admin Warning Banner */}
      {adminMessage && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-3 px-4 text-center font-semibold flex items-center justify-center gap-2 animate-pulse">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          ⚠️ Admin Warning: {adminMessage}
        </div>
      )}

      {/* Top bar */}
      <header className="bg-navy-800 border-b border-slate-700/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm text-white truncate max-w-xs">{exam?.title}</h1>
            <p className="text-xs text-slate-500">Student ID: {studentId}</p>
          </div>
        </div>

        {exam && session && (
          <TimerBar
            durationMinutes={exam.duration}
            onTimeUp={submitExam}
          />
        )}

        <button
          id="submit-exam-btn"
          onClick={submitExam}
          disabled={phase === 'submitting'}
          className="btn-danger flex items-center gap-2 text-sm"
        >
          {phase === 'submitting' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Submit Exam
            </>
          )}
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Exam questions panel */}
        <main className="flex-1 overflow-y-auto p-6">
          <ExamQuestions
            questions={exam?.questions || []}
            answers={answers}
            onChange={(qid, val) => setAnswers(prev => ({ ...prev, [qid]: val }))}
          />
        </main>

        {/* Right sidebar: Webcam + alerts */}
        <aside className="w-80 border-l border-slate-700/60 flex flex-col bg-navy-800/50">
          <div className="p-4 border-b border-slate-700/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <span className="w-2 h-2 bg-red-500 rounded-full block" />
                <span className="w-2 h-2 bg-red-500 rounded-full block absolute inset-0 ping-slow" />
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Monitoring</span>
            </div>
            <WebcamMonitor
              active={phase === 'active'}
              sessionId={session?.sessionId}
              onEvent={logEvent}
            />
          </div>

          {/* Event log */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Event Log</h3>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No events logged yet...</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(a => (
                  <AlertBanner key={a.id} msg={a.msg} type={a.type} />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading exam...</p>
      </div>
    </div>
  )
}

function SetupScreen({ exam, studentId, onStart }) {
  const [camReady, setCamReady] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        setCamReady(true)
      })
      .catch(() => setCamReady(false))
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-navy-900 grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="card-glow">
          <h2 className="text-2xl font-bold text-white mb-1">Pre-Exam Setup</h2>
          <p className="text-slate-400 text-sm mb-6">Verify your camera before starting <span className="text-blue-400 font-medium">{exam?.title}</span>.</p>

          {/* Camera preview */}
          <div className="relative bg-black rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!camReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-navy-900/80">
                <div className="text-center">
                  <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <p className="text-sm text-slate-400">Camera access required</p>
                </div>
              </div>
            )}
            {camReady && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-white">LIVE</span>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-2 mb-6">
            {[
              { label: 'Camera access granted', ok: camReady },
              { label: 'Stable internet connection', ok: true },
              { label: 'Quiet environment', ok: true },
              { label: 'No unauthorized materials nearby', ok: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${item.ok ? 'bg-emerald-600/30 border border-emerald-600/50' : 'bg-red-600/30 border border-red-600/50'}`}>
                  {item.ok
                    ? <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    : <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  }
                </div>
                <span className={item.ok ? 'text-slate-300' : 'text-red-400'}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-950/40 border border-amber-700/40 rounded-lg mb-6 text-xs text-amber-300">
            ⚠️ By starting, you agree that this exam will monitor your face, tab switching, and keyboard activity. Any suspicious behaviour will be flagged.
          </div>

          <button
            id="begin-exam-btn"
            onClick={onStart}
            disabled={!camReady}
            className="btn-primary w-full text-base py-3"
          >
            Begin Exam — {exam?.duration} min
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const EVENT_LABELS = {
  tab_switch: '🔴 Tab switched away',
  focus_lost: '🟡 Window focus lost',
  face_missing: '🔴 Face not detected',
  multiple_faces: '🔴 Multiple faces detected',
  copy_paste_attempt: '🟡 Copy/paste blocked',
  context_menu_attempt: '🟡 Right-click blocked',
  websocket_disconnected: '🟡 Connection interrupted',
}

function severityOf(event_type) {
  if (['tab_switch', 'face_missing', 'multiple_faces'].includes(event_type)) return 'red'
  return 'yellow'
}
