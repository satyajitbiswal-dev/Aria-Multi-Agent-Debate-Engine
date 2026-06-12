import { useCallback, useEffect, useRef, useState } from 'react'

function stripCitations(text: string) {
  return text.replace(/\[\d+\]/g, '')
}

function pickVoice(voices: SpeechSynthesisVoice[], gender: 'male' | 'female') {
  return voices.find(v => {
    const name = v.name.toLowerCase()
    if (gender === 'female') {
      return name.includes('female') || name.includes('woman') || name.includes('samantha')
        || name.includes('victoria') || name.includes('karen') || name.includes('moira')
        || name.includes('tessa') || name.includes('fiona') || name.includes('zira')
    }
    return name.includes('male') || name.includes('man') || name.includes('daniel')
      || name.includes('alex') || name.includes('fred') || name.includes('tom') || name.includes('mark')
  })
}

export function useSpeech(voice: 'male' | 'female') {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [spokenWordIndex, setSpokenWordIndex] = useState(-1)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    clearTimers()
    setPlayingId(null)
    setLoadingId(null)
    setSpokenWordIndex(-1)
  }, [clearTimers])

  const toggle = useCallback((id: string, text: string) => {
    if (playingId === id) {
      stop()
      return
    }

    window.speechSynthesis.cancel()
    clearTimers()
    setPlayingId(null)
    setSpokenWordIndex(-1)
    setLoadingId(id)

    const clean = stripCitations(text)
    const words = clean.split(/\s+/).filter(Boolean)
    const utterance = new SpeechSynthesisUtterance(clean)
    const pick = pickVoice(voicesRef.current, voice)
    if (pick) utterance.voice = pick
    utterance.rate = 0.95
    utterance.pitch = voice === 'female' ? 1.1 : 0.9

    const rate = utterance.rate
    const msPerWord = 340 / rate

    const scheduleWordHighlights = () => {
      words.forEach((_, i) => {
        if (i === 0) return
        const t = setTimeout(() => setSpokenWordIndex(i), Math.round(i * msPerWord))
        timersRef.current.push(t)
      })
    }

    utterance.onstart = () => {
      setLoadingId(null)
      setPlayingId(id)
      setSpokenWordIndex(0)
      scheduleWordHighlights()
    }

    utterance.onboundary = (ev) => {
      if (ev.charIndex === undefined) return
      const spoken = clean.slice(0, ev.charIndex + (ev.charLength || 0))
      const count = spoken.trim() ? spoken.trim().split(/\s+/).length : 0
      if (count > 0) setSpokenWordIndex(count - 1)
    }

    utterance.onend = () => {
      clearTimers()
      setSpokenWordIndex(Math.max(0, words.length - 1))
      setTimeout(() => {
        setPlayingId(null)
        setSpokenWordIndex(-1)
      }, 300)
    }

    utterance.onerror = () => {
      clearTimers()
      setPlayingId(null)
      setLoadingId(null)
      setSpokenWordIndex(-1)
    }

    window.speechSynthesis.speak(utterance)
  }, [playingId, stop, clearTimers, voice])

  return {
    playingId,
    loadingId,
    spokenWordIndex,
    toggle,
    stop,
    stripCitations,
  }
}
