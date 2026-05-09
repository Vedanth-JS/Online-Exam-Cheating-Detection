import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ProctorView from '../components/ProctorView';
import { useLockdown } from '../hooks/useLockdown';
import { useAudioMonitor } from '../hooks/useAudioMonitor';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const ExamPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { exam_id } = useParams();
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('student_id') || '1';

  const [examData, setExamData]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [answers, setAnswers]       = useState({});
  const [timeLeft, setTimeLeft]     = useState(3600);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [violations, setViolations] = useState([]);
  const [currentQ, setCurrentQ]    = useState(0);
  const [sessionId, setSessionId]  = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [adminAlert, setAdminAlert] = useState(null);
  const wsRef = useRef(null);

  // ── Init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [sessRes, examRes] = await Promise.all([
          fetch('/api/session/start', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId, exam_id }),
          }),
          fetch(`/api/exams/${exam_id}`),
        ]);
        const sessData = await sessRes.json();
        const examD    = await examRes.json();
        if (sessRes.ok && sessData.sessionId) setSessionId(sessData.sessionId);
        if (examRes.ok) { setExamData(examD); setTimeLeft((examD.duration_minutes || 60) * 60); }
        else alert('Exam not found!');
      } catch {
        alert('Could not connect to the server. Please check the backend is running.');
      }
      setLoading(false);
    };
    init();
  }, [exam_id, studentId]);

  // ── WebSocket ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ws = new WebSocket(`ws://localhost:3000?role=student&sessionId=${sessionId}`);
    wsRef.current = ws;
    ws.onmessage = (msg) => {
      try {
        const p = JSON.parse(msg.data);
        if (p.type === 'admin_warning') {
          setAdminAlert(p.message);
          setTimeout(() => setAdminAlert(null), 8000);
          addViolation('admin_warning', 'high', `Admin: ${p.message}`);
        }
      } catch (_) {}
    };
    return () => ws.close();
  }, [sessionId]);

  // ── Timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examData || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [examData, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && examData && !isSubmitted) handleSubmit();
  }, [timeLeft]);

  const fmt = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  // ── Violations ──────────────────────────────────────────────────────
  const logEvent = useCallback(async (type, meta = {}) => {
    if (!sessionId) return;
    try {
      await fetch('/api/event/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, event_type: type, metadata: meta }),
      });
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: 'event', event: { event_type: type, metadata: meta, timestamp: new Date().toISOString() } }));
    } catch (_) {}
  }, [sessionId]);

  const addViolation = (type, severity, message) =>
    setViolations(p => [{ type, severity, message, time: new Date() }, ...p]);

  const handleViolation = useCallback((type, severity, message) => {
    addViolation(type, severity, message);
    logEvent(type, { severity, message });
  }, [logEvent]);

  const { requestFullscreen, isFullscreen } = useLockdown(handleViolation, containerRef);
  useAudioMonitor(handleViolation);

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitted) return;
    setIsSubmitted(true);
    setShowSubmitModal(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (sessionId) {
      try {
        await fetch('/api/session/end', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (_) {}
    }
  };

  // ── Score ───────────────────────────────────────────────────────────
  const calcScore = () => {
    let s = 0;
    examData?.questions?.forEach((q, i) => {
      if (q.options?.[answers[i]] === q.correct_answer) s++;
    });
    return s;
  };

  const isLowTime   = timeLeft < 300;
  const isCritical  = timeLeft < 60;
  const questions   = examData?.questions || [];
  const answered    = Object.keys(answers).length;
  const progress    = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const highViolations = violations.filter(v => v.severity === 'high').length;

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading || !examData) return (
    <div className="min-h-screen hex-bg flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative w-16 h-16 mx-auto">
          <div className="w-16 h-16 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-2 border-2 border-purple-500/20 border-b-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="text-slate-400 heading font-semibold">Initializing Secure Exam Environment…</p>
        <p className="text-xs text-slate-600">Connecting to proctoring service</p>
      </div>
    </div>
  );

  // ── Submitted ───────────────────────────────────────────────────────
  if (isSubmitted) {
    const total = questions.length || 1;
    const finalScore = calcScore();
    const pct   = Math.round((finalScore / total) * 100);
    const grade = pct >= 80 ? { label: 'Excellent', icon: '🏆', color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' }
                : pct >= 60 ? { label: 'Passed',    icon: '✅', color: 'text-blue-400',    bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' }
                :              { label: 'Needs Work', icon: '📚', color: 'text-amber-400',   bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' };

    return (
      <div className="min-h-screen hex-bg flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-4 fade-in">
          {/* Score card */}
          <div className="card-glow text-center py-10">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center text-5xl"
              style={{ background: grade.bg, border: `2px solid ${grade.border}` }}>
              {grade.icon}
            </div>
            <h1 className="text-3xl font-black heading text-white mb-1">Exam Submitted</h1>
            <p className="text-slate-500 text-sm mb-8">Session closed · Results recorded</p>

            {/* Score ring */}
            <div className="relative w-36 h-36 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#0f2344" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={grade.border} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black heading ${grade.color}`}>{pct}%</span>
                <span className="text-xs text-slate-500">{finalScore}/{total}</span>
              </div>
            </div>

            <p className={`text-xl font-bold heading ${grade.color} mb-1`}>{grade.label}</p>
            <p className="text-xs text-slate-600">{violations.length} integrity event{violations.length !== 1 ? 's' : ''} logged</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Score', value: `${finalScore}/${total}`, color: grade.color },
              { label: 'Answered', value: `${answered}/${total}` },
              { label: 'Violations', value: violations.length, color: violations.length > 0 ? 'text-red-400' : 'text-emerald-400' },
            ].map(({ label, value, color = 'text-white' }) => (
              <div key={label} className="glass p-4 text-center rounded-2xl">
                <p className={`text-2xl font-black heading ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/')} className="btn-ghost w-full py-4 text-base font-bold">
            ← Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Fullscreen Gate ─────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="min-h-screen hex-bg text-slate-100 flex overflow-hidden" style={{ height: '100vh' }}>

      {/* Admin alert banner */}
      {adminAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 slide-in">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border border-red-500/40 text-red-200 text-sm font-semibold shadow-2xl"
            style={{ background: 'rgba(127,29,29,0.9)', backdropFilter: 'blur(20px)' }}>
            <span className="text-lg animate-pulse">🚨</span>
            {adminAlert}
            <button onClick={() => setAdminAlert(null)} className="ml-2 text-red-300 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {!isFullscreen ? (
        /* ── Fullscreen required gate ─────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 fade-in">
            <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              🔒
            </div>
            <div>
              <h2 className="text-3xl font-black heading text-red-400 mb-2">Secure Mode Required</h2>
              <p className="text-slate-400 leading-relaxed">
                This exam runs in fullscreen lockdown mode. Tab switching, copy-paste, and window focus
                events are monitored and reported to the proctor.
              </p>
            </div>
            <div className="glass p-4 rounded-2xl text-left space-y-2">
              {[
                ['🎥', 'Webcam is being recorded'],
                ['🎙', 'Audio activity is monitored'],
                ['🖥', 'Tab switches are flagged'],
                ['📋', 'Copy/paste is blocked'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3 text-sm text-slate-400">
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
            <button onClick={requestFullscreen} className="btn-danger w-full py-4 text-base font-bold flex items-center justify-center gap-2">
              🔒 Enter Lockdown Mode
            </button>
            <p className="text-xs text-slate-600">Exam: {examData?.title} · {questions.length} questions · {examData?.duration_minutes} min</p>
          </div>
        </div>

      ) : (
        /* ── Exam interface ─────────────────────────────────────────── */
        <div className="flex w-full h-full overflow-hidden">

          {/* ── Left sidebar ─────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3 p-4 border-r border-white/5 overflow-y-auto"
            style={{ background: 'rgba(6,13,26,0.95)' }}>

            {/* Exam info */}
            <div className="glass p-3 rounded-xl">
              <p className="text-xs text-slate-500 mb-0.5">Exam</p>
              <p className="font-bold text-white text-sm heading truncate">{examData?.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge-info text-xs">● LIVE</span>
                {highViolations > 0 && <span className="badge-risk text-xs">{highViolations} flags</span>}
              </div>
            </div>

            {/* Timer */}
            <div className={`p-4 rounded-xl border text-center ${
              isCritical ? 'border-red-500/50 animate-pulse' : isLowTime ? 'border-amber-500/40' : 'border-white/10'
            }`} style={{ background: isCritical ? 'rgba(127,29,29,0.4)' : isLowTime ? 'rgba(120,53,15,0.3)' : 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs text-slate-500 mb-1">Time Remaining</p>
              <p className={`text-3xl font-black mono ${isCritical ? 'text-red-400' : isLowTime ? 'text-amber-400' : 'text-white'}`}>
                {fmt(timeLeft)}
              </p>
              {isLowTime && <p className="text-xs text-amber-400 mt-1">⚠ Time running out</p>}
            </div>

            {/* Progress */}
            <div className="glass p-3 rounded-xl">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Progress</span><span>{answered}/{questions.length}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-600 mt-1">{progress}% complete</p>
            </div>

            {/* Question navigator */}
            <div className="glass p-3 rounded-xl flex-shrink-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Questions</p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((_, i) => (
                  <button key={i} onClick={() => setCurrentQ(i)}
                    className={`h-8 rounded-lg text-xs font-bold transition-all ${
                      i === currentQ
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                        : answers[i] !== undefined
                          ? 'text-emerald-300'
                          : 'text-slate-500 hover:text-white'
                    }`}
                    style={{
                      background: i === currentQ ? undefined : answers[i] !== undefined
                        ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${i === currentQ ? 'transparent' : answers[i] !== undefined ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Webcam */}
            <div className="flex-shrink-0">
              <ProctorView onViolation={handleViolation} />
            </div>

            {/* Violations feed */}
            <div className="flex-1 glass p-3 rounded-xl overflow-hidden flex flex-col min-h-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex-shrink-0">
                Integrity Log · <span className={violations.length > 0 ? 'text-red-400' : 'text-emerald-400'}>{violations.length}</span>
              </p>
              <div className="overflow-y-auto space-y-1.5 flex-1">
                {violations.length === 0 ? (
                  <p className="text-xs text-emerald-500 italic">✓ No violations</p>
                ) : violations.map((v, i) => (
                  <div key={i} className="text-xs p-2 rounded-lg"
                    style={{ background: v.severity === 'high' ? 'rgba(127,29,29,0.4)' : 'rgba(120,53,15,0.3)', borderLeft: `2px solid ${v.severity === 'high' ? '#ef4444' : '#f59e0b'}` }}>
                    <p className={`font-bold ${v.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                      {v.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">{v.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main exam area ────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Top bar */}
            <div className="flex items-center justify-between px-8 py-3 border-b border-white/5 flex-shrink-0"
              style={{ background: 'rgba(6,13,26,0.9)' }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-black">EG</div>
                <span className="font-bold heading text-white">{examData?.title}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">Student #{studentId}</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 font-semibold">MONITORED</span>
                </div>
              </div>
            </div>

            {/* Question content */}
            <div className="flex-1 overflow-y-auto px-10 py-8">
              <div className="max-w-3xl mx-auto">
                {/* Question header */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0">
                    {currentQ + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Question {currentQ + 1} of {questions.length}</span>
                      {answers[currentQ] !== undefined && (
                        <span className="text-xs text-emerald-400 font-semibold">● Answered</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Question text */}
                <h2 className="text-xl font-semibold text-white leading-relaxed mb-8 select-none">
                  {questions[currentQ]?.text}
                </h2>

                {/* Options */}
                <div className="space-y-3 select-none">
                  {(questions[currentQ]?.options || []).map((opt, i) => {
                    const isSelected = answers[currentQ] === i;
                    return (
                      <button key={i} onClick={() => setAnswers(p => ({ ...p, [currentQ]: i }))}
                        className="w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 group"
                        style={{
                          background: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                          borderColor: isSelected ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                          boxShadow: isSelected ? '0 0 20px rgba(59,130,246,0.2)' : 'none',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-4">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${
                            isSelected ? 'bg-blue-600 text-white' : 'text-slate-500 group-hover:text-white'
                          }`} style={{ background: isSelected ? undefined : 'rgba(255,255,255,0.06)' }}>
                            {OPTION_LABELS[i]}
                          </span>
                          <span className={`font-medium transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                            {opt}
                          </span>
                          {isSelected && (
                            <span className="ml-auto text-blue-400 flex-shrink-0">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom nav bar */}
            <div className="flex items-center justify-between px-10 py-4 border-t border-white/5 flex-shrink-0"
              style={{ background: 'rgba(6,13,26,0.95)' }}>
              <button disabled={currentQ === 0} onClick={() => setCurrentQ(q => q - 1)}
                className="btn-ghost py-2.5 px-6 disabled:opacity-30 flex items-center gap-2">
                ← Previous
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">{answered} of {questions.length} answered</span>
                {currentQ < questions.length - 1 ? (
                  <button onClick={() => setCurrentQ(q => q + 1)}
                    className="btn-primary py-2.5 px-6 flex items-center gap-2">
                    Next →
                  </button>
                ) : (
                  <button onClick={() => setShowSubmitModal(true)}
                    className="btn-success py-2.5 px-6 flex items-center gap-2">
                    Submit Exam ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit confirmation modal ──────────────────────────────── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="card-glow max-w-sm w-full text-center space-y-5 fade-in">
            <div className="text-4xl">📋</div>
            <div>
              <h3 className="text-xl font-black heading text-white mb-1">Submit Exam?</h3>
              <p className="text-slate-400 text-sm">
                You've answered <span className="text-white font-bold">{answered}/{questions.length}</span> questions.
                This cannot be undone.
              </p>
            </div>
            {answered < questions.length && (
              <div className="alert-yellow text-xs">
                ⚠ {questions.length - answered} question{questions.length - answered !== 1 ? 's' : ''} unanswered
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="btn-ghost flex-1 py-3">Cancel</button>
              <button onClick={handleSubmit} className="btn-success flex-1 py-3 font-bold">Confirm Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamPage;
