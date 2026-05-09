import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: '🧠', title: 'YOLOv8 Object Detection', desc: 'Detects phones, books & multiple persons in real-time' },
  { icon: '👁️', title: 'MediaPipe Gaze Tracking', desc: 'Iris-based eye direction analysis for focus monitoring' },
  { icon: '🎙️', title: 'Voice Activity Detection', desc: 'WebRTC VAD flags audio anomalies during silence periods' },
  { icon: '⚡', title: 'Celery + Redis Pipeline', desc: 'Async ML inference across distributed worker nodes' },
  { icon: '🤖', title: 'Gemini AI Reports', desc: 'Auto-generated violation summaries with risk scoring' },
  { icon: '📡', title: 'Real-time WebSocket', desc: 'Sub-100ms alert broadcasting to proctor dashboard' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('1')
  const [examId, setExamId] = useState('1')
  const [apiStatus, setApiStatus] = useState({ node: null, fastapi: null })
  const [activeFeature, setActiveFeature] = useState(0)

  // Check backend status
  useEffect(() => {
    const check = async () => {
      const [node, fastapi] = await Promise.all([
        fetch('/api/sessions/active').then(r => r.ok).catch(() => false),
        fetch('/health').then(r => r.ok).catch(() => false),
      ])
      setApiStatus({ node, fastapi })
    }
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [])

  // Rotate features
  useEffect(() => {
    const t = setInterval(() => setActiveFeature(p => (p + 1) % FEATURES.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen hex-bg flex flex-col overflow-hidden">
      {/* Animated orbs */}
      <div className="orb w-[600px] h-[600px] bg-blue-600/10 top-[-200px] left-[-100px]" style={{ animationDelay: '0s' }} />
      <div className="orb w-[400px] h-[400px] bg-indigo-600/8 top-[20%] right-[-80px]" style={{ animationDelay: '3s' }} />
      <div className="orb w-[300px] h-[300px] bg-cyan-600/6 bottom-[10%] left-[20%]" style={{ animationDelay: '1.5s' }} />

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <span className="text-xl font-bold heading text-white">Exam<span className="text-gradient-blue">Guard</span></span>
        </div>

        <div className="flex items-center gap-4">
          <StatusDot label="Node.js" ok={apiStatus.node} />
          <StatusDot label="FastAPI" ok={apiStatus.fastapi} />
          <button onClick={() => navigate('/admin/dashboard')} className="btn-ghost py-1.5 px-4 text-sm">
            Admin →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-16 max-w-7xl mx-auto px-8 py-16 w-full flex-1">

        {/* Left — headline + portal */}
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="badge-info w-fit">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              v2.0 · Production Grade
            </div>
            <h1 className="text-5xl lg:text-6xl font-black heading leading-tight">
              AI-Powered<br />
              <span className="text-gradient-blue">Exam Proctoring</span><br />
              <span className="text-slate-400 text-3xl font-semibold">at Scale</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-lg leading-relaxed">
              Real-time multi-agent detection using YOLOv8, MediaPipe gaze tracking, 
              and webrtcvad — with instant Gemini AI violation summaries.
            </p>
          </div>

          {/* Live feature ticker */}
          <div className="glass p-4 max-w-sm">
            <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Active Detection Module</p>
            <div className="flex items-center gap-3 fade-in" key={activeFeature}>
              <span className="text-2xl">{FEATURES[activeFeature].icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{FEATURES[activeFeature].title}</p>
                <p className="text-xs text-slate-400">{FEATURES[activeFeature].desc}</p>
              </div>
            </div>
            <div className="flex gap-1 mt-3">
              {FEATURES.map((_, i) => (
                <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i === activeFeature ? 'bg-blue-500' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Right — portal cards */}
        <div className="w-full max-w-md space-y-4">
          {/* Student card */}
          <div className="card-glow hover:border-blue-500/30 transition-all duration-300 group">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-white heading">Student Portal</h2>
                <p className="text-slate-500 text-xs">Enter your proctored exam session</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Student ID</label>
                <input id="student-id-input" type="number" value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  className="input-field text-center text-lg font-bold" placeholder="1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Exam ID</label>
                <input id="exam-id-input" type="number" value={examId}
                  onChange={e => setExamId(e.target.value)}
                  className="input-field text-center text-lg font-bold" placeholder="1" />
              </div>
            </div>

            <button id="start-exam-btn"
              onClick={() => navigate(`/exam/${examId}?student_id=${studentId}`)}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Enter Exam
            </button>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <span>🔒 Webcam + audio monitoring will activate</span>
            </div>
          </div>

          {/* Admin card */}
          <div className="card hover:border-red-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center border border-red-500/20 group-hover:border-red-500/40 transition-colors">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-white heading">Proctor Dashboard</h2>
                  <p className="text-slate-500 text-xs">Live monitoring & AI threat analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 font-medium">LIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              {[
                { icon: '👁', text: 'Live webcam feeds' },
                { icon: '⚡', text: 'Real-time alerts' },
                { icon: '📊', text: 'Threat scoring' },
                { icon: '🤖', text: 'AI exam generator' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-slate-400">
                  <span>{f.icon}</span>{f.text}
                </div>
              ))}
            </div>

            <button id="admin-dashboard-btn"
              onClick={() => navigate('/admin/dashboard')}
              className="btn-danger w-full flex items-center justify-center gap-2">
              Open Dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
          {/* Code Arena card */}
          <div className="card hover:border-purple-500/30 transition-all duration-300 group"
            onClick={() => navigate('/code')} style={{ cursor: 'pointer' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors"
                  style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.25)' }}>
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <h2 className="font-bold text-white heading">Code Arena</h2>
                  <p className="text-slate-500 text-xs">HackerRank-style AI coding challenges</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              {[['Monaco', 'Editor'], ['Auto', 'Judge'], ['Multi', 'Language']].map(([a, b]) => (
                <div key={a} className="text-center py-2 rounded-lg" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <p className="font-bold text-purple-300">{a}</p>
                  <p className="text-slate-500">{b}</p>
                </div>
              ))}
            </div>
            <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold transition-all"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c084fc' }}>
              Open Code Arena →
            </div>
          </div>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div className="relative z-10 border-t border-white/5 px-8 py-4 flex items-center gap-8 text-xs text-slate-600">
        <span className="font-bold text-slate-500">ExamGuard v2.0</span>
        <span>·</span>
        {[
          ['YOLOv8n', 'Object Detection'],
          ['MediaPipe', 'Gaze Analysis'],
          ['webrtcvad', 'Audio VAD'],
          ['Gemini 2.0 Flash', 'AI Reports'],
        ].map(([tech, role]) => (
          <span key={tech} className="hidden md:flex items-center gap-1">
            <span className="text-slate-400 font-medium">{tech}</span>
            <span className="text-slate-700">·</span>
            <span>{role}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function StatusDot({ label, ok }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${ok === null ? 'bg-slate-600 animate-pulse' : ok ? 'bg-emerald-400' : 'bg-red-500'}`} />
      <span className={ok === null ? 'text-slate-600' : ok ? 'text-slate-400' : 'text-red-400'}>{label}</span>
    </div>
  )
}
