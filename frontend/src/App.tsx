import { Routes, Route } from 'react-router-dom'
import { DebatePage } from '@/pages/DebatePage'
import { HistoryPage } from '@/pages/HistoryPage'
import { DebateSummaryPage } from '@/pages/DebateSummaryPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DebatePage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/debate/:id" element={<DebateSummaryPage />} />
    </Routes>
  )
}