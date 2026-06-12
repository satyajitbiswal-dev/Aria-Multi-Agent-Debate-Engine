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
  const [spokenCharIndex, setSpokenCharIndex] = useState(0)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setPlayingId(null)
    setLoadingId(null)
    setSpokenCharIndex(0)
  }, [])

  const toggle = useCallback((id: string, text: string) => {
    if (playingId === id) {
      stop()
      return
    }

    window.speechSynthesis.cancel()
    setPlayingId(null)
    setSpokenCharIndex(0)
    setLoadingId(id)

    const clean = stripCitations(text)
    const utterance = new SpeechSynthesisUtterance(clean)
    const pick = pickVoice(voicesRef.current, voice)
    if (pick) utterance.voice = pick
    utterance.rate = 0.95
    utterance.pitch = voice === 'female' ? 1.1 : 0.9

    utterance.onstart = () => {
      setLoadingId(null)
      setPlayingId(id)
      setSpokenCharIndex(0)
    }
    utterance.onboundary = (ev) => {
      if (ev.name === 'word' || ev.charIndex > 0) {
        setSpokenCharIndex(ev.charIndex + (ev.charLength || 0))
      }
    }
    utterance.onend = () => {
      setSpokenCharIndex(clean.length)
      setPlayingId(null)
    }
    utterance.onerror = () => {
      setPlayingId(null)
      setLoadingId(null)
      setSpokenCharIndex(0)
    }

    window.speechSynthesis.speak(utterance)
  }, [playingId, stop, voice])

  return {
    playingId,
    loadingId,
    spokenCharIndex,
    toggle,
    stop,
    stripCitations,
  }
}
