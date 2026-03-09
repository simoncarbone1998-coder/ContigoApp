interface DotMap {
  [date: string]: 'available' | 'booked' | 'both'
}

interface Props {
  year: number
  month: number        // 0-indexed
  dots?: DotMap
  selected?: string    // 'YYYY-MM-DD'
  onSelectDate?: (date: string) => void
  onPrev: () => void
  onNext: () => void
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

function pad(n: number) { return String(n).padStart(2, '0') }

export default function MiniCalendar({ year, month, dots = {}, selected, onSelectDate, onPrev, onNext }: Props) {
  // First day of month (0=Sun … 6=Sat), convert to Mon-first (0=Mon … 6=Sun)
  const firstDow = new Date(year, month, 1).getDay()
  const startOffset = (firstDow + 6) % 7   // Mon-first offset

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Mes anterior"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-slate-900">
          {MONTHS_ES[month]} {year}
        </span>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Mes siguiente"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
          const dot = dots[dateStr]
          const isSelected = selected === dateStr
          const isToday = dateStr === new Date().toISOString().slice(0, 10)

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate?.(dateStr)}
              className={`relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-sm transition-colors ${
                isSelected
                  ? 'bg-blue-700 text-white font-semibold'
                  : isToday
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {day}
              {dot && (
                <div className="absolute bottom-1 flex gap-0.5 items-center">
                  {(dot === 'available' || dot === 'both') && (
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                  {(dot === 'booked' || dot === 'both') && (
                    <span className="w-1 h-1 rounded-full bg-amber-500" />
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs text-slate-500">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-xs text-slate-500">Reservado</span>
        </div>
      </div>
    </div>
  )
}
