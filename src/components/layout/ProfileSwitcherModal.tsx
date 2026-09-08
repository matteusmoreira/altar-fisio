import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ProfileSwitcherModal({ open, onOpenChange }: {open: boolean; onOpenChange: (value: boolean) => void}) {
  const { user, logout } = useAuth()
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>{user?.name}</DialogTitle><DialogDescription>Para trocar de conta, encerre a sessão e entre com as credenciais do outro usuário.</DialogDescription></DialogHeader>
    <Button onClick={async () => { await logout(); onOpenChange(false) }}>Sair e trocar de conta</Button>
  </DialogContent></Dialog>
}
