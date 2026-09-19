import React, { useState } from 'react'
import { useAction } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import {
  formatPhone,
  isValidPhone,
  normalizePhone,
} from '../../../shared/patientIdentity'

interface QuickPatientFormProps {
  onPatientCreated: (patientId: string) => void
  onCancel: () => void
}

export function QuickPatientForm({ onPatientCreated, onCancel }: QuickPatientFormProps) {
  const createPatient = useAction(api.patients.createPatient)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanPhone = normalizePhone(phone)

    if (!name.trim() || !cleanPhone) {
      setError('Nome e telefone são obrigatórios.')
      return
    }

    if (!isValidPhone(cleanPhone)) {
      setError('Telefone deve conter DDD e 10 ou 11 dígitos.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createPatient({
        name: name.trim(),
        phone: cleanPhone,
        birthDate: '2000-01-01', // placeholder — será atualizado no cadastro completo
      })
      onPatientCreated(result)
    } catch (err: any) {
      setError(err.message || 'Erro ao criar paciente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-4 border-primary/20">
      <div className="font-medium mb-3">Cadastro Rápido</div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="text-sm text-destructive font-medium">{error}</div>}
        
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nome Completo</label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Ex: João da Silva"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Telefone</label>
          <Input 
            value={phone} 
            onChange={(e) => setPhone(formatPhone(e.target.value))} 
            placeholder="(11) 99999-9999"
            maxLength={15}
            inputMode="tel"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Paciente
          </Button>
        </div>
      </form>
    </Card>
  )
}
