export default function ExamQuestions({ questions, answers, onChange }) {
  if (!questions?.length) return (
    <div className="text-slate-500 text-sm italic">No questions loaded.</div>
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-white">Exam Questions</h2>
      {questions.map((q, idx) => (
        <div key={q.id} id={`question-${q.id}`} className="card hover:border-slate-600/80 transition-colors">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-7 h-7 bg-blue-600/20 border border-blue-600/40 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
              {idx + 1}
            </span>
            <p className="text-gray-200 font-medium leading-relaxed">{q.text}</p>
          </div>

          {q.type === 'mcq' && Array.isArray(q.options) ? (
            <div className="space-y-2 pl-10">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    answers[q.id] === opt
                      ? 'bg-blue-600/20 border-blue-500/60 text-blue-200'
                      : 'bg-navy-700/50 border-slate-700/50 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => onChange(q.id, opt)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="pl-10">
              <textarea
                id={`answer-${q.id}`}
                rows={4}
                value={answers[q.id] || ''}
                onChange={e => onChange(q.id, e.target.value)}
                placeholder="Type your answer here..."
                className="w-full bg-navy-700 border border-slate-600 rounded-lg px-4 py-3 text-gray-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors text-sm leading-relaxed"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-slate-600 mono">
                  {(answers[q.id] || '').length} chars
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
