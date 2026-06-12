import { useState } from 'react'
import { clsx } from 'clsx'
import type { UserStance } from '@/types'

interface StancePanelProps {
  onSubmit: (stance: UserStance, thought: string) => Promise<void>
  isSubmitting?: boolean
}

export function StancePanel({ onSubmit, isSubmitting = false }: StancePanelProps) {
  const [selected, setSelected] = useState<UserStance | null>(null)
  const [thought, setThought] = useState('')

  const handleConfirm = async () => {
    if (!selected || isSubmitting) return
    await onSubmit(selected, thought.trim())
  }

  return (
    <div className="my-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/50 p-5 animate-slide-up">
      <div className="text-center mb-4">
        <p className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">Interactive mode</p>
        <h3 className="text-base font-semibold text-white">What&apos;s your take?</h3>
        <p className="text-sm text-slate-400 mt-1">
          Pick a side and share your thoughts — both agents will read your response and try to convince you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => setSelected('advocate')}
          className={clsx(
            'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-left sm:text-center',
            selected === 'advocate'
              ? 'border-red-500/50 bg-red-950/40 ring-1 ring-red-500/30'
              : 'border-slate-700/60 bg-slate-900/40 hover:border-red-500/30',
          )}
        >
          <span className="text-2xl">🔴</span>
          <span className="text-sm font-semibold text-red-400">Advocate</span>
          <span className="text-xs text-slate-500">I support the motion</span>
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => setSelected('critic')}
          className={clsx(
            'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-left sm:text-center',
            selected === 'critic'
              ? 'border-blue-500/50 bg-blue-950/40 ring-1 ring-blue-500/30'
              : 'border-slate-700/60 bg-slate-900/40 hover:border-blue-500/30',
          )}
        >
          <span className="text-2xl">🔵</span>
          <span className="text-sm font-semibold text-blue-400">Critic</span>
          <span className="text-xs text-slate-500">I oppose the motion</span>
        </button>
      </div>

      <div className="mt-4">
        <label className="text-xs text-slate-400 font-medium block mb-1.5">
          Your thoughts <span className="text-slate-600">(optional)</span>
        </label>
        <textarea
          value={thought}
          onChange={e => setThought(e.target.value)}
          disabled={isSubmitting}
          placeholder="Why do you feel this way? What points convinced you?"
          rows={3}
          maxLength={2000}
          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2.5
            text-sm text-gray-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selected || isSubmitting}
        className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all
          bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Continuing debate…
          </span>
        ) : (
          'Continue debate →'
        )}
      </button>
    </div>
  )
}
