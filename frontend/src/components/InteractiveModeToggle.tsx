import { clsx } from 'clsx'

interface InteractiveModeToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export function InteractiveModeToggle({ enabled, onChange, disabled }: InteractiveModeToggleProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={clsx(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
          enabled ? 'bg-indigo-600' : 'bg-slate-700',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition',
            enabled ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <div className="text-left min-w-0">
        <p className="text-xs font-medium text-slate-300">Interactive mode</p>
        <p className="text-[10px] text-slate-500">Pick a side after round 1 — agents respond to you</p>
      </div>
    </div>
  )
}
