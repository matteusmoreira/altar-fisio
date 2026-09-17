import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Search, X, UserPlus, Phone, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCpf, formatPhone } from '../../../shared/patientIdentity'

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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 200)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const patients = useQuery(api.patients.listPatients, {
    search: debouncedSearch,
  })

  // Se já há um paciente selecionado, busca ele mesmo que haja termo digitado
  const selectedPatientQuery = useQuery(
    api.patients.getPatient,
    selectedPatientId ? { id: selectedPatientId as any } : 'skip'
  )
  const selectedPatient = selectedPatientQuery || patients?.find((p) => p._id === selectedPatientId)

  if (selectedPatientId && selectedPatient) {
    return (
      <Card className="p-3 flex items-center justify-between bg-primary/5 border-primary/20 shadow-2xs">
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-primary">Paciente selecionado:</span>
            <h3 className="font-bold text-sm text-foreground truncate">{selectedPatient.name}</h3>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
            {selectedPatient.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-primary/70" />
                {formatPhone(selectedPatient.phone)}
              </span>
            )}
            {selectedPatient.documentCpf && (
              <span className="text-muted-foreground/80">
                CPF: {formatCpf(selectedPatient.documentCpf)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onClearPatient()
            setSearchTerm('')
            setIsOpen(true)
          }}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Trocar</span>
        </Button>
      </Card>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Clique para listar todos ou busque por nome/telefone..."
            value={searchTerm}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            className="pl-9 pr-8 h-10 w-full"
          />
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
            tabIndex={-1}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <Button
          onClick={onOpenQuickRegister}
          variant="outline"
          className="shrink-0 h-10 px-3 text-xs font-semibold gap-1.5"
        >
          <UserPlus className="w-4 h-4 text-primary" />
          <span>Novo Paciente</span>
        </Button>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg divide-y divide-border/50 max-h-72 overflow-y-auto overflow-x-hidden animate-in fade-in-50 zoom-in-98 duration-100">
          {patients === undefined ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Carregando pacientes...
            </div>
          ) : patients.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {searchTerm ? 'Nenhum paciente encontrado para esta busca.' : 'Nenhum paciente cadastrado.'}
            </div>
          ) : (
            patients.map((patient) => (
              <div
                key={patient._id}
                className="p-2.5 px-3 hover:bg-primary/10 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                onClick={() => {
                  onSelectPatient(patient._id)
                  setIsOpen(false)
                  setSearchTerm('')
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {patient.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {patient.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{formatPhone(patient.phone)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 italic">Sem telefone</span>
                    )}
                    {patient.documentCpf && (
                      <span className="text-muted-foreground/60">• CPF: {formatCpf(patient.documentCpf)}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-primary font-medium"
                >
                  Selecionar
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
