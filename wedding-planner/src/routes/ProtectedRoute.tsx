import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../store/ui'

export function ProtectedRoute() {
  const loggedIn = useAuth((s) => s.loggedIn)
  const loc = useLocation()
  if (!loggedIn) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}
