export type Role = "admin" | "reception" | "professional" | "patient"

export type Specialty = "Fisioterapia" | "Pilates" | "RPG"

export type RoomType =
  | "pilates_aparelhos"
  | "pilates_solo"
  | "rpg"
  | "fisioterapia"
  | "consultorio"

export interface Room {
  id: string
  name: string
  type: RoomType
  capacity: number
  color: string
  description?: string
  isActive: boolean
}

export interface Professional {
  id: string
  name: string
  email: string
  phone: string
  crefito: string
  specialties: Specialty[]
  commissionType: "percentage" | "fixed"
  commissionValue: number
  active: boolean
}

export interface Patient {
  id: string
  name: string
  documentCpf: string
  phone: string
  email?: string
  birthDate: string
  gender?: string
  address?: string
  emergencyContact?: string
  emergencyPhone?: string
  healthInsurance?: string
  notes?: string
  active: boolean
  createdAt: number
}

export type ScheduleStatus = "scheduled" | "in_progress" | "completed" | "cancelled"

export type SchedulePeriodMode = "day" | "week" | "month"

export type AttendanceStatus =
  | "scheduled"
  | "present"
  | "absence"
  | "justified_absence"
  | "replacement"

export interface ScheduleParticipant {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  status: AttendanceStatus
  checkedInAt?: number
  notes?: string
  patientPackageId?: string
  hasActivePackage?: boolean
  activePackageName?: string
  remainingSessions?: number
  totalSessions?: number
}

export interface Schedule {
  id: string
  title: string
  type: "individual" | "turma"
  specialty: "fisioterapia" | "pilates" | "rpg"
  roomId: string
  roomName: string
  roomColor: string
  roomCapacity: number
  professionalId: string
  professionalName: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  maxCapacity: number
  status: ScheduleStatus
  notes?: string
  participants: ScheduleParticipant[]
  activeCount?: number
  vacanciesLeft?: number
  recurringGroupId?: string
  isRecurring?: boolean
}

export interface ReplacementCredit {
  id: string
  patientId: string
  patientName: string
  patientPhone?: string
  patientCpf?: string
  generatedAt: number
  expiryDate: string
  status: "available" | "used" | "expired"
  originDate: string
  originTitle?: string
  originSpecialty?: string
  daysLeft?: number
  isExpired?: boolean
}

export interface RecurringScheduleSeriesParams {
  title: string
  type: "individual" | "turma"
  specialty: "fisioterapia" | "pilates" | "rpg"
  roomId: string
  professionalId: string
  startTime: string
  endTime: string
  maxCapacity: number
  daysOfWeek: number[] // 0: Dom, 1: Seg, 2: Ter, 3: Qua, 4: Qui, 5: Sex, 6: Sab
  startDate: string
  weeksCount: number
  notes?: string
  enrolledPatientIds?: string[]
}

export type PosturalViewType = "anterior" | "posterior" | "lateral_right" | "lateral_left"

export interface PainDataPoint {
  date: string
  painLevel: number
  sessionLabel: string
  professionalName: string
  technique?: string
}

export interface ClinicalRecord {
  patientId: string
  chiefComplaint: string
  hpi: string
  medicalHistory: string
  medications: string
  painScaleEva: number
  painLocation: string
  // Avaliação Postural e Biomecânica (4 Vistas Padronizadas)
  posturalNotes?: string
  posturalDate?: string
  posturalAlignmentMetrics?: string
  anteriorPhotoUrl?: string
  anteriorStorageId?: string
  posteriorPhotoUrl?: string
  posteriorStorageId?: string
  lateralPhotoUrl?: string // Retrocompatibilidade
  lateralRightPhotoUrl?: string
  lateralRightStorageId?: string
  lateralLeftPhotoUrl?: string
  lateralLeftStorageId?: string
  testsAndMeasures?: string
  clinicalGoals: string
  updatedAt: number
}

export interface ClinicalEvolution {
  id: string
  patientId: string
  patientName: string
  professionalId: string
  professionalName: string
  crefito: string
  date: string
  timestamp: number
  subjective: string
  objective: string
  assessment: string
  plan: string
  painScaleAfter?: number
  techniqueCategory?: string
  isLocked?: boolean
  signatureHash?: string
}

export interface ClinicalOverviewItem {
  patientId: string
  patientName: string
  patientCpf: string
  patientPhone: string
  patientBirthDate: string
  patientActive: boolean
  hasRecord: boolean
  chiefComplaint: string
  painScaleEva: number | null
  clinicalGoals: string
  posturalNotes: string
  evolutionsCount: number
  lastEvolutionDate: string | null
  lastTechnique: string | null
  lastPainAfter: number | null
  updatedAt: number
}


export interface FinancialTransaction {
  id: string
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  dueDate: string
  paymentDate?: string
  paymentMethod: "pix" | "dinheiro" | "cartao_debito" | "cartao_credito" | "transferencia"
  status: "pending" | "paid" | "cancelled"
  patientId?: string
  patientName?: string
  professionalId?: string
  professionalName?: string
  packageId?: string
  receiptIssued?: boolean
  isOverdue?: boolean
}

export interface CashFlowSummary {
  totalIncome: number
  totalExpense: number
  balance: number
  pendingIncome: number
  pendingExpense: number
  overdueIncome: number
  overdueExpense: number
  totalReceivable: number
  totalPayable: number
  projectedBalance: number
}

export interface CommissionAttendance {
  scheduleId: string
  date: string
  startTime: string
  title: string
  modality: string
  specialty: string
  patientId: string
  patientName: string
  sessionRevenue: number
  commissionEarned: number
}

export interface ProfessionalCommissionReport {
  professionalId: string
  professionalName: string
  crefito: string
  specialties: Specialty[] | string[]
  commissionType: "percentage" | "fixed"
  commissionRate: number
  totalAttendedSessions: number
  estimatedRevenue: number
  commissionPayable: number
  isClosed: boolean
  closedStatus?: "pending" | "paid"
  closedCommissionId?: string
  paidAt?: number
  attendancesList: CommissionAttendance[]
}

export interface ClosedCommission {
  _id: string
  professionalId: string
  professionalName: string
  crefito: string
  periodMonthYear: string
  totalAttendances: number
  totalGrossAmount: number
  totalCommissionAmount: number
  status: "pending" | "paid"
  paidAt?: number
  notes?: string
}

export interface NotificationLog {
  id: string
  channel: "whatsapp_uazapi" | "email_resend"
  recipientName: string
  recipientContact: string
  triggerType: string
  content: string
  status: "sent" | "failed" | "queued"
  timestamp: number
  scheduleId?: string
  errorMessage?: string
}

export interface NotificationStats {
  total: number
  totalSent: number
  totalFailed: number
  totalQueued: number
  whatsappCount: number
  emailCount: number
  todayCount: number
  successRate: number
}

export interface ClinicService {
  id: string
  name: string
  modality: "individual" | "turma"
  specialty: "fisioterapia" | "pilates" | "rpg"
  durationMinutes: number
  defaultPrice: number
  description?: string
  active: boolean
  packageCount?: number
}

export interface ClinicPackage {
  id: string
  name: string
  serviceId: string
  serviceName?: string
  modality?: "individual" | "turma"
  specialty?: "fisioterapia" | "pilates" | "rpg"
  sessionCount: number
  validityDays: number
  price: number // Preço Cartão Particular
  pricePix?: number // Valor à vista no Pix (Particular)
  cardInstallments?: number // Parcelas máximas no Cartão (Particular)
  insurancePrice?: number // Valor no Cartão com Plano de Saúde
  insurancePricePix?: number // Valor no Pix com Plano de Saúde
  insuranceCardInstallments?: number // Parcelas com Plano de Saúde
  groupDetails?: string // Detalhes da Turma / Modalidade (ex: "Grupo de até 8 Pessoas")
  showInPublicBooking?: boolean // Exibir no agendamento público
  pricePerSession?: number
  description?: string
  active: boolean
}

export interface PatientPackage {
  id: string
  patientId: string
  patientName?: string
  patientPhone?: string
  patientCpf?: string
  packageId: string
  packageName?: string
  packagePrice?: number
  serviceName?: string
  specialty?: string
  modality?: string
  totalSessions: number
  usedSessions: number
  remainingSessions: number
  startDate: string
  expiryDate: string
  status: "active" | "completed" | "expired"
  daysLeft?: number
  usagePercentage?: number
  isLowBalance?: boolean
  isExpiringSoon?: boolean
  needsRenewal?: boolean
}

export interface RenewalAlert {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  packageId: string
  packageName: string
  packagePrice: number
  totalSessions: number
  usedSessions: number
  remainingSessions: number
  expiryDate: string
  daysLeft: number
  isExpired: boolean
  isLowBalance: boolean
  isExpiringSoon: boolean
  reason: string
}

export type ClinicalDocumentType =
  | "certificate" // Atestado de comparecimento / declaração
  | "receipt" // Recibo para reembolso de plano de saúde
  | "tcle" // Termo de consentimento livre e esclarecido
  | "report" // Relatório / Laudo do prontuário

export interface ClinicalReport {
  id: string
  patientId: string
  professionalId: string
  type: ClinicalDocumentType
  title: string
  date: string
  chiefComplaint?: string
  painScaleEva?: number
  painLocation?: string
  hpi?: string
  clinicalGoals?: string
  diagnosticCid?: string
  evolutionSummary?: string
  conclusion?: string
  customNotes?: string
  purpose?: string
  receiptAmount?: number
  sessionsCount?: number
  paymentMethod?: string
  serviceDescription?: string
  documentHash: string
  signedProfessionalName: string
  crefito: string
  createdAt: number
  updatedAt: number
}

export interface AuditLog {
  id: string
  userId?: string
  userName: string
  userRole: string
  action: string
  patientId?: string
  patientName?: string
  details?: string
  ipAddress?: string
  timestamp: number
}

export interface PatientConsent {
  id: string
  patientId: string
  termType: "tcle_treatment" | "lgpd_data_processing" | "postural_photo_consent"
  accepted: boolean
  acceptedAt: number
  signedByName: string
  documentVersion: string
  ipAddress?: string
  notes?: string
}

export interface AvailabilityRule {
  id: string
  professionalId: string
  professionalName?: string
  professionalSpecialties?: string[]
  roomId: string
  roomName?: string
  roomColor?: string
  roomCapacity?: number
  specialty: "fisioterapia" | "pilates" | "rpg"
  dayOfWeek: number // 0 = Domingo, 1 = Segunda, ... 6 = Sábado
  startTime: string // "08:00"
  endTime: string // "12:00"
  slotDurationMinutes?: number
  breakMinutes?: number
  isActive: boolean
}

export interface AvailabilityOverride {
  id: string
  professionalId: string
  professionalName?: string
  roomId?: string
  roomName?: string
  date: string // YYYY-MM-DD
  type: "block" | "extra"
  startTime?: string
  endTime?: string
  specialty?: "fisioterapia" | "pilates" | "rpg"
  reason?: string
  createdAt: number
}


