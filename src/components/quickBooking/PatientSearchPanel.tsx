import React, { useState, useEffect } from 'react'
import { useQuery } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Search, X, UserPlus, Phone, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PatientSearchPanelProps {
  selectedPatientId: string | null
  onSelectPatient: (patientId: string) => void
  onClearPatient: () => void
  onOpenQuickRegister: () => void
}

export function PatientSearchPanel({
  selectedPatientId,
  onSelectPatient,
  onClearPatient,
  onOpenQuickRegister,
}: PatientSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const patients = useQuery(api.patients.listPatients, {
    search: debouncedSearch,
  })

  const selectedPatient = patients?.find((p) => p._id === selectedPatientId)

  if (selectedPatientId && selectedPatient) {
    return (
      <Card className="p-4 flex items-center justify-between bg-primary/5 border-primary/20">
        <div>
          <h3 className="font-semibold text-lg">{selectedPatient.name}</h3>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
            {selectedPatient.documentCpf && (
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {selectedPatient.documentCpf}
              </span>
            )}
            {selectedPatient.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {selectedPatient.phone}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClearPatient}>
          <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={onOpenQuickRegister} variant="outline" className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Paciente
        </Button>
      </div>

      {debouncedSearch && patients !== undefined && (
        <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
          {patients.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhum paciente encontrado.
            </div>
          ) : (
            patients.map((patient) => (
              <div
                key={patient._id}
                className="p-3 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => onSelectPatient(patient._id)}
              >
                <div className="font-medium">{patient.name}</div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  {patient.documentCpf && <span>CPF: {patient.documentCpf}</span>}
                  {patient.phone && <span>Tel: {patient.phone}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
