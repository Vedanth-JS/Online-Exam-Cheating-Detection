import { useEffect, useRef, useState } from 'react'

// TensorFlow.js + BlazeFace loaded asynchronously to keep bundle fast on slow connections
let blazefaceModel = null

async function loadModel() {
  if (blazefaceModel) return blazefaceModel
  const tf = await import('@tensorflow/tfjs')
  const blazeface = await import('@tensorflow-models/blazeface')
  await tf.ready()
  blazefaceModel = await blazeface.load()
  return blazefaceModel
}

export default function WebcamMonitor({ active, sessionId, onEvent }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const streamRef = useRef(null)

  const [modelStatus, setModelStatus] = useState('loading') // loading | ready | error
  const [faceCount, setFaceCount] = useState(null)

  // Start camera
  useEffect(() => {
    if (!active) return
    let cancelled = false

    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => setModelStatus('error'))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [active])

  // Load model and start detection loop
  useEffect(() => {
    if (!active) return
    let cancelled = false

    loadModel()
      .then(model => {
        if (cancelled) return
        setModelStatus('ready')

        // Run detection every 2 seconds
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return
          try {
            const predictions = await model.estimateFaces(videoRef.current, false)
            if (cancelled) return
            
            const count = predictions.length
            setFaceCount(count)
            drawBoxes(canvasRef.current, predictions, videoRef.current)

            if (count === 0) {
              onEvent('face_missing', { face_count: 0 })
            } else if (count > 1) {
              onEvent('multiple_faces', { face_count: count })
            }
          } catch (err) {
            console.warn('BlazeFace detection error', err)
          }
        }, 2000)
      })
      .catch(() => {
        if (!cancelled) setModelStatus('error')
      })

    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
    }
  }, [active, onEvent])

  const faceStatus = faceCount === null ? 'Initializing...'
    : faceCount === 0 ? '⚠ No face detected'
    : faceCount === 1 ? '✓ Face detected'
    : `⚠ ${faceCount} faces detected`

  const faceColor = faceCount === 1 ? 'text-emerald-400'
    : faceCount === 0 ? 'text-red-400'
    : 'text-amber-400'

  return (
    <div className="space-y-2">
      {/* Camera feed */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Overlay status */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2">
          <p className={`text-xs font-semibold ${faceColor}`}>{faceStatus}</p>
        </div>

        {modelStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-1" />
              <p className="text-xs text-slate-400">Loading AI model...</p>
            </div>
          </div>
        )}
        {modelStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/60">
            <p className="text-xs text-red-300 text-center px-2">Camera unavailable</p>
          </div>
        )}
      </div>

      {/* Model status badge */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">BlazeFace AI</span>
        <span className={`font-medium ${modelStatus === 'ready' ? 'text-emerald-400' : modelStatus === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
          {modelStatus === 'ready' ? '● Active' : modelStatus === 'error' ? '● Error' : '● Loading'}
        </span>
      </div>
    </div>
  )
}

// Draw face bounding boxes on canvas
function drawBoxes(canvas, predictions, video) {
  if (!canvas || !video) return
  const ctx = canvas.getContext('2d')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  predictions.forEach(pred => {
    const [x, y] = pred.topLeft
    const [x2, y2] = pred.bottomRight
    const w = x2 - x
    const h = y2 - y
    const isOk = predictions.length === 1
    ctx.strokeStyle = isOk ? '#10b981' : '#ef4444'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    // Corner accents
    const cs = 12
    ctx.lineWidth = 3
    ;[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy], i) => {
      ctx.beginPath()
      ctx.moveTo(cx + (i % 2 === 0 ? cs : -cs), cy)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx, cy + (i < 2 ? cs : -cs))
      ctx.stroke()
    })
  })
}
