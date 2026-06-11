import { useState } from 'react'
import { clsx } from 'clsx'

interface Props {
  debateId: string
  topic: string
}

export function ExportButton({ debateId, topic }: Props) {
  const [copying, setCopying] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/debate/${debateId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      window.prompt('Copy this link:', url)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiBase}/api/debates/${debateId}/export/`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Export failed')
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `aria_debate_${topic.slice(0, 30).replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Download failed. Make sure the backend is running.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 justify-end shrink-0">
      {/* Share link */}
      <button
        onClick={handleCopyLink}
        className={clsx(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
          copying
            ? 'border-green-500/50 bg-green-500/10 text-green-400'
            : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white',
        )}
      >
        {copying ? '✓ Copied!' : '🔗 Copy Link'}
      </button>

      {/* PDF export */}
      <button
        onClick={handleDownloadPdf}
        disabled={downloading}
        className={clsx(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
          downloading
            ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white',
        )}
      >
        {downloading ? (
          <>
            <span className="w-3 h-3 border border-gray-600 border-t-gray-400 rounded-full animate-spin" />
            Exporting...
          </>
        ) : (
          '⬇ Export PDF'
        )}
      </button>
    </div>
  )
}
