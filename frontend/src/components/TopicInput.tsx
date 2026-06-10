import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { debatesApi } from '@/lib/api'

interface Props {
  onStart: (topic: string) => void
  isLoading: boolean
}

export function TopicInput({ onStart, isLoading }: Props) {
  const [topic, setTopic] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    debatesApi.suggestions().then((d) => setSuggestions(d.suggestions)).catch(() => {})
  }, [])

  const handleSubmit = () => {
    if (topic.trim().length < 5 || isLoading) return
    onStart(topic.trim())
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Enter a debate topic..."
          rows={2}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-24 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 transition-colors text-sm"
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={topic.trim().length < 5 || isLoading}
          className={clsx(
            'absolute right-3 bottom-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            topic.trim().length >= 5 && !isLoading
              ? 'bg-white text-gray-900 hover:bg-gray-200'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              Starting
            </span>
          ) : (
            'Debate →'
          )}
        </button>
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && !isLoading && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setTopic(s)
                  setShowSuggestions(false)
                }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors border border-gray-700 hover:border-gray-500"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
