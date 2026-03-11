import { useState, useEffect, useRef } from 'react'

export default function TimerBar({ durationMinutes, onTimeUp }) {
  const totalSeconds = durationMinutes * 60
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const calledRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!calledRef.current) {
            calledRef.current = true
            onTimeUp()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onTimeUp])

  const pct = (secondsLeft / totalSeconds) * 100
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const isWarning = secondsLeft < 300 // < 5 min
  const isDanger = secondsLeft < 60   // < 1 min

  const barColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="flex flex-col items-center gap-1 min-w-[120px]">
      <div className={`mono font-bold text-lg ${textColor} ${isDanger ? 'animate-pulse' : ''}`}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">remaining</span>
    </div>
  )
}
