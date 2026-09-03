import React, { useState, useEffect, Suspense, lazy } from "react"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { ClinicDataProvider } from "@/contexts/ClinicDataContext"
import { AppLayout, type NavSection } from "@/components/layout/AppLayout"
import { HeartPulse, Loader2 } from "lucide-react"

// Code Splitting Dinâmico (Performance & Lazy Loading)
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })))
const SchedulePage = lazy(() => import("@/pages/SchedulePage").then((m) => ({ default: m.SchedulePage })))
const ClassesPage = lazy(() => import("@/pages/ClassesPage").then((m) => ({ default: m.ClassesPage })))
const PatientsPage = lazy(() => import("@/pages/PatientsPage").then((m) => ({ default: m.PatientsPage })))
const ProfessionalsPage = lazy(() => import("@/pages/ProfessionalsPage").then((m) => ({ default: m.ProfessionalsPage })))
const ClinicalRecordPage = lazy(() => import("@/pages/ClinicalRecordPage").then((m) => ({ default: m.ClinicalRecordPage })))
const PackagesPage = lazy(() => import("@/pages/PackagesPage").then((m) => ({ default: m.PackagesPage })))
const FinancePage = lazy(() => import("@/pages/FinancePage").then((m) => ({ default: m.FinancePage })))
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })))
const PublicBookingPage = lazy(() => import("@/pages/PublicBookingPage").then((m) => ({ default: m.PublicBookingPage })))
const OnlineBookingsPage = lazy(() => import("@/pages/OnlineBookingsPage").then((m) => ({ default: m.OnlineBookingsPage })))
const BookingBuilderPage = lazy(() => import("@/pages/BookingBuilderPage").then((m) => ({ default: m.BookingBuilderPage })))


function PageLoadingFallback() {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3 animate-fade-in">
      <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
        <HeartPulse className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>Carregando módulo clínico...</span>
      </div>
    </div>
  )
}


function AppContent() {
  const { isAuthenticated, isLoading, canAccessSection, user } = useAuth()
  const [currentSection, setCurrentSection] = useState<NavSection>("dashboard")
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined)

  // Detecção de Rota Pública de Agendamento (/agendar, /agendamento ou ?mode=agendar)
  const isPublicBookingRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/agendar") ||
      window.location.pathname.startsWith("/agendamento") ||
      window.location.search.includes("mode=agendar") ||
      window.location.hash.includes("agendar"))

  if (isPublicBookingRoute) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <PublicBookingPage />
      </Suspense>
    )
  }

  // Proteção de rotas RBAC: redireciona para o dashboard caso o perfil atual não tenha permissão na seção
  useEffect(() => {
    if (isAuthenticated && !canAccessSection(currentSection)) {
      setCurrentSection("dashboard")
    }
  }, [isAuthenticated, currentSection, canAccessSection, user?.role])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shadow-md animate-pulse">
          <HeartPulse className="h-7 w-7 text-primary" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Carregando Altar Fisio...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LoginPage />
      </Suspense>
    )
  }

  const handleNavigateToClinical = (patientId: string) => {
    if (canAccessSection("clinical")) {
      setSelectedPatientId(patientId)
      setCurrentSection("clinical")
    }
  }

  return (
    <AppLayout currentSection={currentSection} onNavigate={setCurrentSection}>
      <Suspense fallback={<PageLoadingFallback />}>
        {currentSection === "dashboard" && (
          <DashboardPage onNavigate={setCurrentSection} />
        )}
        {currentSection === "schedule" && <SchedulePage />}
        {currentSection === "online_bookings" && <OnlineBookingsPage />}
        {currentSection === "classes" && <ClassesPage />}
        {currentSection === "patients" && (
          <PatientsPage onNavigateToClinical={handleNavigateToClinical} />
        )}
        {currentSection === "professionals" && <ProfessionalsPage />}
        {currentSection === "clinical" && canAccessSection("clinical") && (

          <ClinicalRecordPage initialPatientId={selectedPatientId} />
        )}
        {currentSection === "packages" && <PackagesPage />}
        {currentSection === "finance" && canAccessSection("finance") && <FinancePage />}
        {currentSection === "notifications" && canAccessSection("notifications") && <NotificationsPage />}
        {currentSection === "booking_builder" && canAccessSection("booking_builder") && <BookingBuilderPage />}
        {currentSection === "settings" && canAccessSection("settings") && <SettingsPage />}
      </Suspense>
    </AppLayout>
  )
}


function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClinicDataProvider>
          <AppContent />
        </ClinicDataProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App