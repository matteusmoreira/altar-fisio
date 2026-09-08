import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'

for (const key of ['altar_auth_session_token', 'altar_patient_portal_id', 'altar_rooms', 'altar_professionals', 'altar_patients', 'altar_schedules', 'altar_replacement_credits', 'altar_clinical_records', 'altar_evolutions', 'altar_clinical_reports', 'altar_transactions', 'altar_notification_logs', 'altar_packages']) {
  try { localStorage.removeItem(key) } catch { /* Storage may be disabled by browser policy. */ }
}

const convexUrl = (import.meta.env.VITE_CONVEX_URL as string) || 'http://127.0.0.1:3210'
const convex = new ConvexReactClient(convexUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
)

