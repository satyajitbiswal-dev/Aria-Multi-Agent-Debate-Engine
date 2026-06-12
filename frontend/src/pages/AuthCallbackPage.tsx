import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * Landing page after Google OAuth redirect.
 * allauth redirects to /auth/callback → we exchange the session cookie for JWT.
 */
export function AuthCallbackPage() {
  const { handleGoogleCallback } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('oauth_token') ?? undefined
    handleGoogleCallback(oauthToken)
      .then(() => navigate('/', { replace: true }))
      .catch(e => {
        console.error('Google callback failed', e)
        setError('Google sign-in failed. Please try again.')
      })
  }, [handleGoogleCallback, navigate])

  if (error) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="text-sm text-gray-400 hover:text-white underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen flex items-center justify-center gap-3 text-slate-400">
      <span className="w-5 h-5 border-2 border-gray-700 border-t-gray-300 rounded-full animate-spin" />
      Completing sign-in…
    </div>
  )
}
