// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { formatProfessionalDisplayName } from '@/lib/professionalUtils'
import { PatientSearchPanel } from '@/components/quickBooking/PatientSearchPanel'
import { WeeklyScheduleGrid } from '@/components/quickBooking/WeeklyScheduleGrid'
import { QuickBookingPage } from '@/pages/QuickBookingPage'
import { QuickPatientForm } from '@/components/quickBooking/QuickPatientForm'

// ─── Testes Unitários de Formatação de Nomes de Profissionais ────────────────

test('formatProfessionalDisplayName formata prefixos com título e primeiro nome', () => {
  expect(formatProfessionalDisplayName('Dr. Marcelo Santos')).toBe('Dr Marcelo')
  expect(formatProfessionalDisplayName('Dr Marcelo')).toBe('Dr Marcelo')
  expect(formatProfessionalDisplayName('dr. marcelo')).toBe('dr marcelo')
  expect(formatProfessionalDisplayName('Dra. Larissa Moreira')).toBe('Dra Larissa')
  expect(formatProfessionalDisplayName('Prof. Antonio Carlos')).toBe('Prof Antonio')
})

test('formatProfessionalDisplayName formata profissionais sem prefixo pelo primeiro nome', () => {
  expect(formatProfessionalDisplayName('Gustavo Henrique')).toBe('Gustavo')
  expect(formatProfessionalDisplayName('Claudia Silva')).toBe('Claudia')
  expect(formatProfessionalDisplayName('Marcelo')).toBe('Marcelo')
  expect(formatProfessionalDisplayName('')).toBe('')
  expect(formatProfessionalDisplayName(null)).toBe('')
  expect(formatProfessionalDisplayName(undefined)).toBe('')
})

// ─── Mocks para Componentes React ───────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  patients: [
    { _id: 'p1', name: 'Ana Carolina Souza', phone: '(11) 98765-4321', documentCpf: '123.456.789-00' },
    { _id: 'p2', name: 'Bernardo Lima', phone: '(11) 91234-5678', documentCpf: '234.567.890-11' },
    { _id: 'p3', name: 'Carlos Eduardo', phone: '', documentCpf: '' },
  ],
  patientContext: {
    patient: { _id: 'p1', name: 'Ana Carolina Souza', phone: '(11) 98765-4321', documentCpf: '123.456.789-00' },
    packages: [
      { id: 'pkg1', serviceName: 'Pilates Clínico', freeBalance: 8, totalSessions: 10, usedSessions: 2 }
    ],
    availableCredits: 1,
    upcomingAppointments: [
      {
        participantId: 'part1',
        scheduleId: 'sch1',
        date: '2026-09-22',
        startTime: '08:00',
        endTime: '08:50',
        roomId: 'r1',
        roomName: 'Studio Pilates',
        roomColor: '#10B981',
        professionalId: 'prof1',
        professionalName: 'Dr. Marcelo Santos',
        specialty: 'pilates',
        isRecurring: true,
        recurringGroupId: 'rec-1',
        status: 'scheduled',
      }
    ],
  },
  specialties: [
    { id: 'pilates', name: 'Pilates' },
    { id: 'fisioterapia', name: 'Fisioterapia' },
  ],
  gridData: {
    dates: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'],
    rooms: [
      { id: 'r1', name: 'Studio Pilates', color: '#10B981', capacity: 8, type: 'pilates' },
    ],
    slots: [
      {
        day: '2026-09-17',
        dayOfWeek: 4,
        startTime: '08:00',
        endTime: '08:50',
        roomId: 'r1',
        roomName: 'Studio Pilates',
        roomCapacity: 8,
        roomColor: '#10B981',
        professionalId: 'prof1',
        professionalName: 'Dr. Marcelo Santos',
        specialty: 'pilates',
        scheduleId: 'sch1',
        scheduleTitle: 'Pilates Matutino',
        scheduleType: 'turma',
        occupiedSeats: 2,
        totalCapacity: 8,
        participants: [],
      }
    ]
  },
  confirmBooking: vi.fn().mockResolvedValue({ scheduleIds: ['s1'], errors: [] }),
  rescheduleParticipant: vi.fn().mockResolvedValue({ newScheduleId: 'new-sch-1' }),
  rescheduleSeriesParticipant: vi.fn().mockResolvedValue({ newScheduleId: 'new-sch-1', count: 4 }),
  cancelQuickBookingParticipant: vi.fn().mockResolvedValue({ success: true }),
  createPatientAction: vi.fn().mockResolvedValue('new-patient-id'),
}))

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (ref: any, args: any) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(ref)
    if (name === 'patients:listPatients') {
      if (args && args.search) {
        const lower = args.search.toLowerCase()
        return mocks.patients.filter((p) => p.name.toLowerCase().includes(lower) || p.phone.includes(lower))
      }
      return mocks.patients
    }
    if (name === 'patients:getPatient') {
      return mocks.patients.find((p) => p._id === args?.id)
    }
    if (name === 'clinic:getClinicalSpecialties') return mocks.specialties
    if (name === 'quickBooking:getWeeklyGridData') return mocks.gridData
    if (name === 'quickBooking:getPatientBookingContext') return mocks.patientContext
    return []
  },
  useMutation: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'quickBooking:confirmQuickBooking') return mocks.confirmBooking
    if (name === 'quickBooking:rescheduleParticipant') return mocks.rescheduleParticipant
    if (name === 'quickBooking:rescheduleSeriesParticipant') return mocks.rescheduleSeriesParticipant
    if (name === 'quickBooking:cancelQuickBookingParticipant') return mocks.cancelQuickBookingParticipant
    return vi.fn().mockResolvedValue({})
  },
  useAction: () => mocks.createPatientAction,
}))

vi.mock('@/lib/dateUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dateUtils')>()
  return {
    ...actual,
    getTodayDateString: () => '2026-09-17',
  }
})

afterEach(() => {
  cleanup()
})

// ─── Testes de PatientSearchPanel ───────────────────────────────────────────

test('PatientSearchPanel abre dropdown com lista completa de pacientes ao focar/clicar', async () => {
  const onSelect = vi.fn()
  const onClear = vi.fn()
  const onOpenRegister = vi.fn()

  render(
    <PatientSearchPanel
      selectedPatientId={null}
      onSelectPatient={onSelect}
      onClearPatient={onClear}
      onOpenQuickRegister={onOpenRegister}
    />
  )

  const input = screen.getByPlaceholderText(/Clique para listar todos/i)

  // Ao clicar/focar, a lista abre imediatamente
  fireEvent.focus(input)
  expect(screen.getByText('Ana Carolina Souza')).toBeTruthy()
  expect(screen.getByText('(11) 98765-4321')).toBeTruthy()
  expect(screen.getByText('Bernardo Lima')).toBeTruthy()
  expect(screen.getByText('(11) 91234-5678')).toBeTruthy()
  expect(screen.getByText('Carlos Eduardo')).toBeTruthy()

  // Clicar em um paciente dispara onSelectPatient
  fireEvent.click(screen.getByText('Ana Carolina Souza'))
  expect(onSelect).toHaveBeenCalledWith('p1')
})

test('PatientSearchPanel exibe card do paciente selecionado com opção de trocar', () => {
  const onSelect = vi.fn()
  const onClear = vi.fn()
  const onOpenRegister = vi.fn()

  render(
    <PatientSearchPanel
      selectedPatientId="p1"
      onSelectPatient={onSelect}
      onClearPatient={onClear}
      onOpenQuickRegister={onOpenRegister}
    />
  )

  expect(screen.getByText(/Paciente selecionado:/i)).toBeTruthy()
  expect(screen.getByText('Ana Carolina Souza')).toBeTruthy()
  expect(screen.getByText('(11) 98765-4321')).toBeTruthy()

  const trocarBtn = screen.getByRole('button', { name: /Trocar/i })
  fireEvent.click(trocarBtn)
  expect(onClear).toHaveBeenCalledTimes(1)
})

// ─── Testes de WeeklyScheduleGrid ───────────────────────────────────────────

test('WeeklyScheduleGrid exibe "Dr Marcelo" em vez de apenas "Dr." no card do slot', () => {
  const onSlotClick = vi.fn()
  const onDayChange = vi.fn()

  render(
    <WeeklyScheduleGrid
      dates={mocks.gridData.dates}
      rooms={mocks.gridData.rooms}
      slots={mocks.gridData.slots as any}
      selectedSlots={[]}
      selectedDay="2026-09-17"
      periodMode="week"
      onDayChange={onDayChange}
      onSlotClick={onSlotClick}
      hasPatientSelected={true}
    />
  )

  // Deve encontrar "Dr Marcelo", e não apenas "Dr."
  expect(screen.getByText('Dr Marcelo')).toBeTruthy()
  expect(screen.queryByText(/^Dr.$/)).toBeNull()
})

test('WeeklyScheduleGrid renderiza pílulas semanais em modo week e calendário em modo month', () => {
  const { rerender } = render(
    <WeeklyScheduleGrid
      dates={mocks.gridData.dates}
      rooms={mocks.gridData.rooms}
      slots={mocks.gridData.slots as any}
      selectedSlots={[]}
      selectedDay="2026-09-17"
      periodMode="week"
      onDayChange={vi.fn()}
      onSlotClick={vi.fn()}
      hasPatientSelected={true}
    />
  )

  // Em modo week, pílula de Quinta está visível
  expect(screen.getByText('Qui')).toBeTruthy()
  expect(screen.getByText('17/09')).toBeTruthy()

  // Re-render em modo month
  rerender(
    <WeeklyScheduleGrid
      dates={mocks.gridData.dates}
      rooms={mocks.gridData.rooms}
      slots={mocks.gridData.slots as any}
      selectedSlots={[]}
      selectedDay="2026-09-17"
      periodMode="month"
      onDayChange={vi.fn()}
      onSlotClick={vi.fn()}
      hasPatientSelected={true}
    />
  )

  // Em modo month, cabeçalhos dos dias da semana (Dom, Seg, etc.) aparecem no mini-calendário
  expect(screen.getAllByText('Seg').length).toBeGreaterThan(0)
})

test('WeeklyScheduleGrid não exibe Sábado na visualização semanal (apenas Segunda a Sexta)', () => {
  render(
    <WeeklyScheduleGrid
      dates={mocks.gridData.dates}
      rooms={mocks.gridData.rooms}
      slots={mocks.gridData.slots as any}
      selectedSlots={[]}
      selectedDay="2026-09-17"
      periodMode="week"
      onDayChange={vi.fn()}
      onSlotClick={vi.fn()}
      hasPatientSelected={true}
    />
  )

  // Verifica que os dias úteis (Seg a Sex) estão presentes
  expect(screen.getByText('Seg')).toBeTruthy()
  expect(screen.getByText('Ter')).toBeTruthy()
  expect(screen.getByText('Qua')).toBeTruthy()
  expect(screen.getByText('Qui')).toBeTruthy()
  expect(screen.getByText('Sex')).toBeTruthy()

  // Confirma que Sábado e Domingo NÃO são renderizados na grade semanal
  expect(screen.queryByText('Sáb')).toBeNull()
  expect(screen.queryByText('Dom')).toBeNull()
  expect(screen.queryByText('19/09')).toBeNull()
})

// ─── Testes de QuickBookingPage (Layout 1 Coluna e Recorrência sem quebra) ───

test('QuickBookingPage renderiza em coluna única e recorrência não exibe descrição longa', () => {
  render(<QuickBookingPage />)

  // Verifica que não existe mais <aside className="w-84">
  const asideElement = document.querySelector('aside')
  expect(asideElement).toBeNull()

  // Verifica presença do título
  expect(screen.getByRole('heading', { level: 1, name: /Agendamento Rápido/i })).toBeTruthy()

  // Verifica que o checkbox de recorrência mensal está presente
  const recurrenceLabel = screen.getByText('Recorrência Mensal')
  expect(recurrenceLabel).toBeTruthy()

  // Verifica que o texto longo descritivo que quebrava o layout NÃO está no DOM
  expect(screen.queryByText(/Marcar apenas na data específica da semana selecionada/i)).toBeNull()
  expect(screen.queryByText(/Ao selecionar um horário/i)).toBeNull()

  // Verifica a presença do alternador de período Dia, Semana, Mês
  expect(screen.getByRole('button', { name: /Dia/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Semana/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Mês/i })).toBeTruthy()
})

// ─── Testes de QuickPatientForm (Máscaras de Telefone e Remoção de CPF) ─────────

test('QuickPatientForm aplica máscara em tempo real ao digitar telefone e não renderiza campo de CPF', () => {
  render(<QuickPatientForm onPatientCreated={vi.fn()} onCancel={vi.fn()} />)

  const phoneInput = screen.getByPlaceholderText('(11) 99999-9999') as HTMLInputElement

  // Digitando telefone celular sem formatação
  fireEvent.change(phoneInput, { target: { value: '22999021889' } })
  expect(phoneInput.value).toBe('(22) 99902-1889')

  // Digitando telefone fixo (10 dígitos)
  fireEvent.change(phoneInput, { target: { value: '2233334444' } })
  expect(phoneInput.value).toBe('(22) 3333-4444')

  // Confirma ausência definitiva do campo de CPF
  expect(screen.queryByPlaceholderText('000.000.000-00')).toBeNull()
  expect(screen.queryByText(/^CPF$/i)).toBeNull()
})

test('QuickPatientForm exibe erro ao tentar submeter telefone inválido ou campos vazios', async () => {
  render(<QuickPatientForm onPatientCreated={vi.fn()} onCancel={vi.fn()} />)

  const nameInput = screen.getByPlaceholderText('Ex: João da Silva')
  const phoneInput = screen.getByPlaceholderText('(11) 99999-9999')
  const submitBtn = screen.getByRole('button', { name: /Salvar Paciente/i })

  // 1. Tenta submeter vazio
  fireEvent.click(submitBtn)
  expect(screen.getByText(/Nome e telefone são obrigatórios/i)).toBeTruthy()
  expect(mocks.createPatientAction).not.toHaveBeenCalled()

  // 2. Tenta submeter com telefone inválido
  fireEvent.change(nameInput, { target: { value: 'Paciente Teste' } })
  fireEvent.change(phoneInput, { target: { value: '123' } })
  fireEvent.click(submitBtn)

  expect(screen.getByText(/Telefone deve conter DDD e 10 ou 11 dígitos/i)).toBeTruthy()
  expect(mocks.createPatientAction).not.toHaveBeenCalled()
})

test('QuickPatientForm submete sem CPF e aciona onPatientCreated', async () => {
  const onCreated = vi.fn()
  mocks.createPatientAction.mockClear()

  render(<QuickPatientForm onPatientCreated={onCreated} onCancel={vi.fn()} />)

  const nameInput = screen.getByPlaceholderText('Ex: João da Silva')
  const phoneInput = screen.getByPlaceholderText('(11) 99999-9999')
  const submitBtn = screen.getByRole('button', { name: /Salvar Paciente/i })

  fireEvent.change(nameInput, { target: { value: ' Matteus Moreira ' } })
  fireEvent.change(phoneInput, { target: { value: '22999021889' } })

  fireEvent.click(submitBtn)

  expect(mocks.createPatientAction).toHaveBeenCalledWith({
    name: 'Matteus Moreira',
    phone: '22999021889',
    birthDate: '2000-01-01',
  })
})

// ─── Testes de Remarcação & Desmarcação na QuickBookingPage ─────────────────

test('QuickBookingPage exibe Próximas Sessões do paciente e gerencia fluxo completo de remarcação com WhatsApp', async () => {
  mocks.rescheduleParticipant.mockClear()

  render(<QuickBookingPage />)

  // 1. Seleciona o paciente "Ana Carolina Souza"
  const searchInput = screen.getByPlaceholderText(/Clique para listar todos/i)
  fireEvent.focus(searchInput)
  fireEvent.click(screen.getByText('Ana Carolina Souza'))

  // 2. Card de Próximas Sessões deve ser exibido
  expect(screen.getByText(/Próximas Sessões de Ana Carolina Souza/i)).toBeTruthy()
  expect(screen.getAllByText('Dr Marcelo').length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('Turma Fixa')).toBeTruthy()

  // 3. Clica em "Remarcar" na aula recorrente
  const rescheduleBtn = screen.getByRole('button', { name: /Remarcar/i })
  fireEvent.click(rescheduleBtn)

  // 4. Modal de escolha de escopo deve abrir
  expect(screen.getByText('Remarcação de Turma Recorrente')).toBeTruthy()
  const singleScopeBtn = screen.getByText(/Apenas esta data/i)
  fireEvent.click(singleScopeBtn)

  // 5. Banner de Modo Remarcação Ativo deve estar visível
  expect(screen.getByText(/Modo Remarcação Ativo:/i)).toBeTruthy()
  expect(screen.getByText(/Aula de origem:/i)).toBeTruthy()

  // 6. Clica em um slot da grade semanal
  const slotBadge = screen.getByText('2/8')
  fireEvent.click(slotBadge)

  // 7. Drawer de sala abre com botão de transferir para uma das vagas
  const transferBtn = screen.getByRole('button', { name: /Transferir Vaga 3/i })
  fireEvent.click(transferBtn)

  // 8. Deve acionar a mutação rescheduleParticipant
  expect(mocks.rescheduleParticipant).toHaveBeenCalled()

  // 9. Modal de WhatsApp de confirmação de remarcação deve abrir
  await waitFor(() => {
    expect(screen.getByText('Confirmar Remarcação no WhatsApp')).toBeTruthy()
  })
})


