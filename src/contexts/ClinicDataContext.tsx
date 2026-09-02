import React, { createContext, useContext, useState, useEffect } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
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
} from "@/types"


interface ClinicDataContextType {
  // Rooms
  rooms: Room[]
  addRoom: (room: Omit<Room, "id">) => void

  // Professionals
  professionals: Professional[]
  addProfessional: (prof: Omit<Professional, "id">) => void

  // Patients
  patients: Patient[]
  addPatient: (patient: Omit<Patient, "id" | "createdAt" | "active">) => string
  updatePatient: (id: string, data: Partial<Patient>) => void

  // Schedules & Classes
  schedules: Schedule[]
  selectedDate: string
  setSelectedDate: (date: string) => void
  addSchedule: (schedule: Omit<Schedule, "id" | "participants">) => Promise<void>
  addRecurringScheduleSeries: (params: RecurringScheduleSeriesParams) => Promise<{
    createdCount: number
    skippedCount: number
    skippedDates: { date: string; reason: string }[]
    recurringGroupId?: string
  }>
  checkIn: (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled"
  ) => Promise<{
    success: boolean
    hasPackage?: boolean
    remainingSessions?: number
    message?: string
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
  getClinicalRecord: (patientId: string) => ClinicalRecord | undefined
  saveClinicalRecord: (record: ClinicalRecord) => void
  getEvolutions: (patientId: string) => ClinicalEvolution[]
  addSoapEvolution: (evolution: Omit<ClinicalEvolution, "id" | "timestamp">) => void
  uploadPosturalPhoto: (patientId: string, viewType: PosturalViewType, file: File) => Promise<string>
  getPainEvolutionHistory: (patientId: string) => PainDataPoint[]

  // Commercial Packages & Plans
  services: ClinicService[]
  packages: ClinicPackage[]
  patientPackages: PatientPackage[]
  renewalAlerts: RenewalAlert[]
  addPackage: (pkg: Omit<ClinicPackage, "id">) => Promise<string>
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


const initialRooms: Room[] = [
  {
    id: "r1",
    name: "Studio Pilates Aparelhos (Reformer/Cadillac)",
    type: "pilates_aparelhos",
    capacity: 4,
    color: "#10b981",
    description: "Equipado com 4 reformers com torre, chair e ladder barrel.",
    isActive: true,
  },
  {
    id: "r2",
    name: "Sala de Postura & RPG",
    type: "rpg",
    capacity: 2,
    color: "#6366f1",
    description: "Maca de RPG hidráulica com tração e espelho quadriculado.",
    isActive: true,
  },
  {
    id: "r3",
    name: "Consultório 1 - Fisioterapia Avançada",
    type: "fisioterapia",
    capacity: 1,
    color: "#0284c7",
    description: "Eletroterapia, laser terapêutico e maca ortopédica.",
    isActive: true,
  },
]

const initialProfessionals: Professional[] = [
  {
    id: "prof1",
    name: "Dr. Marcelo Henrique",
    email: "marcelo@altarfisio.com.br",
    phone: "(11) 99123-4567",
    crefito: "CREFITO-3 / 184520-F",
    specialties: ["Fisioterapia", "RPG", "Pilates"],
    commissionType: "percentage",
    commissionValue: 50,
    active: true,
  },
  {
    id: "prof2",
    name: "Dra. Camila Duarte",
    email: "camila@altarfisio.com.br",
    phone: "(11) 98234-5678",
    crefito: "CREFITO-3 / 215430-F",
    specialties: ["Pilates", "Fisioterapia"],
    commissionType: "fixed",
    commissionValue: 45, // R$ 45 fixo por aluno atendido
    active: true,
  },
]

const initialPatients: Patient[] = [
  {
    id: "pat1",
    name: "Juliana Mendes da Silva",
    documentCpf: "234.567.890-12",
    phone: "(11) 98877-6655",
    email: "juliana.mendes@email.com",
    birthDate: "1988-04-12",
    gender: "Feminino",
    emergencyContact: "Carlos (Esposo)",
    emergencyPhone: "(11) 97766-5544",
    healthInsurance: "Particular",
    notes: "Lombalgia crônica por postura sentada contínua.",
    active: true,
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: "pat2",
    name: "Roberto Fernandes Costa",
    documentCpf: "345.678.901-23",
    phone: "(11) 97788-9900",
    email: "roberto.costa@email.com",
    birthDate: "1975-09-24",
    gender: "Masculino",
    emergencyContact: "Marina (Filha)",
    emergencyPhone: "(11) 96655-4433",
    healthInsurance: "Bradesco Saúde",
    notes: "Reabilitação pós-reconstrução de LCA Joelho D (6ª semana).",
    active: true,
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: "pat3",
    name: "Beatriz Nogueira Lopes",
    documentCpf: "456.789.012-34",
    phone: "(11) 99881-2233",
    email: "beatriz.nl@email.com",
    birthDate: "1992-11-03",
    gender: "Feminino",
    emergencyContact: "Helena (Mãe)",
    emergencyPhone: "(11) 98811-2244",
    healthInsurance: "Particular",
    notes: "Pilates para fortalecimento lombar e postura.",
    active: true,
    createdAt: Date.now() - 86400000 * 10,
  },
  {
    id: "pat4",
    name: "Lucas Alencar Moreira",
    documentCpf: "567.890.123-45",
    phone: "(11) 98112-3344",
    email: "lucas.moreira@email.com",
    birthDate: "1985-06-18",
    gender: "Masculino",
    emergencyContact: "Fernanda (Irmã)",
    emergencyPhone: "(11) 98112-9988",
    healthInsurance: "SulAmérica",
    notes: "Cervicalgia tensional e retificação cervical.",
    active: true,
    createdAt: Date.now() - 86400000 * 5,
  },
]

const todayStr = new Date().toISOString().split("T")[0]

const initialSchedules: Schedule[] = [
  {
    id: "sch1",
    title: "Turma Pilates Aparelhos Manhã",
    type: "turma",
    specialty: "pilates",
    roomId: "r1",
    roomName: "Studio Pilates Aparelhos",
    roomColor: "#10b981",
    roomCapacity: 4,
    professionalId: "prof2",
    professionalName: "Dra. Camila Duarte",
    date: todayStr,
    startTime: "08:00",
    endTime: "08:55",
    maxCapacity: 4,
    status: "scheduled",
    participants: [
      {
        id: "part1",
        patientId: "pat1",
        patientName: "Juliana Mendes da Silva",
        patientPhone: "(11) 98877-6655",
        status: "present",
        checkedInAt: Date.now() - 3600000,
      },
      {
        id: "part2",
        patientId: "pat3",
        patientName: "Beatriz Nogueira Lopes",
        patientPhone: "(11) 99881-2233",
        status: "scheduled",
      },
    ],
  },
  {
    id: "sch2",
    title: "Atendimento RPG Postural",
    type: "individual",
    specialty: "rpg",
    roomId: "r2",
    roomName: "Sala de Postura & RPG",
    roomColor: "#6366f1",
    roomCapacity: 2,
    professionalId: "prof1",
    professionalName: "Dr. Marcelo Henrique",
    date: todayStr,
    startTime: "09:00",
    endTime: "10:00",
    maxCapacity: 1,
    status: "scheduled",
    participants: [
      {
        id: "part3",
        patientId: "pat4",
        patientName: "Lucas Alencar Moreira",
        patientPhone: "(11) 98112-3344",
        status: "scheduled",
      },
    ],
  },
  {
    id: "sch3",
    title: "Fisioterapia Ortopédica - Joelho",
    type: "individual",
    specialty: "fisioterapia",
    roomId: "r3",
    roomName: "Consultório 1 - Fisio",
    roomColor: "#0284c7",
    roomCapacity: 1,
    professionalId: "prof1",
    professionalName: "Dr. Marcelo Henrique",
    date: todayStr,
    startTime: "10:30",
    endTime: "11:20",
    maxCapacity: 1,
    status: "scheduled",
    participants: [
      {
        id: "part4",
        patientId: "pat2",
        patientName: "Roberto Fernandes Costa",
        patientPhone: "(11) 97788-9900",
        status: "scheduled",
      },
    ],
  },
  {
    id: "sch4",
    title: "Turma Pilates Aparelhos Tarde",
    type: "turma",
    specialty: "pilates",
    roomId: "r1",
    roomName: "Studio Pilates Aparelhos",
    roomColor: "#10b981",
    roomCapacity: 4,
    professionalId: "prof2",
    professionalName: "Dra. Camila Duarte",
    date: todayStr,
    startTime: "17:00",
    endTime: "17:55",
    maxCapacity: 4,
    status: "scheduled",
    participants: [
      {
        id: "part5",
        patientId: "pat1",
        patientName: "Juliana Mendes da Silva",
        patientPhone: "(11) 98877-6655",
        status: "scheduled",
      },
      {
        id: "part6",
        patientId: "pat3",
        patientName: "Beatriz Nogueira Lopes",
        patientPhone: "(11) 99881-2233",
        status: "scheduled",
      },
    ],
  },
]

const initialTransactions: FinancialTransaction[] = [
  {
    id: "tx1",
    type: "income",
    category: "Mensalidade Pilates",
    description: "Mensalidade 2x/Semana - Juliana Mendes",
    amount: 380,
    dueDate: todayStr,
    paymentDate: todayStr,
    paymentMethod: "pix",
    status: "paid",
    patientId: "pat1",
    patientName: "Juliana Mendes da Silva",
  },
  {
    id: "tx2",
    type: "income",
    category: "Pacote Fisioterapia",
    description: "Pacote 10 Sessões Reabilitação - Roberto Costa",
    amount: 1600,
    dueDate: todayStr,
    paymentDate: todayStr,
    paymentMethod: "cartao_credito",
    status: "paid",
    patientId: "pat2",
    patientName: "Roberto Fernandes Costa",
  },
  {
    id: "tx3",
    type: "expense",
    category: "Materiais & Higiene",
    description: "Álcool 70%, lençóis descartáveis e faixas elásticas Theraband",
    amount: 245,
    dueDate: todayStr,
    paymentDate: todayStr,
    paymentMethod: "pix",
    status: "paid",
  },
  {
    id: "tx4",
    type: "expense",
    category: "Manutenção Aparelhos",
    description: "Troca de molas e lubrificação dos Reformers Pilates",
    amount: 450,
    dueDate: "2026-09-10",
    paymentMethod: "transferencia",
    status: "pending",
  },
  {
    id: "tx5",
    type: "income",
    category: "Sessão RPG Avulsa",
    description: "Sessão RPG - Lucas Alencar",
    amount: 220,
    dueDate: todayStr,
    paymentMethod: "pix",
    status: "pending",
    patientId: "pat4",
    patientName: "Lucas Alencar Moreira",
  },
]

const initialEvolutions: ClinicalEvolution[] = [
  {
    id: "evo1",
    patientId: "pat1",
    patientName: "Juliana Mendes da Silva",
    professionalId: "prof1",
    professionalName: "Dr. Marcelo Henrique",
    crefito: "CREFITO-3 / 184520-F",
    date: "2026-08-12",
    timestamp: Date.now() - 86400000 * 21,
    techniqueCategory: "RPG Souchard",
    subjective: "Paciente relata dor lombar aguda intensa (EVA 8/10), irradiando para nádega direita, após muitas horas sentada.",
    objective: "Postura rã no chão com braços abertos. Tração cervical e descompressão lombo-sacra L4-L5. Respiração diafragmática profunda.",
    assessment: "Encurtamento severo da cadeia posterior e espasmo paravertebral lombar. Ganho discreto de relaxamento ao final.",
    plan: "Repetir postura duas vezes por semana e prescrever exercícios respiratórios domiciliares.",
    painScaleAfter: 6,
    isLocked: true,
    signatureHash: "COFFITO-CREFITO3184520F-K9X2A",
  },
  {
    id: "evo2",
    patientId: "pat1",
    patientName: "Juliana Mendes da Silva",
    professionalId: "prof2",
    professionalName: "Dra. Camila Duarte",
    crefito: "CREFITO-3 / 215430-F",
    date: "2026-08-19",
    timestamp: Date.now() - 86400000 * 14,
    techniqueCategory: "Pilates Aparelhos",
    subjective: "Relata alívio substancial da queixa ciática, permanecendo apenas sensação de cansaço muscular lombar (EVA 4/10).",
    objective: "No Reformer: Footwork 4 molas 3x10, Bridging com bola 3x10. No Cadillac: Tower para alongamento axial da coluna.",
    assessment: "Boa ativação do transverso abdominal (powerhouse) sem episódios de dor aguda durante a execução.",
    plan: "Progredir estabilização de pelve e acrescentar exercícios de mobilidade de quadril.",
    painScaleAfter: 4,
    isLocked: true,
    signatureHash: "COFFITO-CREFITO3215430F-L8M3B",
  },
  {
    id: "evo3",
    patientId: "pat1",
    patientName: "Juliana Mendes da Silva",
    professionalId: "prof2",
    professionalName: "Dra. Camila Duarte",
    crefito: "CREFITO-3 / 215430-F",
    date: "2026-08-26",
    timestamp: Date.now() - 86400000 * 7,
    techniqueCategory: "Pilates Aparelhos",
    subjective: "Conseguiu passar a semana de trabalho no escritório sem precisar recorrer a anti-inflamatórios orais (EVA 2/10).",
    objective: "Reformer: Footwork, Running 2 molas, Eve's Lunge unipodal. Chair: Pike prep e flexão de tronco assistida.",
    assessment: "Excelente estabilidade e controle postural dinâmico. Pelve neutra mantida com facilidade.",
    plan: "Manter frequência 2x/semana no Studio Pilates e focar em fortalecimento avançado.",
    painScaleAfter: 2,
    isLocked: true,
    signatureHash: "COFFITO-CREFITO3215430F-N4J7C",
  },
  {
    id: "evo4",
    patientId: "pat1",
    patientName: "Juliana Mendes da Silva",
    professionalId: "prof1",
    professionalName: "Dr. Marcelo Henrique",
    crefito: "CREFITO-3 / 184520-F",
    date: todayStr,
    timestamp: Date.now() - 3600000 * 3,
    techniqueCategory: "RPG Souchard",
    subjective: "Sensação de bem-estar completo, sem dor em repouso (EVA 1/10). Disposição plena para atividades do cotidiano.",
    objective: "Postura sentada no meio com apoio escapular. Reeducação das curvaturas fisiológicas e tração manual occipital.",
    assessment: "Alinhamento das cristas ilíacas normalizado. Nivelamento acromial simétrico comparado à avaliação inicial.",
    plan: "Reavaliação postural em 30 dias e manutenção das aulas de Pilates.",
    painScaleAfter: 1,
    isLocked: true,
    signatureHash: "COFFITO-CREFITO3184520F-P1Q9D",
  },
  {
    id: "evo5",
    patientId: "pat2",
    patientName: "Roberto Fernandes Costa",
    professionalId: "prof1",
    professionalName: "Dr. Marcelo Henrique",
    crefito: "CREFITO-3 / 184520-F",
    date: todayStr,
    timestamp: Date.now() - 3600000 * 2,
    techniqueCategory: "Fisioterapia Ortopédica",
    subjective: "Paciente relata redução significativa da dor (EVA 2/10). Sem queixa de instabilidade no joelho operado.",
    objective: "Realizado ganho de ADM passiva de flexão (alcançado 115°). Fortalecimento isométrico de quadríceps em CCF com bola suíça.",
    assessment: "Boa evolução articular sem derrame ou sinais inflamatórios exuberantes.",
    plan: "Progredir para agachamento bipodal assistido e propriocepção na próxima sessão.",
    painScaleAfter: 1,
    isLocked: true,
    signatureHash: "COFFITO-CREFITO3184520F-R7T2E",
  },
]

const initialClinicalRecords: Record<string, ClinicalRecord> = {
  pat1: {
    patientId: "pat1",
    chiefComplaint: "Lombalgia mecânica crônica com irradiação para membro inferior direito e rigidez matinal.",
    hpi: "Quadro iniciado há cerca de 6 meses, agravado por permanecer mais de 8 horas consecutivas na posição sentada.",
    medicalHistory: "Sedentarismo prévio, sem histórico cirúrgico. Ressonância evidenciando protrusão discal L4-L5 sem compressão foraminal severa.",
    medications: "Paracetamol sob demanda (suspenso nas últimas 2 semanas).",
    painScaleEva: 8,
    painLocation: "Região lombar baixa L4-L5, sacroilíaca direita e face posterior da coxa.",
    posturalNotes: "Hiperlordose lombar com anteversão pélvica de 15°; assimetria acromial com ombro direito 1,2cm elevado; cabeça anteriorizada.",
    posturalDate: "2026-08-12",
    posturalAlignmentMetrics: "Ombros: +1.2cm D; Pelve: Anteversão bilateral; Joelhos: Discreto valgo dinâmico.",
    testsAndMeasures: "Lasègue negativo bilateral. Schober positivo (10cm -> 13cm, mobilidade reduzida). ADM de flexão de quadril limitada a 65°.",
    clinicalGoals: "Remissão da dor lombar, restauração da curvatura lombar fisiológica, fortalecimento do core e retorno a caminhadas.",
    updatedAt: Date.now() - 86400000 * 21,
  },
  pat2: {
    patientId: "pat2",
    chiefComplaint: "Dificuldade para estender e dobrar o joelho direito após cirurgia de LCA.",
    hpi: "Paciente sofreu entorse jogando futebol há 8 semanas. Realizou reconstrução ligamentar há 6 semanas.",
    medicalHistory: "Hipertensão controlada com medicação. Sem cirurgias prévias.",
    medications: "Losartana 50mg, analgésico se dor.",
    painScaleEva: 6,
    painLocation: "Região patelar e linha articular medial do joelho direito.",
    posturalNotes: "Leve flexo de joelho direito na postura em pé e descarga de peso assimétrica para o membro esquerdo.",
    posturalDate: "2026-08-18",
    testsAndMeasures: "Lachman negativo pós-cirúrgico, Gaveta anterior negativa. Edema peripatelar discreto (+1/4+).",
    clinicalGoals: "Alcançar 125° de flexão, extensão completa de 0°, ganho de trofismo e retorno a corridas leves.",
    updatedAt: Date.now(),
  },
}

const ClinicDataContext = createContext<ClinicDataContextType | undefined>(undefined)

export const ClinicDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<Room[]>(() => {

    const s = localStorage.getItem("altar_rooms")
    return s ? JSON.parse(s) : initialRooms
  })

  const [professionals, setProfessionals] = useState<Professional[]>(() => {
    const s = localStorage.getItem("altar_professionals")
    return s ? JSON.parse(s) : initialProfessionals
  })

  const [patients, setPatients] = useState<Patient[]>(() => {
    const s = localStorage.getItem("altar_patients")
    return s ? JSON.parse(s) : initialPatients
  })

  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const s = localStorage.getItem("altar_schedules")
    return s ? JSON.parse(s) : initialSchedules
  })

  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const [replacementCredits, setReplacementCredits] = useState<ReplacementCredit[]>(() => {
    const s = localStorage.getItem("altar_replacement_credits")
    return s ? JSON.parse(s) : []
  })

  const [clinicalRecords, setClinicalRecords] = useState<Record<string, ClinicalRecord>>(() => {
    const s = localStorage.getItem("altar_clinical_records")
    return s ? JSON.parse(s) : initialClinicalRecords
  })

  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>(() => {
    const s = localStorage.getItem("altar_evolutions")
    return s ? JSON.parse(s) : initialEvolutions
  })

  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    const s = localStorage.getItem("altar_transactions")
    return s ? JSON.parse(s) : initialTransactions
  })

  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() => {
    const s = localStorage.getItem("altar_notification_logs")
    return s
      ? JSON.parse(s)
      : [
          {
            id: "notif1",
            channel: "whatsapp_uazapi",
            recipientName: "Juliana Mendes da Silva",
            recipientContact: "(11) 98877-6655",
            triggerType: "lembrete_24h",
            content: "Lembrete: Aula de Pilates Aparelhos hoje às 08:00 na Altar Fisio.",
            status: "sent",
            timestamp: Date.now() - 3600000 * 3,
          },
        ]
  })

  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  )

  // Convex Real-Time Queries (WebSocket)
  const convexRooms = useQuery(api.rooms.listRooms)
  const convexProfessionals = useQuery(api.professionals.listProfessionals)
  const convexPatients = useQuery(api.patients.listPatients, {})
  const convexSchedules = useQuery(api.schedules.listSchedulesByDate, { date: selectedDate })
  const convexReplacementCredits = useQuery(api.schedules.listAvailableReplacementCredits, {})
  const convexTransactions = useQuery(api.finance.listTransactions, {})
  const convexCashFlow = useQuery(api.finance.getCashFlowSummary, { monthYear: selectedFinanceMonth })
  const convexCommissions = useQuery(api.finance.calculateProfessionalCommissions, { monthYear: selectedFinanceMonth })
  const convexClosedCommissions = useQuery(api.finance.listCommissions)
  const convexLogs = useQuery(api.notifications.listLogs, {})
  const convexNotificationStats = useQuery(api.notifications.getNotificationStats, {})
  const convexServices = useQuery(api.packages.listServices)
  const convexPackages = useQuery(api.packages.listPackages)
  const convexPatientPackages = useQuery(api.packages.listPatientPackages, {})
  const convexRenewalAlerts = useQuery(api.packages.listRenewalAlerts)
  const convexAuditLogs = useQuery(api.audit.listAuditLogs, {})

  // Convex Mutations
  const createPatientMutation = useMutation(api.patients.createPatient)
  const updatePatientMutation = useMutation(api.patients.updatePatient)
  const createScheduleMutation = useMutation(api.schedules.createSchedule)
  const createRecurringScheduleMutation = useMutation(api.schedules.createRecurringScheduleSeries)
  const checkInMutation = useMutation(api.schedules.checkInParticipant)
  const cancelWithReplacementMutation = useMutation(api.schedules.cancelWithReplacementCredit)
  const addParticipantMutation = useMutation(api.schedules.addParticipantToSchedule)
  const saveClinicalRecordMutation = useMutation(api.clinical.saveClinicalRecord)
  const addSoapEvolutionMutation = useMutation(api.clinical.addSoapEvolution)
  const generateUploadUrlMutation = useMutation(api.clinical.generateUploadUrl)
  const createTransactionMutation = useMutation(api.finance.createTransaction)
  const updateTransactionMutation = useMutation(api.finance.updateTransaction)
  const markTransactionPaidMutation = useMutation(api.finance.markTransactionPaid)
  const cancelTransactionMutation = useMutation(api.finance.cancelTransaction)
  const deleteTransactionMutation = useMutation(api.finance.deleteTransaction)
  const closeProfessionalCommissionMutation = useMutation(api.finance.closeProfessionalCommission)
  const sendWhatsAppMutation = useMutation(api.notifications.sendWhatsAppReminder)
  const sendEmailReceiptMutation = useMutation(api.notifications.sendEmailReceipt)
  const createPackageMutation = useMutation(api.packages.createPackage)
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

  // Dados Derivados Reativos em Tempo Real (Convex com Fallback Otimista)
  const effectiveServices = (convexServices && convexServices.length > 0)
    ? convexServices.map((s: any) => ({ ...s, id: s._id }))
    : []

  const effectivePackages = (convexPackages && convexPackages.length > 0)
    ? convexPackages.map((p: any) => ({ ...p, id: p._id }))
    : []

  const effectivePatientPackages = (convexPatientPackages && convexPatientPackages.length > 0)
    ? convexPatientPackages.map((pp: any) => ({ ...pp, id: pp._id }))
    : []

  const effectiveRenewalAlerts = (convexRenewalAlerts && convexRenewalAlerts.length > 0)
    ? convexRenewalAlerts.map((ra: any) => ({ ...ra, id: ra._id }))
    : []

  const effectiveAuditLogs: AuditLog[] = (convexAuditLogs && convexAuditLogs.length > 0)
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

  const effectiveRooms = (convexRooms && convexRooms.length > 0)
    ? convexRooms.map((r: any) => ({ ...r, id: r._id }))
    : rooms

  const effectiveProfessionals = (convexProfessionals && convexProfessionals.length > 0)
    ? convexProfessionals.map((p: any) => ({ ...p, id: p._id }))
    : professionals

  const effectivePatients = (convexPatients && convexPatients.length > 0)
    ? convexPatients.map((p: any) => ({ ...p, id: p._id }))
    : patients

  const effectiveSchedules = (convexSchedules && convexSchedules.length > 0)
    ? convexSchedules.map((s: any) => ({
        ...s,
        id: s._id,
        participants: (s.participants || []).map((p: any) => ({ ...p, id: p._id })),
      }))
    : schedules

  const effectiveReplacementCredits = (convexReplacementCredits && convexReplacementCredits.length > 0)
    ? convexReplacementCredits.map((c: any) => ({
        ...c,
        id: c._id,
      }))
    : replacementCredits

  const effectiveTransactions = (convexTransactions && convexTransactions.length > 0)
    ? convexTransactions.map((t: any) => ({ ...t, id: t._id }))
    : transactions

  const effectiveLogs = (convexLogs && convexLogs.length > 0)
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
    const today = new Date().toISOString().split("T")[0]
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

  const effectiveCommissionReports: ProfessionalCommissionReport[] = (convexCommissions && convexCommissions.length > 0)
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

  const effectiveClosedCommissions: ClosedCommission[] = (convexClosedCommissions && convexClosedCommissions.length > 0)
    ? convexClosedCommissions.map((c: any) => ({ ...c, id: c._id }))
    : []

  // Sync state to LocalStorage (Persistência Resiliente / Offline Fallback)
  useEffect(() => {
    localStorage.setItem("altar_rooms", JSON.stringify(rooms))
  }, [rooms])
  useEffect(() => {
    localStorage.setItem("altar_professionals", JSON.stringify(professionals))
  }, [professionals])
  useEffect(() => {
    localStorage.setItem("altar_patients", JSON.stringify(patients))
  }, [patients])
  useEffect(() => {
    localStorage.setItem("altar_schedules", JSON.stringify(schedules))
  }, [schedules])
  useEffect(() => {
    localStorage.setItem("altar_replacement_credits", JSON.stringify(replacementCredits))
  }, [replacementCredits])
  useEffect(() => {
    localStorage.setItem("altar_clinical_records", JSON.stringify(clinicalRecords))
  }, [clinicalRecords])
  useEffect(() => {
    localStorage.setItem("altar_evolutions", JSON.stringify(evolutions))
  }, [evolutions])
  useEffect(() => {
    localStorage.setItem("altar_transactions", JSON.stringify(transactions))
  }, [transactions])
  useEffect(() => {
    localStorage.setItem("altar_notification_logs", JSON.stringify(notificationLogs))
  }, [notificationLogs])

  const addRoom = (roomData: Omit<Room, "id">) => {
    const newRoom: Room = { ...roomData, id: `r_${Date.now()}` }
    setRooms((prev) => [...prev, newRoom])
  }

  const addProfessional = (profData: Omit<Professional, "id">) => {
    const newProf: Professional = { ...profData, id: `prof_${Date.now()}` }
    setProfessionals((prev) => [...prev, newProf])
  }

  const addPatient = (patientData: Omit<Patient, "id" | "createdAt" | "active">) => {
    const id = `pat_${Date.now()}`
    const newPatient: Patient = {
      ...patientData,
      id,
      active: true,
      createdAt: Date.now(),
    }
    setPatients((prev) => [newPatient, ...prev])

    // Sincroniza de forma assíncrona com o Convex
    createPatientMutation({
      name: patientData.name,
      documentCpf: patientData.documentCpf,
      phone: patientData.phone,
      email: patientData.email,
      birthDate: patientData.birthDate,
      gender: patientData.gender,
      address: patientData.address,
      emergencyContact: patientData.emergencyContact,
      emergencyPhone: patientData.emergencyPhone,
      healthInsurance: patientData.healthInsurance,
      notes: patientData.notes,
    }).catch((err) => console.warn("Convex sync warning (addPatient):", err))

    return id
  }

  const updatePatient = (id: string, data: Partial<Patient>) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))

    try {
      updatePatientMutation({
        id: id as any,
        name: data.name || "",
        documentCpf: data.documentCpf || "",
        phone: data.phone || "",
        email: data.email,
        birthDate: data.birthDate || "",
        gender: data.gender,
        address: data.address,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        healthInsurance: data.healthInsurance,
        notes: data.notes,
        active: data.active ?? true,
      }).catch((err) => console.warn("Convex sync warning (updatePatient):", err))
    } catch {
      // Ignora erro se for ID local mock
    }
  }

  const addSchedule = async (scheduleData: Omit<Schedule, "id" | "participants">) => {
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
    } catch (err: any) {
      if (err?.message) {
        throw err
      }
      // Fallback local se estiver offline
      const newSchedule: Schedule = {
        ...scheduleData,
        id: `sch_${Date.now()}`,
        participants: [],
      }
      setSchedules((prev) => [...prev, newSchedule])
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

  const checkIn = async (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled"
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
      })
      return res
    } catch (err) {
      console.warn("Convex sync warning (checkIn):", err)
      return {
        success: true,
        hasPackage: false,
        message: status === "present" ? "Presença confirmada" : "Presença desfeita",
      }
    }
  }

  const addPackage = async (pkgData: Omit<ClinicPackage, "id">): Promise<string> => {
    try {
      const id = await createPackageMutation({
        name: pkgData.name,
        serviceId: pkgData.serviceId as any,
        sessionCount: pkgData.sessionCount,
        validityDays: pkgData.validityDays,
        price: pkgData.price,
        description: pkgData.description,
        active: pkgData.active,
      })
      return id
    } catch (err: any) {
      console.error("Erro ao criar pacote comercial:", err)
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
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + 30)
      const expiryStr = expiry.toISOString().split("T")[0]

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

  const saveClinicalRecord = (record: ClinicalRecord) => {
    setClinicalRecords((prev) => ({
      ...prev,
      [record.patientId]: record,
    }))

    try {
      saveClinicalRecordMutation({
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
      }).catch((err) => console.warn("Convex sync warning (saveClinicalRecord):", err))
    } catch {}
  }

  const getEvolutions = (patientId: string) => {
    return evolutions.filter((e) => e.patientId === patientId)
  }

  const addSoapEvolution = (evoData: Omit<ClinicalEvolution, "id" | "timestamp">) => {
    const newEvo: ClinicalEvolution = {
      ...evoData,
      id: `evo_${Date.now()}`,
      timestamp: Date.now(),
      isLocked: true,
      signatureHash: `COFFITO-SIG-${Date.now().toString(36).toUpperCase()}`,
    }
    setEvolutions((prev) => [newEvo, ...prev])

    try {
      addSoapEvolutionMutation({
        patientId: evoData.patientId as any,
        professionalId: evoData.professionalId as any,
        date: evoData.date,
        subjective: evoData.subjective,
        objective: evoData.objective,
        assessment: evoData.assessment,
        plan: evoData.plan,
        painScaleAfter: evoData.painScaleAfter,
        techniqueCategory: evoData.techniqueCategory,
      }).catch((err) => console.warn("Convex sync warning (addSoapEvolution):", err))
    } catch {}
  }

  const uploadPosturalPhoto = async (
    patientId: string,
    viewType: PosturalViewType,
    file: File
  ): Promise<string> => {
    let storageId: string | undefined
    const localUrl = URL.createObjectURL(file)

    try {
      const uploadUrl = await generateUploadUrlMutation()
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const data = await res.json()
      if (data && data.storageId) {
        storageId = data.storageId
      }
    } catch (err) {
      console.warn("Upload direto para Convex Storage falhou ou offline; usando URL local:", err)
    }

    setClinicalRecords((prev) => {
      const current = prev[patientId] || {
        patientId,
        chiefComplaint: "Em avaliação",
        hpi: "",
        medicalHistory: "",
        medications: "",
        painScaleEva: 5,
        painLocation: "",
        clinicalGoals: "",
        updatedAt: Date.now(),
      }

      const updated: ClinicalRecord = {
        ...current,
        updatedAt: Date.now(),
      }

      if (viewType === "anterior") {
        updated.anteriorPhotoUrl = localUrl
        updated.anteriorStorageId = storageId
      } else if (viewType === "posterior") {
        updated.posteriorPhotoUrl = localUrl
        updated.posteriorStorageId = storageId
      } else if (viewType === "lateral_right") {
        updated.lateralRightPhotoUrl = localUrl
        updated.lateralRightStorageId = storageId
        updated.lateralPhotoUrl = localUrl
      } else if (viewType === "lateral_left") {
        updated.lateralLeftPhotoUrl = localUrl
        updated.lateralLeftStorageId = storageId
      }

      try {
        saveClinicalRecordMutation({
          patientId: patientId as any,
          chiefComplaint: updated.chiefComplaint,
          hpi: updated.hpi,
          medicalHistory: updated.medicalHistory,
          medications: updated.medications,
          painScaleEva: updated.painScaleEva,
          painLocation: updated.painLocation,
          posturalNotes: updated.posturalNotes,
          posturalDate: updated.posturalDate,
          posturalAlignmentMetrics: updated.posturalAlignmentMetrics,
          anteriorPhotoUrl: updated.anteriorPhotoUrl,
          anteriorStorageId: updated.anteriorStorageId,
          posteriorPhotoUrl: updated.posteriorPhotoUrl,
          posteriorStorageId: updated.posteriorStorageId,
          lateralPhotoUrl: updated.lateralPhotoUrl,
          lateralRightPhotoUrl: updated.lateralRightPhotoUrl,
          lateralRightStorageId: updated.lateralRightStorageId,
          lateralLeftPhotoUrl: updated.lateralLeftPhotoUrl,
          lateralLeftStorageId: updated.lateralLeftStorageId,
          testsAndMeasures: updated.testsAndMeasures,
          clinicalGoals: updated.clinicalGoals,
        }).catch((e) => console.warn("Convex sync warning:", e))
      } catch {}

      return {
        ...prev,
        [patientId]: updated,
      }
    })

    return localUrl
  }

  const getPainEvolutionHistory = (patientId: string): PainDataPoint[] => {
    const record = clinicalRecords[patientId]
    const patientEvos = evolutions
      .filter((e) => e.patientId === patientId && e.painScaleAfter !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp)

    const points: PainDataPoint[] = []

    if (record) {
      points.push({
        date: new Date(record.updatedAt).toISOString().split("T")[0],
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
        patientId: txData.patientId as any,
        professionalId: txData.professionalId as any,
        packageId: txData.packageId as any,
        receiptIssued: txData.receiptIssued ?? false,
      })
      if (cid) createdId = cid
    } catch (err) {
      console.warn("Convex sync warning (addTransaction):", err)
    }

    const newTx: FinancialTransaction = {
      ...txData,
      id: createdId,
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
      console.warn("Convex sync warning (updateTransaction):", err)
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
      console.warn("Convex sync warning (markTransactionPaid):", err)
    }
  }

  const cancelTransaction = async (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "cancelled" } : t))
    )
    try {
      await cancelTransactionMutation({ id: id as any })
    } catch (err) {
      console.warn("Convex sync warning (cancelTransaction):", err)
    }
  }

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTransactionMutation({ id: id as any })
    } catch (err) {
      console.warn("Convex sync warning (deleteTransaction):", err)
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
    const message = `Olá, *${participant.name}*! 👋\n\nEste é um lembrete do seu atendimento na *Altar Fisio*:\n\n📅 *Data:* ${schedule.date}\n⏰ *Horário:* ${schedule.startTime}\n👨‍⚕️ *Profissional:* ${schedule.professionalName}\n📍 *Local:* ${schedule.roomName}\n\n⚠️ *Aviso importante:* Caso precise desmarcar, avise com antecedência para liberar seu crédito de reposição.\n\nEstamos ansiosos para te receber! ✨`

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
        scheduleId: schedule.id as any,
      })
      return { success: res.success, message: res.errorMessage }
    } catch (err: any) {
      console.warn("Convex sync warning (sendWhatsAppReminder):", err)
      return { success: true }
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
      console.warn("Convex sync warning (sendEmailReceipt):", err)
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
      console.warn("Convex sync warning (sendWhatsAppReceipt):", err)
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
      console.warn("Convex consent save warning:", err)
    }
  }

  return (
    <ClinicDataContext.Provider
      value={{
        rooms: effectiveRooms,
        addRoom,
        professionals: effectiveProfessionals,
        addProfessional,
        patients: effectivePatients,
        addPatient,
        updatePatient,
        schedules: effectiveSchedules,
        selectedDate,
        setSelectedDate,
        addSchedule,
        addRecurringScheduleSeries,
        checkIn,
        cancelWithReplacement,
        addParticipantToClass,
        replacementCredits: effectiveReplacementCredits,
        getClinicalRecord,
        saveClinicalRecord,
        getEvolutions,
        addSoapEvolution,
        uploadPosturalPhoto,
        getPainEvolutionHistory,
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
        packages: effectivePackages,
        patientPackages: effectivePatientPackages,
        renewalAlerts: effectiveRenewalAlerts,
        addPackage,
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
