import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { DebatePage } from '@/pages/DebatePage'
import { HistoryPage } from '@/pages/HistoryPage'
import { DebateSummaryPage } from '@/pages/DebateSummaryPage'
import { AuthPage } from '@/pages/AuthPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"               element={<DebatePage />} />
        <Route path="/history"        element={<HistoryPage />} />
        <Route path="/debate/:id"     element={<DebateSummaryPage />} />
        <Route path="/auth"           element={<AuthPage />} />
        <Route path="/auth/callback"  element={<AuthCallbackPage />} />
      </Routes>
    </AuthProvider>
  )
}
