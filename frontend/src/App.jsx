import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ExamPage from './pages/ExamPage'
import AdminDashboard from './pages/AdminDashboard'
import ReportPage from './pages/ReportPage'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/exam/:exam_id" element={<ExamPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/report/:session_id" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
