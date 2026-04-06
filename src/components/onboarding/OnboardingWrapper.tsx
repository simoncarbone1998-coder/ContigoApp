import type { ReactNode } from 'react'

interface Props {
  step: number       // 1-based, displayed as "Paso X de Y"
  totalSteps: number
  onBack?: () => void
  onSkip: () => void
  children: ReactNode
}

export default function OnboardingWrapper({ step, totalSteps, onBack, onSkip, children }: Props) {
  const pct = Math.round((step / totalSteps) * 100)

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 shrink-0">
        <div
          className="h-1.5 bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-800 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            ← Atrás
          </button>
        ) : (
          <div />
        )}
        <span className="text-xs text-slate-400 font-semibold tracking-wide">
          Paso {step} de {totalSteps}
        </span>
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
        >
          Omitir por ahora
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
