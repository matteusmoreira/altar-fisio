import React, { useState } from "react"
import { useTheme } from "@/contexts/ThemeContext"
import { useAuth } from "@/contexts/AuthContext"
import { ThemeCustomizerModal } from "./ThemeCustomizerModal"
import { ProfileSwitcherModal } from "./ProfileSwitcherModal"
import {
  Calendar,
  Users,
  Layers,
  FileText,
  DollarSign,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Palette,
  Bell,
  HeartPulse,
  Activity,
  BookmarkCheck,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  LogOut,
} from "lucide-react"

export type NavSection =
  | "dashboard"
  | "schedule"
  | "classes"
  | "patients"
  | "clinical"
  | "packages"
  | "finance"
  | "notifications"
  | "settings"

interface AppLayoutProps {
  currentSection: NavSection
  onNavigate: (section: NavSection) => void
  children: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentSection,
  onNavigate,
  children,
}) => {
  const { theme, toggleMode } = useTheme()
  const { user, role, canAccessSection, logout } = useAuth()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  const allNavItems: Array<{
    id: NavSection
    label: string
    shortLabel: string
    icon: React.FC<{ className?: string }>
    badge?: string
    group: "atendimento" | "clinico" | "gestao"
  }> = [
    { id: "dashboard", label: "Visão Geral", shortLabel: "Início", icon: Activity, group: "atendimento" },
    { id: "schedule", label: "Agenda & Marcações", shortLabel: "Agenda", icon: Calendar, badge: "Hoje", group: "atendimento" },
    { id: "classes", label: "Turmas & Salas", shortLabel: "Turmas", icon: Layers, badge: "Pilates", group: "atendimento" },
    { id: "patients", label: "Pacientes & Alunos", shortLabel: "Pacientes", icon: Users, group: "clinico" },
    { id: "clinical", label: "Prontuário & Avaliações", shortLabel: "Prontuário", icon: FileText, badge: "CREFITO", group: "clinico" },
    { id: "packages", label: "Pacotes & Reposições", shortLabel: "Pacotes", icon: BookmarkCheck, group: "gestao" },
    { id: "finance", label: "Financeiro Interno", shortLabel: "Financeiro", icon: DollarSign, group: "gestao" },
    { id: "notifications", label: "Lembretes WhatsApp/Email", shortLabel: "Lembretes", icon: Bell, group: "gestao" },
    { id: "settings", label: "Configurações da Clínica", shortLabel: "Ajustes", icon: Settings, group: "gestao" },
  ]

  // Filtra itens de acordo com a política RBAC do perfil conectado
  const navItems = allNavItems.filter((item) => canAccessSection(item.id))

  const handleNavClick = (section: NavSection) => {
    onNavigate(section)
    setMobileMenuOpen(false)
  }

  const roleLabel =
    role === "admin"
      ? "Administrador"
      : role === "professional"
      ? "Fisioterapeuta"
      : "Recepção"

  const RoleIcon =
    role === "admin"
      ? ShieldCheck
      : role === "professional"
      ? Stethoscope
      : UserCheck

  const roleBadgeStyle =
    role === "admin"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : role === "professional"
      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20"
      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased">
      {/* ========================================================================= */}
      {/* DESKTOP RETRACTABLE SIDEBAR (hidden on mobile, visible md+)               */}
      {/* ========================================================================= */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out relative z-30 sticky top-0 h-screen ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header da Sidebar com Marca da Clínica */}
        <div className="h-16 flex items-center px-4 border-b border-border justify-between overflow-hidden">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-sm border border-primary/20">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm leading-tight text-foreground truncate tracking-tight">
                  {theme.clinicName}
                </span>
                <span className="text-[11px] text-muted-foreground truncate font-medium">
                  {theme.clinicSubtitle}
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shadow-sm border border-primary/20">
                <HeartPulse className="h-6 w-6" />
              </div>
            </div>
          )}

          {/* Botão de Retração / Expansão */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Lista de Navegação Desktop */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Grupo 1: Atendimento */}
          {navItems.some((i) => i.group === "atendimento") && (
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                  Atendimento & Agenda
                </p>
              )}
              {navItems
                .filter((item) => item.group === "atendimento")
                .map((item) => {
                  const Icon = item.icon
                  const isActive = currentSection === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
            </div>
          )}

          {/* Grupo 2: Clínico */}
          {navItems.some((i) => i.group === "clinico") && (
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                  Área Clínica
                </p>
              )}
              {navItems
                .filter((item) => item.group === "clinico")
                .map((item) => {
                  const Icon = item.icon
                  const isActive = currentSection === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
            </div>
          )}

          {/* Grupo 3: Gestão & Config */}
          {navItems.some((i) => i.group === "gestao") && (
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                  Administração & Gestão
                </p>
              )}
              {navItems
                .filter((item) => item.group === "gestao")
                .map((item) => {
                  const Icon = item.icon
                  const isActive = currentSection === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                      {!sidebarCollapsed && (
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      )}
                    </button>
                  )
                })}
            </div>
          )}
        </div>

        {/* Rodapé da Sidebar Desktop: Usuário Conectado & Controles */}
        <div className="p-3 border-t border-border bg-muted/20 space-y-2">
          {/* Cartão de Usuário com Botão de Troca Rápida de Perfil */}
          {user && (
            <div
              onClick={() => setProfileModalOpen(true)}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors cursor-pointer ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              title="Clique para alternar perfil ou sair"
            >
              <div className="relative shrink-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-8 w-8 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
              </div>

              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {user.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${roleBadgeStyle}`}
                    >
                      {roleLabel}
                    </span>
                    {user.crefito && (
                      <span className="text-[9px] text-muted-foreground truncate">
                        {user.crefito.split("/")[1] || user.crefito}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botão para personalizar o tema */}
          <button
            type="button"
            onClick={() => setThemeModalOpen(true)}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-xs font-medium ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
            title="Personalizar Cores do Dashboard"
          >
            <div className="h-5 w-5 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Palette className="h-3 w-3 text-primary-foreground" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col text-left truncate">
                <span className="text-[11px] font-semibold text-foreground">Cores da Clínica</span>
                <span className="text-[10px] text-muted-foreground capitalize">{theme.preset}</span>
              </div>
            )}
          </button>

          {/* Alternador Modo Claro/Escuro & Logout */}
          <div className="flex items-center justify-between px-1 pt-1">
            {!sidebarCollapsed ? (
              <span className="text-[11px] text-muted-foreground">Modo visual</span>
            ) : null}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMode}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Alternar Modo Claro/Escuro"
              >
                {theme.mode === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => logout()}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Sair do Sistema"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE TOP HEADER BAR (visible <= 768px)                                  */}
      {/* ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1.5 rounded-lg text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="flex flex-col truncate">
            <span className="font-bold text-xs leading-tight text-foreground truncate">
              {theme.clinicName}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {navItems.find((n) => n.id === currentSection)?.label || "Altar Fisio"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão de Perfil Rápido Mobile */}
          {user && (
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card text-xs font-semibold"
            >
              <RoleIcon className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px]">{user.name.split(" ")[0]}</span>
            </button>
          )}

          {/* Botão de Cor Rápido */}
          <button
            type="button"
            onClick={() => setThemeModalOpen(true)}
            className="p-2 rounded-lg text-primary hover:bg-muted transition-colors"
            title="Mudar cores"
          >
            <Palette className="h-4 w-4" />
          </button>

          {/* Botão Modo Claro/Escuro */}
          <button
            type="button"
            onClick={toggleMode}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Modo Claro/Escuro"
          >
            {theme.mode === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE DRAWER SLIDE-OVER                                                 */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-4/5 max-w-xs bg-card border-r border-border h-full flex flex-col z-10 shadow-2xl">
            <div className="h-16 px-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">{theme.clinicName}</h3>
                  <p className="text-[10px] text-muted-foreground">{theme.clinicSubtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Usuário no Drawer Mobile */}
            {user && (
              <div
                onClick={() => {
                  setMobileMenuOpen(false)
                  setProfileModalOpen(true)
                }}
                className="p-3 mx-3 mt-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3 cursor-pointer"
              >
                <img
                  src={user.avatarUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150"}
                  alt={user.name}
                  className="h-10 w-10 rounded-xl object-cover border border-border"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-foreground truncate">{user.name}</h4>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${roleBadgeStyle}`}>
                    {roleLabel}
                  </span>
                  {user.crefito && (
                    <p className="text-[10px] text-primary font-mono mt-0.5">{user.crefito}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Menu Principal
                </p>
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = currentSection === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setThemeModalOpen(true)
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-card text-xs font-medium"
              >
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Personalizar Cores
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {theme.preset}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  logout()
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-semibold"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {children}
      </main>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom <= 768px)                   */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onNavigate("schedule")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
            currentSection === "schedule" ? "text-primary font-bold" : "text-muted-foreground"
          }`}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-[10px]">Agenda</span>
        </button>

        <button
          onClick={() => onNavigate("classes")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
            currentSection === "classes" ? "text-primary font-bold" : "text-muted-foreground"
          }`}
        >
          <Layers className="h-5 w-5" />
          <span className="text-[10px]">Turmas</span>
        </button>

        <button
          onClick={() => onNavigate("dashboard")}
          className="flex flex-col items-center justify-center -mt-4 bg-primary text-primary-foreground h-12 w-12 rounded-full shadow-lg border-2 border-background active:scale-95 transition-transform"
          title="Início"
        >
          <Activity className="h-6 w-6" />
        </button>

        <button
          onClick={() => onNavigate("patients")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
            currentSection === "patients" ? "text-primary font-bold" : "text-muted-foreground"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px]">Pacientes</span>
        </button>

        {/* 5º Botão Contextual por Perfil */}
        {role === "admin" ? (
          <button
            onClick={() => onNavigate("finance")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              currentSection === "finance" ? "text-primary font-bold" : "text-muted-foreground"
            }`}
          >
            <DollarSign className="h-5 w-5" />
            <span className="text-[10px]">Caixa</span>
          </button>
        ) : role === "professional" ? (
          <button
            onClick={() => onNavigate("clinical")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              currentSection === "clinical" ? "text-primary font-bold" : "text-muted-foreground"
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[10px]">Prontuário</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate("packages")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              currentSection === "packages" ? "text-primary font-bold" : "text-muted-foreground"
            }`}
          >
            <BookmarkCheck className="h-5 w-5" />
            <span className="text-[10px]">Pacotes</span>
          </button>
        )}
      </nav>

      {/* Modal de Personalização de Cores e Marca */}
      <ThemeCustomizerModal
        open={themeModalOpen}
        onOpenChange={setThemeModalOpen}
      />

      {/* Modal de Alternância Rápida de Perfil Clínico */}
      <ProfileSwitcherModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
      />
    </div>
  )
}