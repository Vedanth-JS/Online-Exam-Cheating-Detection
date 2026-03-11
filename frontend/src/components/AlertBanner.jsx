export default function AlertBanner({ msg, type = 'yellow' }) {
  const styles = {
    red: 'bg-red-950/60 border-red-800/60 text-red-300',
    yellow: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
    green: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300',
  }

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{type === 'red' ? '🔴' : type === 'green' ? '🟢' : '🟡'}</span>
      <span className="leading-snug">{msg}</span>
    </div>
  )
}
