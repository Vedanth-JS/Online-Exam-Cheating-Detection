import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('1')
  const [examId, setExamId] = useState('1')

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* Logo area */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-navy-900" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Exam<span className="text-blue-400">Guard</span>
          </h1>
        </div>
        <p className="text-slate-400 text-sm max-w-sm">
          AI-powered proctoring system with real-time face detection, tab-switch monitoring, and integrity reports.
        </p>
      </div>

      {/* Cards grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Portal Card */}
        <div className="card-glow hover:border-blue-600/50 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center border border-blue-600/30">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Student Portal</h2>
              <p className="text-slate-500 text-xs">Take a proctored exam</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Student ID</label>
              <input
                id="student-id-input"
                type="number"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="input-field"
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Exam ID</label>
              <input
                id="exam-id-input"
                type="number"
                value={examId}
                onChange={e => setExamId(e.target.value)}
                className="input-field"
                placeholder="e.g. 1"
              />
            </div>
          </div>

          <button
            id="start-exam-btn"
            onClick={() => navigate(`/exam/${examId}?student_id=${studentId}`)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            Enter Exam
          </button>
        </div>

        {/* Admin Dashboard Card */}
        <div className="card hover:border-red-600/40 transition-all duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center border border-red-600/30">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Admin Dashboard</h2>
              <p className="text-slate-500 text-xs">Monitor live sessions & alerts</p>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {[
              { icon: '👁', text: 'Live session grid with WebSocket feeds' },
              { icon: '🚨', text: 'Real-time alert notifications' },
              { icon: '📊', text: 'Integrity reports with risk scoring' },
              { icon: '📣', text: 'Broadcast warnings to students' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-slate-400">
                <span className="text-base">{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>

          <button
            id="admin-dashboard-btn"
            onClick={() => navigate('/admin/dashboard')}
            className="btn-danger w-full flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
            Open Dashboard
          </button>
        </div>
      </div>

      {/* Status footer */}
      <div className="mt-8 flex items-center gap-6 text-xs text-slate-600">
        <span>Version 1.0.0</span>
        <span>·</span>
        <span>Backend: localhost:3000</span>
        <span>·</span>
        <span>BlazeFace AI Model</span>
      </div>
    </div>
  )
}
