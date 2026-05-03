import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ProctorView from '../components/ProctorView';
import { useLockdown } from '../hooks/useLockdown';
import { useAudioMonitor } from '../hooks/useAudioMonitor';

const ExamPage = () => {
    const containerRef = useRef(null);
    const { exam_id } = useParams();
    const [searchParams] = useSearchParams();
    const studentId = searchParams.get('student_id') || '1';

    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(3600);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [violations, setViolations] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [sessionId, setSessionId] = useState(null);
    const wsRef = useRef(null);

    // ─── Start session + fetch exam ─────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                // 1. Start proctoring session
                const sessionRes = await fetch('/api/session/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, exam_id }),
                });
                const sessionData = await sessionRes.json();
                if (sessionRes.ok && sessionData.sessionId) {
                    setSessionId(sessionData.sessionId);
                }

                // 2. Fetch exam questions
                const examRes = await fetch(`/api/exams/${exam_id}`);
                const data = await examRes.json();
                if (examRes.ok) {
                    setExamData(data);
                    setTimeLeft((data.duration_minutes || 60) * 60);
                } else {
                    alert('Exam not found!');
                }
            } catch (err) {
                console.error('Failed to initialize exam', err);
                alert('Could not connect to the server. Please check the backend is running.');
            }
            setLoading(false);
        };
        init();
    }, [exam_id, studentId]);

    // ─── WebSocket connection (student side) ────────────────────────────────
    useEffect(() => {
        if (!sessionId) return;
        const ws = new WebSocket(`ws://localhost:3000?role=student&sessionId=${sessionId}`);
        wsRef.current = ws;

        ws.onmessage = (msg) => {
            try {
                const payload = JSON.parse(msg.data);
                if (payload.type === 'admin_warning') {
                    // Display admin warning as an overlay alert
                    setViolations(prev => [{
                        type: 'admin_warning',
                        severity: 'high',
                        message: `⚠ Admin Warning: ${payload.message}`,
                        time: new Date()
                    }, ...prev]);
                }
            } catch (_) {}
        };

        return () => ws.close();
    }, [sessionId]);

    // ─── Timer ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!examData || timeLeft <= 0) return;
        const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timerId);
    }, [examData, timeLeft]);

    // Auto-submit when timer hits zero
    useEffect(() => {
        if (timeLeft === 0 && examData && !isSubmitted) {
            handleSubmit();
        }
    }, [timeLeft]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const isLowTime = timeLeft < 300; // last 5 minutes

    const handleOptionSelect = (optionIndex) => {
        setAnswers(prev => ({ ...prev, [currentQuestion]: optionIndex }));
    };

    // ─── Log violation to backend ────────────────────────────────────────────
    const logEventToBackend = useCallback(async (event_type, metadata = {}) => {
        if (!sessionId) return;
        try {
            await fetch('/api/event/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, event_type, metadata }),
            });
            // Also push via WebSocket for instant admin visibility
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'event', event: { event_type, metadata, timestamp: new Date().toISOString() } }));
            }
        } catch (_) {}
    }, [sessionId]);

    const handleViolation = useCallback((type, severity, message) => {
        setViolations(prev => [{ type, severity, message, time: new Date() }, ...prev]);
        logEventToBackend(type, { severity, message });
    }, [logEventToBackend]);

    const { requestFullscreen, isFullscreen } = useLockdown(handleViolation, containerRef);
    useAudioMonitor(handleViolation);

    // ─── Submit exam ─────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (isSubmitted) return;

        let calculatedScore = 0;
        if (examData?.questions) {
            examData.questions.forEach((q, i) => {
                const selectedText = q.options?.[answers[i]];
                if (selectedText === q.correct_answer) {
                    calculatedScore += 1;
                }
            });
        }
        setScore(calculatedScore);
        setIsSubmitted(true);

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        // End session on backend
        if (sessionId) {
            try {
                await fetch('/api/session/end', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId }),
                });
            } catch (_) {}
        }
    };

    // ─── Render: Loading ─────────────────────────────────────────────────────
    if (loading || !examData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
                <div className="text-center space-y-4">
                    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-400">Loading exam data...</p>
                </div>
            </div>
        );
    }

    // ─── Render: Submitted ───────────────────────────────────────────────────
    if (isSubmitted) {
        const total = examData.questions?.length || 1;

        // Recalculate score from answers for the result screen
        let finalScore = 0;
        examData.questions?.forEach((q, i) => {
            const selectedText = q.options?.[answers[i]];
            if (selectedText === q.correct_answer) finalScore++;
        });

        const pct = Math.round((finalScore / total) * 100);
        const grade = pct >= 80 ? '🏆 Excellent' : pct >= 60 ? '✅ Passed' : '⚠️ Needs Improvement';

        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 max-w-md w-full text-center shadow-2xl">
                    <div className="w-24 h-24 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-5xl">🎯</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Exam Submitted!</h1>
                    <p className="text-slate-400 mb-8">Your responses have been recorded and the session is closed.</p>

                    <div className="bg-slate-800/50 rounded-2xl p-6 mb-4">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Final Score</div>
                        <div className="text-5xl font-bold text-blue-400 mb-2">{finalScore} <span className="text-2xl text-slate-500">/ {total}</span></div>
                        <div className="text-slate-400 mb-1">{pct}% Accuracy</div>
                        <div className="text-sm font-semibold mt-2">{grade}</div>
                    </div>

                    <div className="text-xs text-slate-600 mb-6">
                        {violations.length} violation{violations.length !== 1 ? 's' : ''} logged during session
                    </div>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 transition-colors rounded-xl font-bold uppercase tracking-widest"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    const questions = examData.questions || [];

    // ─── Render: Fullscreen gate ─────────────────────────────────────────────
    return (
        <div ref={containerRef} className="min-h-screen bg-slate-950 text-slate-100 flex p-6 gap-6 overflow-y-auto">
            {!isFullscreen ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="max-w-md text-center space-y-6">
                        <div className="w-16 h-16 bg-red-900/20 border border-red-800/40 rounded-2xl flex items-center justify-center mx-auto">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <h2 className="text-3xl font-bold text-red-400">Security Check Required</h2>
                        <p className="text-slate-400">To maintain exam integrity, this exam must be taken in fullscreen mode. Your browser activity is being monitored.</p>
                        <button
                            onClick={requestFullscreen}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 transition-colors rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-red-900/20"
                        >
                            Enter Lockdown Mode
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Left Sidebar — Proctoring */}
                    <div className="w-80 flex flex-col gap-6 shrink-0">
                        <ProctorView onViolation={handleViolation} />

                        {/* Question Navigator */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Questions</h3>
                            <div className="grid grid-cols-5 gap-2">
                                {questions.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentQuestion(i)}
                                        className={`h-9 w-full rounded-lg text-xs font-bold transition-all ${
                                            i === currentQuestion
                                                ? 'bg-blue-600 text-white'
                                                : answers[i] !== undefined
                                                    ? 'bg-emerald-900/60 border border-emerald-700/50 text-emerald-300'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 text-xs text-slate-500">
                                {Object.keys(answers).length} / {questions.length} answered
                            </div>
                        </div>

                        {/* Integrity Feed */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex-1 overflow-auto">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Integrity Feed</h3>
                            <div className="space-y-2">
                                {violations.slice().reverse().map((v, i) => (
                                    <div key={i} className="text-xs p-2.5 bg-red-900/10 border border-red-900/30 rounded-lg">
                                        <span className="text-red-400 font-bold block">{v.type.replace(/_/g, ' ')}</span>
                                        <p className="text-slate-400 mt-0.5">{v.message}</p>
                                    </div>
                                ))}
                                {violations.length === 0 && <p className="text-xs text-slate-500 italic">No violations detected.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Main Question Area */}
                    <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-10 flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h1 className="text-2xl font-bold">{examData.title}</h1>
                                <p className="text-slate-400 text-sm mt-1">{examData.description}</p>
                            </div>
                            <div className={`px-5 py-2 rounded-full font-mono border ${
                                isLowTime
                                    ? 'bg-red-900/30 border-red-700 text-red-400 animate-pulse'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>

                        {/* Question */}
                        <div className="flex-1 select-none">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                                    Question {currentQuestion + 1} of {questions.length}
                                </span>
                                {answers[currentQuestion] !== undefined && (
                                    <span className="text-xs text-emerald-400">✓ Answered</span>
                                )}
                            </div>
                            <h2 className="text-xl font-medium mb-8 leading-relaxed">
                                {questions[currentQuestion]?.text}
                            </h2>

                            <div className="grid grid-cols-1 gap-3">
                                {(questions[currentQuestion]?.options || []).map((opt, i) => {
                                    const isSelected = answers[currentQuestion] === i;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleOptionSelect(i)}
                                            className={`w-full text-left p-5 rounded-2xl border-2 transition-all group ${
                                                isSelected
                                                    ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-900/20'
                                                    : 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-600'
                                            }`}
                                        >
                                            <span className={`inline-block w-8 font-bold ${isSelected ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`}>
                                                {String.fromCharCode(65 + i)}.
                                            </span>
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="mt-8 flex justify-between gap-4">
                            <button
                                className="px-8 py-4 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors text-slate-400 disabled:opacity-30"
                                disabled={currentQuestion === 0}
                                onClick={() => setCurrentQuestion(q => q - 1)}
                            >
                                ← Previous
                            </button>
                            <div className="flex gap-3">
                                {currentQuestion < questions.length - 1 ? (
                                    <button
                                        className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors font-bold"
                                        onClick={() => setCurrentQuestion(q => q + 1)}
                                    >
                                        Save & Next →
                                    </button>
                                ) : (
                                    <button
                                        className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors font-bold"
                                        onClick={handleSubmit}
                                    >
                                        Submit Exam ✓
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ExamPage;
