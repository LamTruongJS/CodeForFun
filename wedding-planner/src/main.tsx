import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './fonts'
import './index.css'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { LoginPage } from './pages/Login'
import { SummaryPage } from './pages/Summary'
import { GuestsPage } from './pages/Guests'
import { CateringPage } from './pages/Catering'
import { TasksPage } from './pages/Tasks'
import { DataPage } from './pages/Data'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<SummaryPage />} />
            <Route path="guests/trai" element={<GuestsPage key="TRAI" side="TRAI" />} />
            <Route path="guests/gai" element={<GuestsPage key="GAI" side="GAI" />} />
            <Route path="catering" element={<CateringPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="data" element={<DataPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
