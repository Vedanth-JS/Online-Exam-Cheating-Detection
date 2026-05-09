import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const LANGUAGES = [
  { id: 'c',          label: 'C',          monaco: 'c',          icon: 'C' },
  { id: 'cpp',        label: 'C++',        monaco: 'cpp',        icon: 'C++' },
  { id: 'java',       label: 'Java',       monaco: 'java',       icon: '☕' },
  { id: 'python',     label: 'Python 3',   monaco: 'python',     icon: '🐍' },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', icon: '🟨' },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript', icon: '🟦' },
  { id: 'go',         label: 'Go',         monaco: 'go',         icon: '🐹' },
  { id: 'rust',       label: 'Rust',       monaco: 'rust',       icon: '🦀' },
  { id: 'csharp',     label: 'C#',         monaco: 'csharp',     icon: 'C#' },
  { id: 'php',        label: 'PHP',        monaco: 'php',        icon: '🐘' },
  { id: 'ruby',       label: 'Ruby',       monaco: 'ruby',       icon: '💎' },
  { id: 'kotlin',     label: 'Kotlin',     monaco: 'kotlin',     icon: 'K' },
  { id: 'swift',      label: 'Swift',      monaco: 'swift',      icon: '🦅' },
  { id: 'bash',       label: 'Bash',       monaco: 'shell',      icon: '🐚' },
];

const DIFF_COLOR = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444' };

// ── Markdown-lite renderer (bold, inline-code, newlines) ─────────────────────
function MarkdownText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="px-1.5 py-0.5 rounded text-blue-300 text-xs font-mono" style={{ background: 'rgba(59,130,246,0.15)' }}>{p.slice(1, -1)}</code>;
        if (p === '\n') return <br key={i} />;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    accepted:     { label: 'Accepted',     bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', color: '#34d399' },
    wrong_answer: { label: 'Wrong Answer', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  color: '#f87171' },
    error:        { label: 'Error',        bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  color: '#f87171' },
    pending:      { label: 'Pending',      bg: 'rgba(100,116,139,0.15)',border: 'rgba(100,116,139,0.4)',color: '#94a3b8' },
    running:      { label: 'Running…',     bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#60a5fa' },
  }[status] || { label: status, bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', color: '#94a3b8' };
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export default function CodingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  // Problem list + selected problem
  const [problems, setProblems]         = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [problem, setProblem]           = useState(null);
  const [problemLoading, setProblemLoading] = useState(false);

  // Editor
  const [language, setLanguage]         = useState('javascript');
  const [code, setCode]                 = useState('');
  const editorRef = useRef(null);

  // Run / Submit state
  const [activeTab, setActiveTab]       = useState('testcases'); // testcases | results | console
  const [testResults, setTestResults]   = useState([]);
  const [submitResult, setSubmitResult] = useState(null);
  const [runLoading, setRunLoading]     = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [consoleOut, setConsoleOut]     = useState('');
  const [customInput, setCustomInput]   = useState('');
  const [panelHeight, setPanelHeight]   = useState(220);
  const dragging = useRef(false);
  const dragStart = useRef(0);
  const heightStart = useRef(0);

  // ── Load problem list ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/code/problems')
      .then(r => r.json())
      .then(data => { setProblems(data); if (data.length) setSelectedId(data[0].id); })
      .catch(() => {});
  }, []);

  // ── Load selected problem ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setProblemLoading(true);
    setTestResults([]);
    setSubmitResult(null);
    setConsoleOut('');
    fetch(`/api/code/problems/${selectedId}`)
      .then(r => r.json())
      .then(p => {
        setProblem(p);
        setCode(p.starterCode?.[language] || '// Write your solution here');
        setProblemLoading(false);
      })
      .catch(() => setProblemLoading(false));
  }, [selectedId]);

  // ── Switch language ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (problem) setCode(problem.starterCode?.[language] || '// Write your solution here');
  }, [language]);

  // ── Run ─────────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    setRunLoading(true);
    setActiveTab('results');
    setTestResults(problem?.testCases?.map((_, i) => ({ id: i + 1, status: 'running' })) || []);
    try {
      const r = await fetch('/api/code/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, problemId: selectedId }),
      });
      const data = await r.json();
      setTestResults(data.results || []);
    } catch (e) {
      setConsoleOut('Network error: ' + e.message);
      setActiveTab('console');
    }
    setRunLoading(false);
  }, [code, language, selectedId, problem]);

  // ── Run Custom Input ────────────────────────────────────────────────────────
  const handleDebugCustom = useCallback(async () => {
    setRunLoading(true);
    setConsoleOut('Compiling and running...');
    try {
      const r = await fetch('/api/code/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, problemId: selectedId, customInput }),
      });
      const data = await r.json();
      if (data.status === 'compile_error' || data.status === 'error' || data.status === 'runtime_error') {
        setConsoleOut(`[ERROR - ${data.status}]\n${data.stderr}`);
      } else {
        setConsoleOut(data.stdout || 'Process exited with no output.');
      }
    } catch (e) {
      setConsoleOut('Network error: ' + e.message);
    }
    setRunLoading(false);
  }, [code, language, selectedId, customInput]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setSubmitLoading(true);
    setActiveTab('results');
    try {
      const r = await fetch('/api/code/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, problemId: selectedId, sessionId }),
      });
      const data = await r.json();
      setSubmitResult(data);
      setTestResults(data.results || []);
    } catch (e) {
      setConsoleOut('Submit failed: ' + e.message);
      setActiveTab('console');
    }
    setSubmitLoading(false);
  }, [code, language, selectedId, sessionId]);

  // ── Drag resize bottom panel ────────────────────────────────────────────────
  const onDragStart = (e) => {
    dragging.current = true;
    dragStart.current = e.clientY;
    heightStart.current = panelHeight;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  };
  const onDragMove = (e) => {
    if (!dragging.current) return;
    const delta = dragStart.current - e.clientY;
    setPanelHeight(Math.max(120, Math.min(500, heightStart.current + delta)));
  };
  const onDragEnd = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  };

  // ── Verdict banner ──────────────────────────────────────────────────────────
  const VerdictBanner = ({ result }) => {
    if (!result) return null;
    const isAC = result.verdict === 'Accepted';
    const isPartial = result.verdict === 'Partial';
    return (
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl mb-3" style={{
        background: isAC ? 'rgba(16,185,129,0.1)' : isPartial ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isAC ? 'rgba(16,185,129,0.3)' : isPartial ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
      }}>
        <span className="text-2xl">{isAC ? '🏆' : isPartial ? '⚡' : '❌'}</span>
        <div>
          <p className="font-bold text-sm" style={{ color: isAC ? '#34d399' : isPartial ? '#fbbf24' : '#f87171' }}>
            {result.verdict}
          </p>
          <p className="text-xs text-slate-400">{result.passed}/{result.total} test cases passed · Score: {result.score}%</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-200" style={{ background: '#0a0f1e', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Left: Problem Panel ────────────────────────────────────────────── */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0d1526' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(6,13,26,0.95)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-black">EG</div>
            <span className="font-bold text-white text-sm">Code Arena</span>
          </div>
          <button onClick={() => navigate('/')} className="text-xs text-slate-500 hover:text-white transition-colors">← Exit</button>
        </div>

        {/* Problem selector */}
        <div className="flex gap-1 p-2 border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {problems.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedId === p.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selectedId === p.id ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.07)'}`,
                color: selectedId === p.id ? '#60a5fa' : '#94a3b8',
              }}>
              {p.title}
            </button>
          ))}
        </div>

        {/* Problem content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {problemLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : problem ? (
            <>
              {/* Title row */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: DIFF_COLOR[problem.difficulty], background: `${DIFF_COLOR[problem.difficulty]}18` }}>
                    {problem.difficulty}
                  </span>
                  {problem.tags?.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded text-slate-400" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>{t}</span>
                  ))}
                </div>
                <h1 className="text-lg font-black text-white">{problem.title}</h1>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-300 leading-relaxed">
                <MarkdownText text={problem.description} />
              </p>

              {/* Examples */}
              {problem.examples?.map((ex, i) => (
                <div key={i}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Example {i + 1}</p>
                  <div className="rounded-xl p-3 space-y-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div><span className="text-slate-500 font-semibold">Input: </span><code className="text-blue-300 font-mono">{ex.input}</code></div>
                    <div><span className="text-slate-500 font-semibold">Output: </span><code className="text-emerald-300 font-mono">{ex.output}</code></div>
                    {ex.explanation && <div className="text-slate-500 pt-0.5"><span className="font-semibold">Explanation: </span>{ex.explanation}</div>}
                  </div>
                </div>
              ))}

              {/* Constraints */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Constraints</p>
                <ul className="space-y-1">
                  {problem.constraints?.map((c, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <code className="font-mono">{c}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Select a problem to begin.</p>
          )}
        </div>
      </div>

      {/* ── Right: Editor + Results ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Editor toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(6,13,26,0.95)' }}>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar flex-1 mr-4">
            {LANGUAGES.map(l => (
              <button key={l.id} onClick={() => setLanguage(l.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: language === l.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${language === l.id ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.07)'}`,
                  color: language === l.id ? '#60a5fa' : '#94a3b8',
                }}>
                <span>{l.icon}</span>{l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleRun} disabled={runLoading || submitLoading || !problem}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}>
              {runLoading && activeTab !== 'console' ? <span className="w-3 h-3 border border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" /> : '▶'}
              {runLoading && activeTab !== 'console' ? 'Checking…' : 'Check Tests'}
            </button>
            <button onClick={handleSubmit} disabled={runLoading || submitLoading || !problem}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)', color: '#60a5fa' }}>
              {submitLoading ? <span className="w-3 h-3 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin" /> : '⬆'}
              {submitLoading ? 'Submitting…' : 'Submit Code'}
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <Editor
            height="100%"
            language={LANGUAGES.find(l => l.id === language)?.monaco || 'javascript'}
            value={code}
            onChange={v => setCode(v || '')}
            onMount={e => { editorRef.current = e; }}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              tabSize: 4,
              automaticLayout: true,
              padding: { top: 16 },
              bracketPairColorization: { enabled: true },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'all',
            }}
          />
        </div>

        {/* ── Drag handle ─────────────────────────────────────────────────── */}
        <div onMouseDown={onDragStart}
          className="flex-shrink-0 flex items-center justify-center cursor-row-resize select-none"
          style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-10 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* ── Bottom panel: Test Cases / Results / Console ─────────────────── */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ height: panelHeight, background: '#0d1526' }}>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-2 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {[
              { id: 'testcases', label: 'Test Cases' },
              { id: 'results',   label: `Results ${testResults.length ? `(${testResults.filter(r => r.passed).length}/${testResults.length})` : ''}` },
              { id: 'console',   label: 'Compile & Debug' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="pb-2 px-3 text-xs font-semibold transition-all border-b-2"
                style={{
                  borderColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
                  color: activeTab === tab.id ? '#60a5fa' : '#64748b',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* Test Cases tab */}
            {activeTab === 'testcases' && (
              <div className="space-y-3">
                {problem?.testCases?.map((tc, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs text-slate-500 font-bold mb-2">Case {i + 1}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <p className="text-slate-500 mb-1">Input</p>
                        <code className="text-blue-300 whitespace-pre-wrap">{tc.stdin || tc.input}</code>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Expected</p>
                        <code className="text-emerald-300 whitespace-pre-wrap">{tc.expected}</code>
                      </div>
                    </div>
                  </div>
                ))}
                {!problem && <p className="text-slate-600 text-xs">Select a problem to view test cases.</p>}
              </div>
            )}

            {/* Results tab */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                <VerdictBanner result={submitResult} />
                {testResults.length === 0 && (
                  <p className="text-slate-600 text-xs">Check or Submit your code to see results.</p>
                )}
                {testResults.map((r, i) => (
                  <div key={i} className="rounded-xl p-4 flex items-start gap-3" style={{
                    background: r.passed ? 'rgba(16,185,129,0.06)' : r.status === 'running' ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${r.passed ? 'rgba(16,185,129,0.2)' : r.status === 'running' ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    <span className="text-base mt-0.5">{r.passed ? '✅' : r.status === 'running' ? '⏳' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-white">
                          {r.hidden ? `Hidden Test ${r.id}` : `Test Case ${r.id}`}
                        </span>
                        <StatusBadge status={r.status || 'pending'} />
                      </div>
                      {!r.hidden && r.input && (
                        <div className="grid grid-cols-3 gap-4 text-xs font-mono mt-2 bg-black/20 p-3 rounded border border-white/5">
                          <div><span className="text-slate-500 block mb-1">Input:</span><span className="text-blue-300 block whitespace-pre-wrap">{r.input}</span></div>
                          <div><span className="text-slate-500 block mb-1">Expected:</span><span className="text-emerald-300 block whitespace-pre-wrap">{r.expected}</span></div>
                          <div><span className="text-slate-500 block mb-1">Got:</span><span className={`block whitespace-pre-wrap ${r.passed ? 'text-emerald-300' : 'text-red-400'}`}>{r.actual || '—'}</span></div>
                        </div>
                      )}
                      {r.error && (
                        <div className="mt-3 bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                           <p className="text-xs text-red-500 font-bold mb-1">Compilation / Runtime Error:</p>
                           <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap overflow-x-auto">{r.error}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Console tab */}
            {activeTab === 'console' && (
              <div className="space-y-3 h-full flex flex-col">
                <div>
                  <label className="text-xs text-slate-500 font-semibold block mb-1">Custom Input</label>
                  <textarea
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="Enter custom stdin here…"
                    rows={3}
                    className="w-full text-xs font-mono text-slate-300 rounded-lg px-3 py-2 resize-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
                {consoleOut && (
                  <div className="flex-1 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-auto" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <pre className="whitespace-pre-wrap">{consoleOut}</pre>
                  </div>
                )}
                {!consoleOut && <p className="text-slate-600 text-xs">Console output will appear here.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
