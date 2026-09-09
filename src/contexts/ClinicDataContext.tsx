import React, { createContext, useContext, useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useAction } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
import { useAuth } from "@/contexts/AuthContext"
import type {
  Room,
  Professional,
  Patient,
  Schedule,
  ReplacementCredit,
  ClinicalRecord,
  ClinicalEvolution,
  FinancialTransaction,
  NotificationLog,
  NotificationStats,
  RecurringScheduleSeriesParams,
  PosturalViewType,
  PainDataPoint,
  ClinicService,
  ClinicPackage,
  PatientPackage,
  RenewalAlert,
  CashFlowSummary,
  ProfessionalCommissionReport,
  ClosedCommission,
  CommissionAttendance,
  AuditLog,
  PatientConsent,
  ClinicalOverviewItem,
  ClinicalReport,
  SchedulePeriodMode,
} from "@/types"
import {
  getTodayDateString,
  getCurrentMonthString,
  formatDateBR,
  addDaysSafe,
  formatDateISOInTz,
  getWeekRange,
  getMonthRange,
} from "@/lib/dateUtils"

interface ClinicDataContextType {
  // Rooms
  rooms: Room[]
  addRoom: (room: Omit<Room, "id">) => Promise<string | void>
  updateRoom: (id: string, data: Partial<Room>) => Promise<void>
  deleteRoom: (id: string) => Promise<void>

  // Professionals
  professionals: Professional[]
  addProfessional: (prof: Omit<Professional, "id">) => Promise<string | void>
  updateProfessional: (id: string, data: Partial<Professional>) => Promise<void>
  deleteProfessional: (id: string) => Promise<void>

  // Patients
  patients: Patient[]
  addPatient: (patient: Omit<Patient, "id" | "createdAt" | "active">) => Promise<string>
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>
  deletePatient: (id: string) => Promise<void>

  // Schedules & Classes
  schedules: Schedule[]
  selectedDate: string
  setSelectedDate: (date: string) => void
  schedulePeriodMode: SchedulePeriodMode
  setSchedulePeriodMode: (mode: SchedulePeriodMode) => void
  addSchedule: (schedule: Omit<Schedule, "id" | "participants">) => Promise<string>
  updateSchedule: (id: string, data: Partial<Schedule>) => Promise<void>
  deleteSchedule: (id: string, deleteSeries?: boolean) => Promise<void>
  removeParticipantFromSchedule: (scheduleId: string, participantRecordId: string) => Promise<void>
  addRecurringScheduleSeries: (params: RecurringScheduleSeriesParams) => Promise<{
    createdCount: number
    skippedCount: number
    skippedDates: { date: string; reason: string }[]
    recurringGroupId?: string
  }>
  checkIn: (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled",
    options?: {
      notes?: string
      debitPackageOnAbsence?: boolean
    }
  ) => Promise<{
    success: boolean
    hasPackage?: boolean
    remainingSessions?: number
    message?: string
  }>
  batchCheckIn: (scheduleId: string) => Promise<{
    success: boolean
    updatedCount: number
    message: string
  }>
  cancelWithReplacement: (
    scheduleId: string,
    participantId: string,
    reason?: string,
    forceExemption?: boolean
  ) => Promise<{
    success: boolean
    generatedCredit: boolean
    hoursNotice?: number
    message?: string
    creditId?: string
    expiryDate?: string
  }>
  addParticipantToClass: (
    scheduleId: string,
    patientId: string,
    isReplacement?: boolean,
    replacementCreditId?: string
  ) => Promise<void>

  // Replacement Credits
  replacementCredits: ReplacementCredit[]

  // Clinical
  clinicalOverview: ClinicalOverviewItem[]
  getClinicalRecord: (patientId: string) => ClinicalRecord | undefined
  saveClinicalRecord: (record: ClinicalRecord) => Promise<void>
  deleteClinicalRecord: (patientId: string) => Promise<void>
  getEvolutions: (patientId: string) => ClinicalEvolution[]
  addSoapEvolution: (evolution: Omit<ClinicalEvolution, "id" | "timestamp">) => Promise<void>
  updateSoapEvolution: (id: string, data: Partial<ClinicalEvolution>) => Promise<void>
  deleteSoapEvolution: (id: string, patientId: string) => Promise<void>
  uploadPosturalPhoto: (patientId: string, viewType: PosturalViewType, file: File) => Promise<string>
  getPainEvolutionHistory: (patientId: string) => PainDataPoint[]

  // Clinical Reports / Laudos
  clinicalReports: ClinicalReport[]
  getClinicalReports: (patientId: string) => ClinicalReport[]
  createClinicalReport: (report: Omit<ClinicalReport, "id" | "createdAt" | "updatedAt">) => Promise<ClinicalReport>
  updateClinicalReport: (id: string, data: Partial<ClinicalReport>) => Promise<void>
  deleteClinicalReport: (id: string) => Promise<void>

  // Services & Commercial Packages
  services: ClinicService[]
  addService: (service: Omit<ClinicService, "id" | "packageCount">) => Promise<string>
  updateService: (
    id: string,
    data: Omit<Partial<ClinicService>, "packagePricePerSession"> & {
      packagePricePerSession?: number | null
    }
  ) => Promise<void>
  deleteService: (id: string) => Promise<{ success: boolean; id: string }>
  packages: ClinicPackage[]
  patientPackages: PatientPackage[]
  renewalAlerts: RenewalAlert[]
  addPackage: (pkg: Omit<ClinicPackage, "id">) => Promise<string>
  updatePackage: (id: string, data: Partial<ClinicPackage>) => Promise<void>
  deletePackage: (id: string) => Promise<void>
  deletePatientPackage: (id: string) => Promise<void>
  assignPackageToPatient: (params: {
    patientId: string
    packageId: string
    startDate: string
    paymentMethod: "pix" | "dinheiro" | "cartao_debito" | "cartao_credito" | "transferencia"
    isPaid: boolean
  }) => Promise<any>


  // Finance & Commissions
  transactions: FinancialTransaction[]
  cashFlowSummary: CashFlowSummary
  commissionReports: ProfessionalCommissionReport[]
  closedCommissions: ClosedCommission[]
  selectedFinanceMonth: string
  setSelectedFinanceMonth: (month: string) => void
  addTransaction: (tx: Omit<FinancialTransaction, "id">) => Promise<string>
  updateTransaction: (id: string, data: Partial<FinancialTransaction>) => Promise<void>
  markTransactionPaid: (id: string, paymentDate?: string, paymentMethod?: any) => Promise<void>
  cancelTransaction: (id: string) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  closeProfessionalCommission: (params: {
    professionalId: string
    periodMonthYear: string
    totalAttendances: number
    totalGrossAmount: number
    totalCommissionAmount: number
    status: "pending" | "paid"
    notes?: string
    autoCreateExpense?: boolean
  }) => Promise<any>

  // Notifications Omnicanal (UAZAPI & Resend)
  notificationLogs: NotificationLog[]
  notificationStats: NotificationStats
  sendWhatsAppReminder: (
    schedule: Schedule,
    participant: { name: string; phone: string }
  ) => Promise<{ success: boolean; message?: string }>
  sendEmailReceipt: (
    patientName: string,
    email: string,
    amount: number,
    desc: string,
    paymentMethod?: string
  ) => Promise<{ success: boolean }>
  sendWhatsAppReceipt: (
    patientName: string,
    phone: string,
    amount: number,
    desc: string,
    paymentMethod?: string
  ) => Promise<{ success: boolean }>
  triggerUpcomingRemindersNow: () => Promise<any>
  testUazapiConnection: (
    phone: string,
    name: string
  ) => Promise<{ success: boolean; errorMessage?: string }>
  testResendConnection: (
    email: string,
    name: string
  ) => Promise<{ success: boolean; errorMessage?: string }>

  // Trilha de Auditoria LGPD & COFFITO
  auditLogs: AuditLog[]
  logAuditAction: (params: {
    action: string
    patientId?: string
    patientName?: string
    details?: string
    ipAddress?: string
  }) => Promise<void>
  savePatientConsent: (params: {
    patientId: string
    termType: "tcle_treatment" | "lgpd_data_processing" | "postural_photo_consent"
    accepted: boolean
    signedByName: string
    documentVersion: string
    notes?: string
  }) => Promise<void>
}








const todayStr = getTodayDateString()











const ClinicDataContext = createContext<ClinicDataContextType | undefined>(undefined)

export const ClinicDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])

  const [professionals, setProfessionals] = useState<Professional[]>([])

  const [patients, setPatients] = useState<Patient[]>([])

  const [schedules, setSchedules] = useState<Schedule[]>([])

  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const [schedulePeriodMode, setSchedulePeriodMode] = useState<SchedulePeriodMode>(() => {
    const s = localStorage.getItem("altar_schedule_period_mode")
    return s === "week" || s === "month" || s === "day" ? s : "day"
  })

  const handleSetSchedulePeriodMode = (mode: SchedulePeriodMode) => {
    setSchedulePeriodMode(mode)
    localStorage.setItem("altar_schedule_period_mode", mode)
  }

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate])
  const monthRange = useMemo(() => getMonthRange(selectedDate), [selectedDate])

  const [replacementCredits, setReplacementCredits] = useState<ReplacementCredit[]>([])

  const [clinicalRecords, setClinicalRecords] = useState<Record<string, ClinicalRecord>>({})

  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([])

  const [clinicalReports, setClinicalReports] = useState<ClinicalReport[]>([])

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])

  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])

  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState<string>(() =>
    getCurrentMonthString()
  )

  // Convex Real-Time Queries (WebSocket)
  const convexRooms = useQuery(api.rooms.listRooms)
  const convexProfessionals = useQuery(api.professionals.listProfessionals)
  const convexPatients = useQuery(api.patients.listPatients, {})
  const convexSchedulesDay = useQuery(
    api.schedules.listSchedulesByDate,
    schedulePeriodMode === "day" ? { date: selectedDate } : "skip"
  )
  const convexSchedulesRange = useQuery(
    api.schedules.listSchedulesByDateRange,
    schedulePeriodMode !== "day"
      ? {
          startDate: schedulePeriodMode === "week" ? weekRange.startDate : monthRange.startDate,
          endDate: schedulePeriodMode === "week" ? weekRange.endDate : monthRange.endDate,
        }
      : "skip"
  )
  const convexReplacementCredits = useQuery(api.schedules.listAvailableReplacementCredits, {})
  const convexTransactions = useQuery(
    api.finance.listTransactions,
    selectedFinanceMonth && selectedFinanceMonth !== "all" ? { monthYear: selectedFinanceMonth } : {}
  )
  const convexCashFlow = useQuery(
    api.finance.getCashFlowSummary,
    selectedFinanceMonth && selectedFinanceMonth !== "all" ? { monthYear: selectedFinanceMonth } : {}
  )
  const convexCommissions = useQuery(
    api.finance.calculateProfessionalCommissions,
    selectedFinanceMonth && selectedFinanceMonth !== "all" ? { monthYear: selectedFinanceMonth } : { monthYear: getCurrentMonthString() }
  )
  const convexClosedCommissions = useQuery(api.finance.listCommissions)
  const convexLogs = useQuery(api.notifications.listLogs, { limit: 50 })
  const convexNotificationStats = useQuery(api.notifications.getNotificationStats, {})
  const convexServices = useQuery(api.services.listServices)
  const convexPackages = useQuery(api.packages.listPackages)
  const convexPatientPackages = useQuery(api.packages.listPatientPackages, {})
  const convexRenewalAlerts = useQuery(api.packages.listRenewalAlerts)
  const convexAuditLogs = useQuery(api.audit.listAuditLogs, { limit: 50 })
  const convexClinicalOverview = useQuery(api.clinical.listAllClinicalOverview)
  const convexClinicalReports = useQuery(api.clinical.listClinicalReports, {})

  // Convex Mutations
  const createServiceMutation = useMutation(api.services.createService)
  const updateServiceMutation = useMutation(api.services.updateService)
  const deleteServiceMutation = useMutation(api.services.deleteService)
  const createRoomMutation = useMutation(api.rooms.createRoom)
  const updateRoomMutation = useMutation(api.rooms.updateRoom)
  const deleteRoomMutation = useMutation(api.rooms.deleteRoom)
  const createProfessionalMutation = useMutation(api.professionals.createProfessional)
  const updateProfessionalMutation = useMutation(api.professionals.updateProfessional)
  const deleteProfessionalMutation = useMutation(api.professionals.deleteProfessional)
  const createPatientMutation = useAction(api.patients.createPatient)
  const updatePatientMutation = useMutation(api.patients.updatePatient)
  const deletePatientMutation = useMutation(api.patients.deletePatient)
  const createScheduleMutation = useMutation(api.schedules.createSchedule)
  const updateScheduleMutation = useMutation(api.schedules.updateSchedule)
  const deleteScheduleMutation = useMutation(api.schedules.deleteSchedule)
  const removeParticipantMutation = useMutation(api.schedules.removeParticipantFromSchedule)
  const createRecurringScheduleMutation = useMutation(api.schedules.createRecurringScheduleSeries)
  const checkInMutation = useMutation(api.schedules.checkInParticipant)
  const batchCheckInMutation = useMutation(api.schedules.batchCheckInClass)
  const cancelWithReplacementMutation = useMutation(api.schedules.cancelWithReplacementCredit)
  const addParticipantMutation = useMutation(api.schedules.addParticipantToSchedule)
  const saveClinicalRecordMutation = useMutation(api.clinical.saveClinicalRecord)
  const deleteClinicalRecordMutation = useMutation(api.clinical.deleteClinicalRecord)
  const addSoapEvolutionMutation = useMutation(api.clinical.addSoapEvolution)
  const updateSoapEvolutionMutation = useMutation(api.clinical.updateSoapEvolution)
  const deleteSoapEvolutionMutation = useMutation(api.clinical.deleteSoapEvolution)
  const generateUploadUrlMutation = useMutation(api.clinical.generateUploadUrl)
  const attachPosturalPhotoMutation = useMutation(api.clinical.attachPosturalPhoto)
  const createClinicalReportMutation = useMutation(api.clinical.createClinicalReport)
  const updateClinicalReportMutation = useMutation(api.clinical.updateClinicalReport)
  const deleteClinicalReportMutation = useMutation(api.clinical.deleteClinicalReport)
  const createTransactionMutation = useMutation(api.finance.createTransaction)
  const updateTransactionMutation = useMutation(api.finance.updateTransaction)
  const markTransactionPaidMutation = useMutation(api.finance.markTransactionPaid)
  const cancelTransactionMutation = useMutation(api.finance.cancelTransaction)
  const deleteTransactionMutation = useMutation(api.finance.deleteTransaction)
  const closeProfessionalCommissionMutation = useMutation(api.finance.closeProfessionalCommission)
  const sendWhatsAppMutation = useMutation(api.notifications.sendWhatsAppReminder)
  const sendEmailReceiptMutation = useMutation(api.notifications.sendEmailReceipt)
  const createPackageMutation = useMutation(api.packages.createPackage)
  const updatePackageMutation = useMutation(api.packages.updatePackage)
  const deletePackageMutation = useMutation(api.packages.deletePackage)
  const deletePatientPackageMutation = useMutation(api.packages.deletePatientPackage)
  const assignPackageMutation = useMutation(api.packages.assignPackageToPatient)
  const logAuditMutation = useMutation(api.audit.logAction)
  const saveConsentMutation = useMutation(api.consents.saveConsent)



  // Convex Actions (Disparos I/O Assíncronos Omnicanal)
  const sendWhatsAppAction = useAction(api.notifications.sendWhatsAppNotificationAction)
  const sendEmailAction = useAction(api.notifications.sendEmailNotificationAction)
  const sendReceiptAction = useAction(api.notifications.sendReceiptNotificationAction)
  const triggerManualScanAction = useAction(api.notifications.triggerManualScanAction)
  const testUazapiAction = useAction(api.notifications.testUazapiConnectionAction)
  const testResendAction = useAction(api.notifications.testResendConnectionAction)

  const [packages, setPackages] = useState<ClinicPackage[]>([])

  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([])

  // Dados Derivados Reativos em Tempo Real (Convex com Fallback Otimista)
  const effectiveServices = (convexServices !== undefined)
    ? convexServices.map((s: any) => ({ ...s, id: s._id }))
    : []

  const effectivePackages = (convexPackages !== undefined)
    ? convexPackages.map((p: any) => ({ ...p, id: p._id }))
    : packages

  const effectivePatientPackages = (convexPatientPackages !== undefined)
    ? convexPatientPackages.map((pp: any) => ({ ...pp, id: pp._id }))
    : patientPackages


  const effectiveRenewalAlerts = (convexRenewalAlerts !== undefined)
    ? convexRenewalAlerts.map((ra: any) => ({ ...ra, id: ra._id }))
    : []


  const effectiveAuditLogs: AuditLog[] = (convexAuditLogs !== undefined)
    ? convexAuditLogs.map((l: any) => ({
        id: l._id,
        userId: l.userId,
        userName: l.userName,
        userRole: l.userRole,
        action: l.action,
        patientId: l.patientId,
        patientName: l.patientName,
        details: l.details,
        ipAddress: l.ipAddress,
        timestamp: l.timestamp,
      }))
    : []

  const effectiveRooms = (convexRooms !== undefined)
    ? convexRooms.map((r: any) => ({ ...r, id: r._id }))
    : rooms

  const effectiveProfessionals = (convexProfessionals !== undefined)
    ? convexProfessionals.map((p: any) => ({ ...p, id: p._id }))
    : professionals

  const effectivePatients = (convexPatients !== undefined)
    ? convexPatients.map((p: any) => ({ ...p, id: p._id }))
    : patients

  const rawSchedules = schedulePeriodMode === "day" ? convexSchedulesDay : convexSchedulesRange

  const localFilteredSchedules = useMemo(() => {
    if (schedulePeriodMode === "day") {
      return schedules.filter((s) => s.date === selectedDate)
    }
    if (schedulePeriodMode === "week") {
      return schedules.filter(
        (s) => s.date >= weekRange.startDate && s.date <= weekRange.endDate
      )
    }
    return schedules.filter(
      (s) => s.date >= monthRange.startDate && s.date <= monthRange.endDate
    )
  }, [schedules, schedulePeriodMode, selectedDate, weekRange, monthRange])

  const effectiveSchedules = (rawSchedules !== undefined && rawSchedules !== null)
    ? (rawSchedules.length > 0
        ? rawSchedules.map((s: any) => ({
            ...s,
            id: s._id,
            participants: (s.participants || []).map((p: any) => ({ ...p, id: p._id })),
          }))
        : [])
    : localFilteredSchedules

  const effectiveReplacementCredits = (convexReplacementCredits !== undefined)
    ? convexReplacementCredits.map((c: any) => ({
        ...c,
        id: c._id,
      }))
    : replacementCredits

  const effectiveTransactions = (convexTransactions !== undefined)
    ? convexTransactions.map((t: any) => ({ ...t, id: t._id }))
    : transactions

  const effectiveLogs = (convexLogs !== undefined)
    ? convexLogs.map((l: any) => ({ ...l, id: l._id }))
    : notificationLogs

  const effectiveNotificationStats: NotificationStats = convexNotificationStats || {
    total: effectiveLogs.length,
    totalSent: effectiveLogs.filter((l: any) => l.status === "sent").length,
    totalFailed: effectiveLogs.filter((l: any) => l.status === "failed").length,
    totalQueued: effectiveLogs.filter((l: any) => l.status === "queued").length,
    whatsappCount: effectiveLogs.filter((l: any) => l.channel === "whatsapp_uazapi").length,
    emailCount: effectiveLogs.filter((l: any) => l.channel === "email_resend").length,
    todayCount: effectiveLogs.length,
    successRate: 100,
  }

  const effectiveCashFlow: CashFlowSummary = convexCashFlow || (() => {
    let inc = 0, exp = 0, pInc = 0, pExp = 0, ovInc = 0, ovExp = 0
    const today = getTodayDateString()
    for (const t of effectiveTransactions) {
      if (t.status === "cancelled") continue
      if (t.status === "paid") {
        if (t.type === "income") inc += t.amount
        if (t.type === "expense") exp += t.amount
      } else if (t.status === "pending") {
        const isOv = t.dueDate < today
        if (t.type === "income") {
          pInc += t.amount
          if (isOv) ovInc += t.amount
        }
        if (t.type === "expense") {
          pExp += t.amount
          if (isOv) ovExp += t.amount
        }
      }
    }
    return {
      totalIncome: inc,
      totalExpense: exp,
      balance: inc - exp,
      pendingIncome: pInc,
      pendingExpense: pExp,
      overdueIncome: ovInc,
      overdueExpense: ovExp,
      totalReceivable: pInc,
      totalPayable: pExp,
      projectedBalance: (inc - exp) + pInc - pExp,
    }
  })()

  const effectiveCommissionReports: ProfessionalCommissionReport[] = (convexCommissions !== undefined)
    ? convexCommissions
    : effectiveProfessionals.map((prof: any) => {
        const profSchedules = effectiveSchedules.filter((s: any) => s.professionalId === prof.id)
        let totalAttended = 0
        let totalGross = 0
        const attendancesList: CommissionAttendance[] = []

        for (const sch of profSchedules) {
          const confirmed = (sch.participants || []).filter(
            (p: any) => p.status === "present" || p.status === "replacement"
          )
          for (const p of confirmed as any[]) {
            totalAttended++
            const sessionPrice = sch.type === "turma" ? 95 : 180
            const earned = prof.commissionType === "percentage"
              ? (sessionPrice * prof.commissionValue) / 100
              : prof.commissionValue
            totalGross += sessionPrice
            attendancesList.push({
              scheduleId: sch.id,
              date: sch.date,
              startTime: sch.startTime,
              title: sch.title,
              modality: sch.type === "turma" ? "Studio Pilates (Grupo)" : "Individual / RPG",
              specialty: sch.specialty.toUpperCase(),
              patientId: p.patientId,
              patientName: p.patientName,
              sessionRevenue: sessionPrice,
              commissionEarned: earned,
            })
          }
        }

        const commissionPayable = prof.commissionType === "percentage"
          ? (totalGross * prof.commissionValue) / 100
          : totalAttended * prof.commissionValue

        return {
          professionalId: prof.id,
          professionalName: prof.name,
          crefito: prof.crefito,
          specialties: prof.specialties,
          commissionType: prof.commissionType,
          commissionRate: prof.commissionValue,
          totalAttendedSessions: totalAttended,
          estimatedRevenue: totalGross,
          commissionPayable,
          isClosed: false,
          attendancesList,
        }
      })

  const effectiveClosedCommissions: ClosedCommission[] = (convexClosedCommissions !== undefined)
    ? convexClosedCommissions.map((c: any) => ({ ...c, id: c._id }))
    : []

  const effectiveClinicalOverview: ClinicalOverviewItem[] = (convexClinicalOverview !== undefined)
    ? convexClinicalOverview.map((item: any) => ({
        ...item,
        patientId: item.patientId,
      }))
    : effectivePatients.map((p) => {
        const record = clinicalRecords[p.id]
        const evos = (evolutions || []).filter((e) => e.patientId === p.id).sort((a, b) => b.timestamp - a.timestamp)
        const lastEvo = evos[0]
        return {
          patientId: p.id,
          patientName: p.name,
          patientCpf: p.documentCpf,
          patientPhone: p.phone,
          patientBirthDate: p.birthDate,
          patientActive: p.active,
          hasRecord: !!record,
          chiefComplaint: record?.chiefComplaint || "",
          painScaleEva: record?.painScaleEva ?? null,
          clinicalGoals: record?.clinicalGoals || "",
          posturalNotes: record?.posturalNotes || "",
          evolutionsCount: evos.length,
          lastEvolutionDate: lastEvo?.date || null,
          lastTechnique: lastEvo?.techniqueCategory || null,
          lastPainAfter: lastEvo?.painScaleAfter ?? null,
          updatedAt: record?.updatedAt ?? (lastEvo?.timestamp ?? p.createdAt),
        }
      })

  const effectiveClinicalReports: ClinicalReport[] =
    convexClinicalReports !== undefined
      ? convexClinicalReports.map((r: any) => ({
          ...r,
          id: r._id,
        }))
      : clinicalReports

  // Sync state to LocalStorage (Persistência Resiliente / Offline Fallback)













  const addRoom = async (roomData: Omit<Room, "id">) => {
    let createdId = `r_${Date.now()}`
    try {
      const cid = await createRoomMutation({
        name: roomData.name,
        type: roomData.type,
        capacity: roomData.capacity,
        color: roomData.color,
        description: roomData.description,
        isActive: roomData.isActive,
      })
      if (cid) createdId = cid
    } catch (err) {
      throw err
    }
    const newRoom: Room = { ...roomData, id: createdId }
    setRooms((prev) => [...prev, newRoom])
    return createdId
  }

  const updateRoom = async (id: string, data: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)))
    try {
      await updateRoomMutation({
        id: id as any,
        name: data.name || "",
        type: (data.type || "pilates_aparelhos") as any,
        capacity: data.capacity || 4,
        color: data.color || "#10b981",
        isActive: data.isActive ?? true,
        description: data.description,
      })
    } catch (err) {
      throw err
    }
  }

  const deleteRoom = async (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id))
    try {
      await deleteRoomMutation({ id: id as any })
    } catch (err) {
      throw err
    }
  }

  const addProfessional = async (profData: Omit<Professional, "id">) => {
    let createdId = `prof_${Date.now()}`
    try {
      const cid = await createProfessionalMutation({
        name: profData.name,
        email: profData.email,
        phone: profData.phone,
        crefito: profData.crefito,
        specialties: profData.specialties as string[],
        commissionType: profData.commissionType,
        commissionValue: profData.commissionValue,
        active: profData.active,
      })
      if (cid) createdId = cid
    } catch (err) {
      throw err
    }
    const newProf: Professional = { ...profData, id: createdId }
    setProfessionals((prev) => [...prev, newProf])
    return createdId
  }

  const updateProfessional = async (id: string, data: Partial<Professional>) => {
    setProfessionals((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
    try {
      await updateProfessionalMutation({
        id: id as any,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        crefito: data.crefito || "",
        specialties: (data.specialties || []) as string[],
        commissionType: data.commissionType || "percentage",
        commissionValue: data.commissionValue ?? 40,
        active: data.active ?? true,
      })
    } catch (err) {
      throw err
    }
  }

  const deleteProfessional = async (id: string) => {
    setProfessionals((prev) => prev.filter((p) => p.id !== id))
    try {
      await deleteProfessionalMutation({ id: id as any })
    } catch (err) {
      throw err
    }
  }

  const addPatient = async (patientData: Omit<Patient, "id" | "createdAt" | "active">) => {
    return await createPatientMutation({
      name: patientData.name,
      documentCpf: patientData.documentCpf,
      phone: patientData.phone,
      email: patientData.email,
      birthDate: patientData.birthDate,
      gender: patientData.gender,
      cep: patientData.cep,
      address: patientData.address,
      emergencyContact: patientData.emergencyContact,
      emergencyPhone: patientData.emergencyPhone,
      healthInsurance: patientData.healthInsurance,
      notes: patientData.notes,
    })
  }

  const updatePatient = async (id: string, data: Partial<Patient>) => {
    const { name, documentCpf, phone, birthDate, active, email, gender, cep, address, emergencyContact, emergencyPhone, healthInsurance, notes } = data
    await updatePatientMutation({ id: id as any, name, documentCpf, phone, birthDate, active, email, gender, cep, address, emergencyContact, emergencyPhone, healthInsurance, notes })
  }

  const deletePatient = async (id: string) => {
    await deletePatientMutation({ id: id as any })
    setPatients((prev) => prev.filter((p) => p.id !== id))
  }


  const addSchedule = async (scheduleData: Omit<Schedule, "id" | "participants">): Promise<string> => {
    // Validação de conflito e persistência via Convex
    try {
      const scheduleId = await createScheduleMutation({
        title: scheduleData.title,
        type: scheduleData.type,
        specialty: scheduleData.specialty,
        roomId: scheduleData.roomId as any,
        professionalId: scheduleData.professionalId as any,
        date: scheduleData.date,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        maxCapacity: scheduleData.maxCapacity,
        notes: scheduleData.notes,
      })

      const newSchedule: Schedule = {
        ...scheduleData,
        id: scheduleId,
        participants: [],
      }
      setSchedules((prev) => [...prev, newSchedule])
      return scheduleId
    } catch (err: any) {
      if (err?.message) {
        throw err
      }
      // Fallback local se estiver offline
      const fallbackId = `sch_${Date.now()}`
      const newSchedule: Schedule = {
        ...scheduleData,
        id: fallbackId,
        participants: [],
      }
      setSchedules((prev) => [...prev, newSchedule])
      return fallbackId
    }
  }

  const addRecurringScheduleSeries = async (params: RecurringScheduleSeriesParams) => {
    try {
      const result = await createRecurringScheduleMutation({
        title: params.title,
        type: params.type,
        specialty: params.specialty,
        roomId: params.roomId as any,
        professionalId: params.professionalId as any,
        startTime: params.startTime,
        endTime: params.endTime,
        maxCapacity: params.maxCapacity,
        daysOfWeek: params.daysOfWeek,
        startDate: params.startDate,
        weeksCount: params.weeksCount,
        notes: params.notes,
        enrolledPatientIds: params.enrolledPatientIds as any,
      })
      return result
    } catch (err: any) {
      console.error("Erro ao criar série recorrente:", err)
      throw err
    }
  }

  const updateSchedule = async (id: string, data: Partial<Schedule>) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)))
    try {
      await updateScheduleMutation({
        id: id as any,
        title: data.title,
        specialty: data.specialty,
        roomId: data.roomId as any,
        professionalId: data.professionalId as any,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        maxCapacity: data.maxCapacity,
        notes: data.notes,
        status: data.status,
      })
    } catch (err) {
      throw err
    }
  }

  const deleteSchedule = async (id: string, deleteSeries?: boolean) => {
    setSchedules((prev) => {
      const target = prev.find((s) => s.id === id)
      if (deleteSeries && target?.recurringGroupId) {
        return prev.filter((s) => s.recurringGroupId !== target.recurringGroupId)
      }
      return prev.filter((s) => s.id !== id)
    })
    try {
      await deleteScheduleMutation({
        id: id as any,
        deleteSeries: !!deleteSeries,
      })
    } catch (err) {
      throw err
    }
  }

  const removeParticipantFromSchedule = async (scheduleId: string, participantRecordId: string) => {
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          participants: s.participants.filter((p) => p.id !== participantRecordId),
        }
      })
    )
    try {
      await removeParticipantMutation({
        scheduleId: scheduleId as any,
        participantRecordId: participantRecordId as any,
      })
    } catch (err) {
      throw err
    }
  }


  const checkIn = async (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled",
    options?: {
      notes?: string
      debitPackageOnAbsence?: boolean
    }
  ) => {
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          participants: s.participants.map((p) => {
            if (p.id !== participantId) return p
            return {
              ...p,
              status,
              notes: options?.notes !== undefined ? options.notes : p.notes,
              checkedInAt: status === "present" ? Date.now() : undefined,
            }
          }),
        }
      })
    )

    try {
      const res = await checkInMutation({
        participantId: participantId as any,
        status,
        notes: options?.notes,
        debitPackageOnAbsence: options?.debitPackageOnAbsence,
      })
      return res
    } catch (err) {
      throw err
      return {
        success: true,
        hasPackage: false,
        message: status === "present" ? "Presença confirmada" : "Presença ou falta registrada",
      }
    }
  }

  const batchCheckIn = async (
    scheduleId: string
  ): Promise<{
    success: boolean
    updatedCount: number
    message: string
  }> => {
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          participants: s.participants.map((p) => {
            if (p.status === "justified_absence") return p
            return {
              ...p,
              status: "present",
              checkedInAt: Date.now(),
            }
          }),
        }
      })
    )

    try {
      const res = await batchCheckInMutation({
        scheduleId: scheduleId as any,
      })
      return {
        success: res?.success ?? true,
        updatedCount: res?.updatedCount ?? 0,
        message: res?.message ?? "Presenças em lote confirmadas",
      }
    } catch (err) {
      throw err
      return {
        success: true,
        updatedCount: 0,
        message: "Presenças em lote confirmadas",
      }
    }
  }

  const addService = async (serviceData: Omit<ClinicService, "id" | "packageCount">): Promise<string> => {
    const id = await createServiceMutation({
      name: serviceData.name,
      modality: serviceData.modality,
      specialty: serviceData.specialty,
      maxCapacity: serviceData.maxCapacity,
      durationMinutes: serviceData.durationMinutes,
      defaultPrice: serviceData.defaultPrice,
      packagePricePerSession: serviceData.packagePricePerSession,
      description: serviceData.description,
      active: serviceData.active,
    })
    return id
  }

  const updateService = async (
    id: string,
    data: Omit<Partial<ClinicService>, "packagePricePerSession"> & {
      packagePricePerSession?: number | null
    }
  ): Promise<void> => {
    await updateServiceMutation({
      id: id as any,
      name: data.name,
      modality: data.modality,
      specialty: data.specialty,
      maxCapacity: data.maxCapacity,
      durationMinutes: data.durationMinutes,
      defaultPrice: data.defaultPrice,
      packagePricePerSession: data.packagePricePerSession,
      description: data.description,
      active: data.active,
    })
  }

  const deleteService = async (id: string): Promise<{ success: boolean; id: string }> => {
    return await deleteServiceMutation({ id: id as any })
  }

  const addPackage = async (pkgData: Omit<ClinicPackage, "id">): Promise<string> => {
    let createdId = `pkg_${Date.now()}`
    try {
      const id = await createPackageMutation({
        name: pkgData.name,
        serviceId: pkgData.serviceId as any,
        sessionCount: pkgData.sessionCount,
        validityDays: pkgData.validityDays,
        price: pkgData.price,
        pricePix: pkgData.pricePix,
        cardInstallments: pkgData.cardInstallments,
        insurancePrice: pkgData.insurancePrice,
        insurancePricePix: pkgData.insurancePricePix,
        insuranceCardInstallments: pkgData.insuranceCardInstallments,
        groupDetails: pkgData.groupDetails,
        showInPublicBooking: pkgData.showInPublicBooking ?? true,
        description: pkgData.description,
        active: pkgData.active,
      })
      if (id) createdId = id
    } catch (err: any) {
      throw err
    }

    const newPkg: ClinicPackage = {
      ...pkgData,
      id: createdId,
      serviceName: effectiveServices.find((s) => s.id === pkgData.serviceId)?.name || "Serviço",
      pricePerSession: pkgData.sessionCount > 0 ? Number((pkgData.price / pkgData.sessionCount).toFixed(2)) : 0,
    }
    setPackages((prev) => [...prev, newPkg])
    return createdId

  }

  const updatePackage = async (id: string, data: Partial<ClinicPackage>) => {
    setPackages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const updated = { ...p, ...data }
        if (updated.sessionCount && updated.sessionCount > 0 && updated.price) {
          updated.pricePerSession = Number((updated.price / updated.sessionCount).toFixed(2))
        }
        return updated
      })
    )
    try {
      await updatePackageMutation({
        id: id as any,
        name: data.name,
        serviceId: data.serviceId as any,
        sessionCount: data.sessionCount,
        validityDays: data.validityDays,
        price: data.price,
        pricePix: data.pricePix,
        cardInstallments: data.cardInstallments,
        insurancePrice: data.insurancePrice,
        insurancePricePix: data.insurancePricePix,
        insuranceCardInstallments: data.insuranceCardInstallments,
        groupDetails: data.groupDetails,
        showInPublicBooking: data.showInPublicBooking,
        description: data.description,
        active: data.active,
      })
    } catch (err) {
      throw err
    }
  }

  const deletePackage = async (id: string) => {
    try {
      await deletePackageMutation({ id: id as any })
      setPackages((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      throw err
    }
  }

  const deletePatientPackage = async (id: string) => {
    setPatientPackages((prev) => prev.filter((pp) => pp.id !== id))
    try {
      await deletePatientPackageMutation({ id: id as any })
    } catch (err) {
      throw err
    }
  }


  const assignPackageToPatient = async (params: {
    patientId: string
    packageId: string
    startDate: string
    paymentMethod: "pix" | "dinheiro" | "cartao_debito" | "cartao_credito" | "transferencia"
    isPaid: boolean
  }) => {
    try {
      const res = await assignPackageMutation({
        patientId: params.patientId as any,
        packageId: params.packageId as any,
        startDate: params.startDate,
        paymentMethod: params.paymentMethod,
        isPaid: params.isPaid,
      })
      return res
    } catch (err: any) {
      console.error("Erro ao vincular pacote ao paciente:", err)
      throw err
    }
  }

  // Desmarcação inteligente com checagem de antecedência e geração de crédito de reposição
  const cancelWithReplacement = async (
    scheduleId: string,
    participantId: string,
    reason?: string,
    forceExemption?: boolean
  ) => {
    const schedule = schedules.find((s) => s.id === scheduleId)
    const participant = schedule?.participants.find((p) => p.id === participantId)

    try {
      const res = await cancelWithReplacementMutation({
        participantId: participantId as any,
        reason,
        forceExemption,
      })

      if (res.generatedCredit && res.creditId && participant) {
        const credit: ReplacementCredit = {
          id: res.creditId,
          patientId: participant.patientId,
          patientName: participant.patientName,
          generatedAt: Date.now(),
          expiryDate: res.expiryDate,
          status: "available",
          originDate: schedule?.date || todayStr,
        }
        setReplacementCredits((prev) => [credit, ...prev])
      }

      setSchedules((prev) =>
        prev.map((s) => {
          if (s.id !== scheduleId) return s
          return {
            ...s,
            participants: s.participants.map((p) => {
              if (p.id !== participantId) return p
              return {
                ...p,
                status: res.generatedCredit ? "justified_absence" : "absence",
                notes: reason || (res.generatedCredit ? "Desmarcado (Reposição gerada)" : "Falta"),
              }
            }),
          }
        })
      )

      return res
    } catch (err) {
      // Fallback local caso offline
      const expiryStr = addDaysSafe(schedule?.date || todayStr, 30)

      if (participant) {
        const credit: ReplacementCredit = {
          id: `rep_${Date.now()}`,
          patientId: participant.patientId,
          patientName: participant.patientName,
          generatedAt: Date.now(),
          expiryDate: expiryStr,
          status: "available",
          originDate: schedule?.date || todayStr,
        }
        setReplacementCredits((prev) => [credit, ...prev])
      }

      setSchedules((prev) =>
        prev.map((s) => {
          if (s.id !== scheduleId) return s
          return {
            ...s,
            participants: s.participants.map((p) => {
              if (p.id !== participantId) return p
              return {
                ...p,
                status: "justified_absence",
                notes: reason || "Desmarcado (Reposição gerada)",
              }
            }),
          }
        })
      )

      return {
        success: true,
        generatedCredit: true,
        expiryDate: expiryStr,
      }
    }
  }

  const addParticipantToClass = async (
    scheduleId: string,
    patientId: string,
    isReplacement?: boolean,
    replacementCreditId?: string
  ) => {
    const schedule = schedules.find((s) => s.id === scheduleId)
    const patient = patients.find((p) => p.id === patientId)
    if (!schedule || !patient) return

    const activeParticipants = schedule.participants.filter(
      (p) => p.status !== "justified_absence"
    )
    if (activeParticipants.length >= schedule.maxCapacity) {
      throw new Error("A capacidade máxima da sala já foi atingida!")
    }

    try {
      await addParticipantMutation({
        scheduleId: scheduleId as any,
        patientId: patientId as any,
        isReplacement: !!isReplacement,
        replacementCreditId: replacementCreditId as any,
      })
    } catch (err: any) {
      if (err?.message) throw err
    }

    const newParticipant: any = {
      id: `part_${Date.now()}`,
      patientId,
      patientName: patient.name,
      patientPhone: patient.phone,
      status: isReplacement ? "replacement" : "scheduled",
    }

    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          participants: [...s.participants, newParticipant],
        }
      })
    )

    if (isReplacement) {
      setReplacementCredits((prev) =>
        prev.map((c) =>
          (replacementCreditId ? c.id === replacementCreditId : (c.patientId === patientId && c.status === "available"))
            ? { ...c, status: "used" }
            : c
        )
      )
    }
  }

  const getClinicalRecord = (patientId: string) => clinicalRecords[patientId]

  const saveClinicalRecord = async (record: ClinicalRecord) => {
    await saveClinicalRecordMutation({
        patientId: record.patientId as any,
        chiefComplaint: record.chiefComplaint,
        hpi: record.hpi,
        medicalHistory: record.medicalHistory,
        medications: record.medications,
        painScaleEva: record.painScaleEva,
        painLocation: record.painLocation,
        posturalNotes: record.posturalNotes,
        posturalDate: record.posturalDate,
        posturalAlignmentMetrics: record.posturalAlignmentMetrics,
        anteriorPhotoUrl: record.anteriorPhotoUrl,
        anteriorStorageId: record.anteriorStorageId,
        posteriorPhotoUrl: record.posteriorPhotoUrl,
        posteriorStorageId: record.posteriorStorageId,
        lateralPhotoUrl: record.lateralPhotoUrl,
        lateralRightPhotoUrl: record.lateralRightPhotoUrl,
        lateralRightStorageId: record.lateralRightStorageId,
        lateralLeftPhotoUrl: record.lateralLeftPhotoUrl,
        lateralLeftStorageId: record.lateralLeftStorageId,
        testsAndMeasures: record.testsAndMeasures,
        clinicalGoals: record.clinicalGoals,
      })
    setClinicalRecords(prev => ({ ...prev, [record.patientId]: record }))
  }

  const deleteClinicalRecord = async (patientId: string) => {
    const result = await deleteClinicalRecordMutation({ patientId: patientId as any })
    if (!result.success) {
      throw new Error(result.message || "Prontuário não encontrado")
    }

    setClinicalRecords((prev) => {
      const copy = { ...prev }
      delete copy[patientId]
      return copy
    })
  }

  const getEvolutions = (patientId: string) => {
    return evolutions.filter((e) => e.patientId === patientId)
  }

  const addSoapEvolution = async (evoData: Omit<ClinicalEvolution, "id" | "timestamp">) => {
    await addSoapEvolutionMutation({
        patientId: evoData.patientId as any,
        professionalId: evoData.professionalId as any,
        date: evoData.date,
        subjective: evoData.subjective,
        objective: evoData.objective,
        assessment: evoData.assessment,
        plan: evoData.plan,
        painScaleAfter: evoData.painScaleAfter,
        techniqueCategory: evoData.techniqueCategory,
      })
  }

  const updateSoapEvolution = async (id: string, data: Partial<ClinicalEvolution>) => {
    setEvolutions((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)))
    try {
      await updateSoapEvolutionMutation({
        id: id as any,
        subjective: data.subjective || "",
        objective: data.objective || "",
        assessment: data.assessment || "",
        plan: data.plan || "",
        painScaleAfter: data.painScaleAfter,
        techniqueCategory: data.techniqueCategory,
        date: data.date,
      })
    } catch (err) {
      throw err
    }
  }

  const deleteSoapEvolution = async (id: string, patientId: string) => {
    setEvolutions((prev) => prev.filter((e) => e.id !== id))
    try {
      await deleteSoapEvolutionMutation({ id: id as any })
    } catch (err) {
      throw err
    }
  }


  const uploadPosturalPhoto = async (patientId: string, viewType: PosturalViewType, file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use imagem JPG, PNG ou WebP de até 5 MB.')
    const uploadUrl = await generateUploadUrlMutation()
    const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
    if (!response.ok) throw new Error('Falha no envio da imagem. Tente novamente.')
    const { storageId } = await response.json()
    if (!storageId) throw new Error('Upload sem confirmação. Tente novamente.')
    const view = viewType === 'lateral_right' ? 'lateralRight' : viewType === 'lateral_left' ? 'lateralLeft' : viewType
    const url = await attachPosturalPhotoMutation({ patientId: patientId as any, view: view as any, storageId })
    if (!url) throw new Error('Não foi possível consultar a imagem salva.')
    return url
  }

  const getPainEvolutionHistory = (patientId: string): PainDataPoint[] => {
    const record = clinicalRecords[patientId]
    const patientEvos = evolutions
      .filter((e) => e.patientId === patientId && e.painScaleAfter !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp)

    const points: PainDataPoint[] = []

    if (record) {
      points.push({
        date: formatDateISOInTz(record.updatedAt),
        painLevel: record.painScaleEva,
        sessionLabel: "Avaliação Inicial (Anamnese)",
        professionalName: "Equipe Altar Fisio",
        technique: "Avaliação",
      })
    }

    patientEvos.forEach((evo, idx) => {
      points.push({
        date: evo.date,
        painLevel: evo.painScaleAfter!,
        sessionLabel: `Sessão ${idx + 1}`,
        professionalName: evo.professionalName,
        technique: evo.techniqueCategory ?? "Sessão Clínica",
      })
    })

    return points
  }

  const getClinicalReports = (patientId: string) => {
    return effectiveClinicalReports
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  const createClinicalReport = async (
    reportData: Omit<ClinicalReport, "id" | "createdAt" | "updatedAt">
  ): Promise<ClinicalReport> => {
    const prof = professionals.find((p) => p.id === reportData.professionalId) || professionals[0]
    const cleanCrefito = prof?.crefito ? prof.crefito.replace(/[^A-Za-z0-9]/g, "") : "CREFITO"
    const now = Date.now()
    const documentHash =
      reportData.documentHash || `COFFITO-${cleanCrefito}-${now.toString(36).toUpperCase()}`

    const newReport: ClinicalReport = {
      ...reportData,
      id: `rep_${now}`,
      documentHash,
      signedProfessionalName: prof?.name || "Dr. Marcelo Henrique",
      crefito: prof?.crefito || "CREFITO-3 / 184520-F",
      createdAt: now,
      updatedAt: now,
    }

    setClinicalReports((prev) => [newReport, ...prev])

    try {
      if (createClinicalReportMutation) {
        await createClinicalReportMutation({
          patientId: reportData.patientId as any,
          professionalId: reportData.professionalId as any,
          type: reportData.type,
          title: reportData.title,
          date: reportData.date,
          chiefComplaint: reportData.chiefComplaint,
          painScaleEva: reportData.painScaleEva,
          painLocation: reportData.painLocation,
          hpi: reportData.hpi,
          clinicalGoals: reportData.clinicalGoals,
          diagnosticCid: reportData.diagnosticCid,
          evolutionSummary: reportData.evolutionSummary,
          conclusion: reportData.conclusion,
          customNotes: reportData.customNotes,
          purpose: reportData.purpose,
          receiptAmount: reportData.receiptAmount,
          sessionsCount: reportData.sessionsCount,
          paymentMethod: reportData.paymentMethod,
          serviceDescription: reportData.serviceDescription,
        })
      }
    } catch (err) {
      throw err
    }

    return newReport
  }

  const updateClinicalReport = async (id: string, data: Partial<ClinicalReport>) => {
    setClinicalReports((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...data, updatedAt: Date.now() }
          if (data.professionalId && data.professionalId !== r.professionalId) {
            const prof = professionals.find((p) => p.id === data.professionalId)
            if (prof) {
              updated.signedProfessionalName = prof.name
              updated.crefito = prof.crefito
            }
          }
          return updated
        }
        return r
      })
    )

    try {
      if (updateClinicalReportMutation) {
        await updateClinicalReportMutation({
          id: id as any,
          title: data.title,
          date: data.date,
          chiefComplaint: data.chiefComplaint,
          painScaleEva: data.painScaleEva,
          painLocation: data.painLocation,
          hpi: data.hpi,
          clinicalGoals: data.clinicalGoals,
          diagnosticCid: data.diagnosticCid,
          evolutionSummary: data.evolutionSummary,
          conclusion: data.conclusion,
          customNotes: data.customNotes,
          purpose: data.purpose,
          receiptAmount: data.receiptAmount,
          sessionsCount: data.sessionsCount,
          paymentMethod: data.paymentMethod,
          serviceDescription: data.serviceDescription,
          professionalId: data.professionalId as any,
        })
      }
    } catch (err) {
      throw err
    }
  }

  const deleteClinicalReport = async (id: string) => {
    setClinicalReports((prev) => prev.filter((r) => r.id !== id))
    try {
      if (deleteClinicalReportMutation) {
        await deleteClinicalReportMutation({ id: id as any })
      }
    } catch (err) {
      throw err
    }
  }

  const addTransaction = async (txData: Omit<FinancialTransaction, "id">) => {
    let createdId = `tx_${Date.now()}`
    try {
      const cid = await createTransactionMutation({
        type: txData.type,
        category: txData.category,
        description: txData.description,
        amount: txData.amount,
        dueDate: txData.dueDate,
        paymentDate: txData.paymentDate,
        paymentMethod: txData.paymentMethod,
        status: txData.status,
        patientId: txData.patientId ? (txData.patientId as any) : undefined,
        professionalId: txData.professionalId ? (txData.professionalId as any) : undefined,
        packageId: txData.packageId ? (txData.packageId as any) : undefined,
        receiptIssued: txData.receiptIssued ?? false,
      })
      if (cid) createdId = cid
    } catch (err) {
      throw err
    }

    const newTx: FinancialTransaction = {
      ...txData,
      id: createdId,
      patientId: txData.patientId || undefined,
      patientName: txData.patientName || undefined,
      professionalId: txData.professionalId || undefined,
      professionalName: txData.professionalName || undefined,
    }
    setTransactions((prev) => [newTx, ...prev])
    return createdId
  }

  const updateTransaction = async (id: string, data: Partial<FinancialTransaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    )
    try {
      await updateTransactionMutation({
        id: id as any,
        category: data.category,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        status: data.status,
        receiptIssued: data.receiptIssued,
      })
    } catch (err) {
      throw err
    }
  }

  const markTransactionPaid = async (id: string, paymentDate?: string, paymentMethod?: any) => {
    const pDate = paymentDate || todayStr
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "paid", paymentDate: pDate, ...(paymentMethod ? { paymentMethod } : {}) } : t
      )
    )

    try {
      await markTransactionPaidMutation({
        id: id as any,
        paymentDate: pDate,
        ...(paymentMethod ? { paymentMethod } : {}),
      })
    } catch (err) {
      throw err
    }
  }

  const cancelTransaction = async (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "cancelled" } : t))
    )
    try {
      await cancelTransactionMutation({ id: id as any })
    } catch (err) {
      throw err
    }
  }

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTransactionMutation({ id: id as any })
    } catch (err) {
      throw err
    }
  }

  const closeProfessionalCommission = async (params: {
    professionalId: string
    periodMonthYear: string
    totalAttendances: number
    totalGrossAmount: number
    totalCommissionAmount: number
    status: "pending" | "paid"
    notes?: string
    autoCreateExpense?: boolean
  }) => {
    try {
      const res = await closeProfessionalCommissionMutation({
        professionalId: params.professionalId as any,
        periodMonthYear: params.periodMonthYear,
        totalAttendances: params.totalAttendances,
        totalGrossAmount: params.totalGrossAmount,
        totalCommissionAmount: params.totalCommissionAmount,
        status: params.status,
        notes: params.notes,
        autoCreateExpense: params.autoCreateExpense ?? true,
      })
      return res
    } catch (err) {
      console.warn("Convex error (closeProfessionalCommission):", err)
      return { success: false }
    }
  }

  const sendWhatsAppReminder = async (
    schedule: Schedule,
    participant: { name: string; phone: string }
  ) => {
    const message = `Olá, *${participant.name}*! 👋\n\nEste é um lembrete do seu atendimento na *Altar Fisio*:\n\n📅 *Data:* ${formatDateBR(schedule.date)}\n⏰ *Horário:* ${schedule.startTime}\n👨‍⚕️ *Profissional:* ${schedule.professionalName}\n📍 *Local:* ${schedule.roomName}\n\n⚠️ *Aviso importante:* Caso precise desmarcar, avise com antecedência para liberar seu crédito de reposição.\n\nEstamos ansiosos para te receber! ✨`

    const newLog: NotificationLog = {
      id: `log_${Date.now()}`,
      channel: "whatsapp_uazapi",
      recipientName: participant.name,
      recipientContact: participant.phone,
      triggerType: "lembrete_manual",
      content: message,
      status: "sent",
      timestamp: Date.now(),
    }
    setNotificationLogs((prev) => [newLog, ...prev])

    try {
      const res = await sendWhatsAppAction({
        recipientName: participant.name,
        phone: participant.phone,
        message,
        triggerType: "lembrete_manual",
        scheduleId: schedule.id ? String(schedule.id) : undefined,
      })
      return { success: res.success, message: res.errorMessage }
    } catch (err: any) {
      throw err
      return { success: false, message: err?.message || "Erro ao comunicar com o gateway WhatsApp" }
    }
  }

  const sendEmailReceipt = async (
    patientName: string,
    email: string,
    amount: number,
    desc: string,
    paymentMethod = "pix"
  ) => {
    const newLog: NotificationLog = {
      id: `log_${Date.now()}`,
      channel: "email_resend",
      recipientName: patientName,
      recipientContact: email,
      triggerType: "recibo_pagamento",
      content: `Recibo de R$ ${amount.toFixed(2)} (${desc}) enviado via Resend para ${email}.`,
      status: "sent",
      timestamp: Date.now(),
    }
    setNotificationLogs((prev) => [newLog, ...prev])

    try {
      const res = await sendReceiptAction({
        patientName,
        email,
        description: desc,
        amount,
        paymentDate: todayStr,
        paymentMethod,
      })
      return { success: !!res.emailSent }
    } catch (err) {
      throw err
      return { success: true }
    }
  }

  const sendWhatsAppReceipt = async (
    patientName: string,
    phone: string,
    amount: number,
    desc: string,
    paymentMethod = "pix"
  ) => {
    const newLog: NotificationLog = {
      id: `log_${Date.now()}`,
      channel: "whatsapp_uazapi",
      recipientName: patientName,
      recipientContact: phone,
      triggerType: "recibo_pagamento",
      content: `Recibo de R$ ${amount.toFixed(2)} (${desc}) enviado via WhatsApp para ${phone}.`,
      status: "sent",
      timestamp: Date.now(),
    }
    setNotificationLogs((prev) => [newLog, ...prev])

    try {
      const res = await sendReceiptAction({
        patientName,
        phone,
        description: desc,
        amount,
        paymentDate: todayStr,
        paymentMethod,
      })
      return { success: !!res.whatsappSent }
    } catch (err) {
      throw err
      return { success: true }
    }
  }

  const triggerUpcomingRemindersNow = async () => {
    try {
      return await triggerManualScanAction({})
    } catch (err: any) {
      console.warn("Manual scan warning:", err)
      return { success: false, error: err?.message || "Erro ao executar varredura" }
    }
  }

  const testUazapiConnection = async (phone: string, name: string) => {
    try {
      const res = await testUazapiAction({ testNumber: phone, testName: name })
      return { success: res.success, errorMessage: res.errorMessage }
    } catch (err: any) {
      return { success: false, errorMessage: err?.message || "Falha ao conectar com UAZAPI" }
    }
  }

  const testResendConnection = async (email: string, name: string) => {
    try {
      const res = await testResendAction({ testEmail: email, testName: name })
      return { success: res.success, errorMessage: res.errorMessage }
    } catch (err: any) {
      return { success: false, errorMessage: err?.message || "Falha ao conectar com Resend" }
    }
  }

  const logAuditAction = async (params: {
    action: string
    patientId?: string
    patientName?: string
    details?: string
    ipAddress?: string
  }) => {
    try {
      await logAuditMutation({
        userName: user?.name || "Dr. Marcelo Henrique",
        userRole: user?.role || "admin",
        userId: user?.id as any,
        action: params.action,
        patientId: params.patientId as any,
        patientName: params.patientName,
        details: params.details,
        ipAddress: params.ipAddress || "127.0.0.1",
      })
    } catch (err) {
      console.warn("Convex audit log warning:", err)
    }
  }

  const savePatientConsent = async (params: {
    patientId: string
    termType: "tcle_treatment" | "lgpd_data_processing" | "postural_photo_consent"
    accepted: boolean
    signedByName: string
    documentVersion: string
    notes?: string
  }) => {
    try {
      await saveConsentMutation({
        patientId: params.patientId as any,
        termType: params.termType,
        accepted: params.accepted,
        signedByName: params.signedByName,
        documentVersion: params.documentVersion,
        notes: params.notes,
        userName: user?.name || "Dr. Marcelo Henrique",
        userRole: user?.role || "admin",
      })
    } catch (err) {
      throw err
    }
  }

  return (
    <ClinicDataContext.Provider
      value={{
        rooms: effectiveRooms,
        addRoom,
        updateRoom,
        deleteRoom,
        professionals: effectiveProfessionals,
        addProfessional,
        updateProfessional,
        deleteProfessional,
        patients: effectivePatients,
        addPatient,
        updatePatient,
        deletePatient,
        schedules: effectiveSchedules,
        selectedDate,
        setSelectedDate,
        schedulePeriodMode,
        setSchedulePeriodMode: handleSetSchedulePeriodMode,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        removeParticipantFromSchedule,
        addRecurringScheduleSeries,
        checkIn,
        batchCheckIn,
        cancelWithReplacement,
        addParticipantToClass,
        replacementCredits: effectiveReplacementCredits,
        clinicalOverview: effectiveClinicalOverview,
        getClinicalRecord,
        saveClinicalRecord,
        deleteClinicalRecord,
        getEvolutions,
        addSoapEvolution,
        updateSoapEvolution,
        deleteSoapEvolution,
        uploadPosturalPhoto,
        getPainEvolutionHistory,
        clinicalReports: effectiveClinicalReports,
        getClinicalReports,
        createClinicalReport,
        updateClinicalReport,
        deleteClinicalReport,
        transactions: effectiveTransactions,
        cashFlowSummary: effectiveCashFlow,
        commissionReports: effectiveCommissionReports,
        closedCommissions: effectiveClosedCommissions,
        selectedFinanceMonth,
        setSelectedFinanceMonth,
        addTransaction,
        updateTransaction,
        markTransactionPaid,
        cancelTransaction,
        deleteTransaction,
        closeProfessionalCommission,
        notificationLogs: effectiveLogs,
        notificationStats: effectiveNotificationStats,
        sendWhatsAppReminder,
        sendEmailReceipt,
        sendWhatsAppReceipt,
        triggerUpcomingRemindersNow,
        testUazapiConnection,
        testResendConnection,
        services: effectiveServices,
        addService,
        updateService,
        deleteService,
        packages: effectivePackages,
        patientPackages: effectivePatientPackages,
        renewalAlerts: effectiveRenewalAlerts,
        addPackage,
        updatePackage,
        deletePackage,
        deletePatientPackage,
        assignPackageToPatient,
        auditLogs: effectiveAuditLogs,
        logAuditAction,
        savePatientConsent,
      }}
    >


      {children}
    </ClinicDataContext.Provider>
  )
}

export const useClinicData = () => {
  const context = useContext(ClinicDataContext)
  if (!context) {
    throw new Error("useClinicData must be used within a ClinicDataProvider")
  }
  return context
}
