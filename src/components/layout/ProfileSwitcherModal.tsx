import React from "react"
import { useAuth, type UserRole } from "@/contexts/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ShieldCheck,
  Stethoscope,
  UserCheck,
  CheckCircle2,
  LogOut,
  ArrowRight,
  Sparkles,
} from "lucide-react"

interface ProfileSwitcherModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { user, role, fastLogin, logout } = useAuth()

  const profiles: Array<{
    role: UserRole
    name: string
    title: string
    detail: string
    crefito?: string
    avatarUrl: string
    badgeColor: string
    icon: React.FC<{ className?: string }>
  }> = [
    {
      role: "admin",
      name: "Dr. Marcelo Henrique",
      title: "Administrador Geral & Gestor Clínico",
      detail: "Acesso total irrestrito: DRE, Comissões, Prontuários, Agenda e Configurações de API.",
      crefito: "CREFITO-3 / 184520-F",
      avatarUrl:
        "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: ShieldCheck,
    },
    {
      role: "professional",
      name: "Dra. Camila Duarte",
      title: "Fisioterapeuta & Instrutora de Pilates",
      detail: "Foco clínico: agenda própria, check-in de alunos e preenchimento de evolução SOAP com carimbo digital.",
      crefito: "CREFITO-3 / 215430-F",
      avatarUrl:
        "https://images.unsplash.com/photo-1594824813586-7871e8932788?w=150&auto=format&fit=crop&q=80",
      badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      icon: Stethoscope,
    },
    {
      role: "reception",
      name: "Bruna Santos",
      title: "Recepção & Atendimento ao Paciente",
      detail: "Atendimento da recepção: agendamento geral, cadastro de pacientes e reposições. Sem acesso a prontuários confidenciais.",
      avatarUrl:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: UserCheck,
    },
  ]

  const handleSelectRole = async (targetRole: UserRole) => {
    if (targetRole === role) {
      onOpenChange(false)
      return
    }
    await fastLogin(targetRole)
    onOpenChange(false)
  }

  const handleLogout = async () => {
    onOpenChange(false)
    await logout()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-bold text-foreground">
              Alternar Perfil Clínico
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Alterne entre os papéis operacionais da clínica para testar a experiência e as permissões de acesso RBAC.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de Perfis */}
        <div className="space-y-2.5 my-2">
          {profiles.map((p) => {
            const isCurrent = role === p.role
            const Icon = p.icon

            return (
              <button
                key={p.role}
                type="button"
                onClick={() => handleSelectRole(p.role)}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3.5 relative ${
                  isCurrent
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:bg-muted/60 hover:border-primary/40"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={p.avatarUrl}
                    alt={p.name}
                    className="h-11 w-11 rounded-xl object-cover border border-border"
                  />
                  <div className="absolute -bottom-1 -right-1 p-0.5 rounded-md bg-card border border-border">
                    <Icon className="h-3 w-3 text-primary" />
                  </div>
                </div>

                {/* Detalhes */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-foreground truncate">
                      {p.name}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${p.badgeColor}`}
                    >
                      {p.role === "admin" ? "Admin" : p.role === "professional" ? "Fisio" : "Recepção"}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-muted-foreground truncate mt-0.5">
                    {p.title}
                  </p>

                  {p.crefito && (
                    <span className="inline-block text-[10px] text-primary/90 font-mono mt-0.5">
                      {p.crefito}
                    </span>
                  )}

                  <p className="text-[10px] text-muted-foreground/80 line-clamp-2 mt-1 leading-snug">
                    {p.detail}
                  </p>
                </div>

                {/* Status Ativo */}
                {isCurrent && (
                  <div className="absolute top-3 right-3 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Rodapé com botão de logout */}
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Logado como: <strong className="text-foreground">{user?.name}</strong>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-semibold transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}