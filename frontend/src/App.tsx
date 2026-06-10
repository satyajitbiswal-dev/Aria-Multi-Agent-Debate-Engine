import { Routes, Route, Link } from 'react-router-dom'
import { DebatePage } from '@/pages/DebatePage'
import { HistoryPage } from '@/pages/HistoryPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DebatePage />} />
      <Route path="/history" element={<HistoryPage />} />
      {/* Day 2: /debate/:id replay route goes here */}
    </Routes>
  )
}
