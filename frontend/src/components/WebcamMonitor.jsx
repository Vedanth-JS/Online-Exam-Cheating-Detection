import { useEffect, useRef, useState } from 'react'

let blazefaceModel = null
async function loadModel() {
  if (blazefaceModel) return blazefaceModel
  const tf = await import('@tensorflow/tfjs')
  const blazeface = await import('@tensorflow-models/blazeface')
  await tf.ready()
  blazefaceModel = await blazeface.load()
  return blazefaceModel
}

export default function WebcamMonitor({ active, onEvent }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const streamRef = useRef(null)
  const [modelStatus, setModelStatus] = useState('loading')
  const [faceCount, setFaceCount]     = useState(null)
  const [lastCheck, setLastCheck]     = useState(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      })
      .catch(() => setModelStatus('error'))
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [active])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    loadModel().then(model => {
      if (cancelled) return
      setModelStatus('ready')
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const preds = await model.estimateFaces(videoRef.current, false)
          if (cancelled) return
          const count = preds.length
          setFaceCount(count)
          setLastCheck(new Date())
          drawBoxes(canvasRef.current, preds, videoRef.current)
          if (count === 0) onEvent('face_missing', { face_count: 0 })
          else if (count > 1) onEvent('multiple_faces', { face_count: count })
        } catch (e) { console.warn('BlazeFace error', e) }
      }, 2000)
    }).catch(() => { if (!cancelled) setModelStatus('error') })
    return () => { cancelled = true; clearInterval(intervalRef.current) }
  }, [active, onEvent])

  const status = faceCount === null ? { label: 'Initializing', color: '#60a5fa', dot: 'bg-blue-400' }
    : faceCount === 0              ? { label: 'No Face',      color: '#ef4444', dot: 'bg-red-500 animate-pulse' }
    : faceCount === 1              ? { label: 'Face OK',      color: '#10b981', dot: 'bg-emerald-400' }
    :                                { label: `${faceCount} Faces!`, color: '#f59e0b', dot: 'bg-amber-400 animate-pulse' }

  return (
    <div className="space-y-2">
      {/* Camera frame */}
      <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3', border: `2px solid ${status.color}40` }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline style={{ transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: 'scaleX(-1)' }} />

        {/* Scanner line when active */}
        {modelStatus === 'ready' && <div className="scanner-line" />}

        {/* Status overlay bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-2"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
            <span className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>

        {/* Loading overlay */}
        {modelStatus === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: 'rgba(6,13,26,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-400">Loading AI…</p>
          </div>
        )}
        {modelStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(127,29,29,0.5)' }}>
            <p className="text-xs text-red-300 text-center px-3">📷 Camera unavailable</p>
          </div>
        )}

        {/* Corner brackets */}
        {modelStatus === 'ready' && faceCount === 1 && (
          <>
            <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: status.color }} />
            <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: status.color }} />
            <div className="absolute bottom-8 left-1.5 w-4 h-4 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: status.color }} />
            <div className="absolute bottom-8 right-1.5 w-4 h-4 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: status.color }} />
          </>
        )}
      </div>

      {/* Model badge */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-600">BlazeFace AI</span>
        <span className={`font-mono font-semibold ${modelStatus === 'ready' ? 'text-emerald-400' : modelStatus === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
          {modelStatus === 'ready' ? '● Active' : modelStatus === 'error' ? '● Error' : '● Loading'}
        </span>
      </div>
      {lastCheck && (
        <p className="text-xs text-slate-700 px-1">Last scan: {lastCheck.toLocaleTimeString()}</p>
      )}
    </div>
  )
}

function drawBoxes(canvas, preds, video) {
  if (!canvas || !video) return
  const ctx = canvas.getContext('2d')
  canvas.width = video.videoWidth; canvas.height = video.videoHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const ok = preds.length === 1
  preds.forEach(pred => {
    const [x, y] = pred.topLeft, [x2, y2] = pred.bottomRight
    const w = x2 - x, h = y2 - y
    const color = ok ? '#10b981' : '#ef4444'
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)
    // Corner brackets
    const cs = 14; ctx.lineWidth = 3
    ;[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy], i) => {
      ctx.beginPath()
      ctx.moveTo(cx + (i % 2 === 0 ? cs : -cs), cy)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx, cy + (i < 2 ? cs : -cs))
      ctx.stroke()
    })
    // Confidence dot
    ctx.fillStyle = color; ctx.beginPath()
    ctx.arc(x + w / 2, y - 6, 4, 0, Math.PI * 2); ctx.fill()
  })
}
