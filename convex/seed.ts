import { mutation } from "./_generated/server"

export const seedInitialData = mutation({
  handler: async (ctx) => {
    // 1. Configurações da Clínica
    const existingSettings = await ctx.db.query("clinicSettings").first()
    if (!existingSettings) {
      await ctx.db.insert("clinicSettings", {
        clinicName: "Altar Fisio",
        clinicSubtitle: "Dr. Marcelo - Fisioterapia, Pilates & RPG",
        primaryColor: "158 64% 38%",
        colorPreset: "emerald",
        mode: "light",
        phone: "(11) 98765-4321",
        address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
        cancellationNoticeHours: 2,
        replacementExpiryDays: 30,
        uazapiEndpoint: "https://api.uazapi.com/v1",
        uazapiToken: "demo_token_uazapi",
        uazapiInstanceId: "altar_fisio_inst",
        resendApiKey: "re_demo_resend_api_key",
        resendFromEmail: "contato@altarfisio.com.br",
      })
    }

    // 2. Salas Físicas
    const existingRooms = await ctx.db.query("rooms").collect()
    let studioRoomId: any
    let rpgRoomId: any
    let fisioRoomId: any

    if (existingRooms.length === 0) {
      studioRoomId = await ctx.db.insert("rooms", {
        name: "Studio Pilates Aparelhos (Reformer/Cadillac)",
        type: "pilates_aparelhos",
        capacity: 4,
        color: "#10b981",
        description: "Equipado com 4 reformers com torre, step barrel e chairs.",
        isActive: true,
      })

      rpgRoomId = await ctx.db.insert("rooms", {
        name: "Sala de Postura & RPG",
        type: "rpg",
        capacity: 2,
        color: "#6366f1",
        description: "Maca de RPG hidráulica, espelho quadriculado e iluminação suave.",
        isActive: true,
      })

      fisioRoomId = await ctx.db.insert("rooms", {
        name: "Consultório 1 - Fisioterapia Avançada",
        type: "fisioterapia",
        capacity: 1,
        color: "#0284c7",
        description: "Eletroterapia, ultrassom, laser e maca ortopédica.",
        isActive: true,
      })
    } else {
      studioRoomId = existingRooms[0]._id
      rpgRoomId = existingRooms[1]?._id || existingRooms[0]._id
      fisioRoomId = existingRooms[2]?._id || existingRooms[0]._id
    }

    // 3. Profissionais
    const existingProf = await ctx.db.query("professionals").collect()
    let marceloId: any
    let camilaId: any

    if (existingProf.length === 0) {
      marceloId = await ctx.db.insert("professionals", {
        name: "Dr. Marcelo Henrique",
        email: "marcelo@altarfisio.com.br",
        phone: "(11) 99123-4567",
        crefito: "CREFITO-3 / 184520-F",
        specialties: ["Fisioterapia", "RPG", "Pilates Clínico"],
        commissionType: "percentage",
        commissionValue: 50,
        active: true,
      })

      camilaId = await ctx.db.insert("professionals", {
        name: "Dra. Camila Duarte",
        email: "camila@altarfisio.com.br",
        phone: "(11) 98234-5678",
        crefito: "CREFITO-3 / 215430-F",
        specialties: ["Pilates", "Fisioterapia"],
        commissionType: "fixed",
        commissionValue: 45, // R$ 45 fixo por aluno em aula
        active: true,
      })
    } else {
      marceloId = existingProf[0]._id
      camilaId = existingProf[1]?._id || existingProf[0]._id
    }

    // 4. Pacientes Exemplo
    const existingPatients = await ctx.db.query("patients").collect()
    let p1Id: any
    let p2Id: any
    let p3Id: any

    if (existingPatients.length === 0) {
      p1Id = await ctx.db.insert("patients", {
        name: "Juliana Mendes da Silva",
        documentCpf: "234.567.890-12",
        phone: "(11) 98877-6655",
        email: "juliana.mendes@email.com",
        birthDate: "1988-04-12",
        gender: "Feminino",
        emergencyContact: "Carlos (Esposo)",
        emergencyPhone: "(11) 97766-5544",
        healthInsurance: "Particular",
        notes: "Lombalgia crônica por postura sedentária no trabalho.",
        active: true,
        createdAt: Date.now(),
      })

      p2Id = await ctx.db.insert("patients", {
        name: "Roberto Fernandes Costa",
        documentCpf: "345.678.901-23",
        phone: "(11) 97788-9900",
        email: "roberto.costa@email.com",
        birthDate: "1975-09-24",
        gender: "Masculino",
        emergencyContact: "Marina (Filha)",
        emergencyPhone: "(11) 96655-4433",
        healthInsurance: "Bradesco Saúde",
        notes: "Pós-operatório de LCA joelho direito, 6ª semana de reabilitação.",
        active: true,
        createdAt: Date.now(),
      })

      p3Id = await ctx.db.insert("patients", {
        name: "Beatriz Nogueira Lopes",
        documentCpf: "456.789.012-34",
        phone: "(11) 99881-2233",
        email: "beatriz.nl@email.com",
        birthDate: "1992-11-03",
        gender: "Feminino",
        emergencyContact: "Helena (Mãe)",
        emergencyPhone: "(11) 98811-2244",
        healthInsurance: "Particular",
        notes: "Pilates para fortalecimento do core e correção de escoliose leve.",
        active: true,
        createdAt: Date.now(),
      })
    } else {
      p1Id = existingPatients[0]._id
      p2Id = existingPatients[1]?._id || existingPatients[0]._id
      p3Id = existingPatients[2]?._id || existingPatients[0]._id
    }

    // 5. Serviços
    const existingServices = await ctx.db.query("services").collect()
    let sPilatesId: any
    let sFisioId: any
    let sRpgId: any

    if (existingServices.length === 0) {
      sPilatesId = await ctx.db.insert("services", {
        name: "Pilates em Aparelhos (Turma até 4)",
        modality: "turma",
        specialty: "pilates",
        durationMinutes: 55,
        defaultPrice: 90,
        description: "Aula dinâmica com foco em força, mobilidade e estabilidade.",
        active: true,
      })

      sFisioId = await ctx.db.insert("services", {
        name: "Sessão de Fisioterapia Ortopédica",
        modality: "individual",
        specialty: "fisioterapia",
        durationMinutes: 50,
        defaultPrice: 180,
        description: "Terapia manual, cinesioterapia e recursos eletroterapêuticos.",
        active: true,
      })

      sRpgId = await ctx.db.insert("services", {
        name: "Reeducação Postural Global (RPG)",
        modality: "individual",
        specialty: "rpg",
        durationMinutes: 60,
        defaultPrice: 220,
        description: "Posturas estáticas e respiração diafragmática para realinhamento corporal.",
        active: true,
      })
    } else {
      const pilates = existingServices.find((s) => s.specialty === "pilates")
      const fisio = existingServices.find((s) => s.specialty === "fisioterapia")
      const rpg = existingServices.find((s) => s.specialty === "rpg")
      sPilatesId = pilates?._id || existingServices[0]._id
      sFisioId = fisio?._id || existingServices[0]._id
      sRpgId = rpg?._id || existingServices[0]._id
    }

    // 6. Planos e Pacotes Oferecidos pela Clínica
    const existingPackages = await ctx.db.query("packages").collect()
    let pkgPilates2xId: any
    let pkgPilates3xId: any
    let pkgFisio10Id: any
    let pkgRpg5Id: any

    if (existingPackages.length === 0) {
      pkgPilates2xId = await ctx.db.insert("packages", {
        name: "Pilates em Aparelhos 2x/Semana (Mensal)",
        serviceId: sPilatesId,
        sessionCount: 8,
        validityDays: 30,
        price: 380,
        description: "Plano mensal com 2 aulas semanais em turmas de até 4 alunos.",
        active: true,
      })

      pkgPilates3xId = await ctx.db.insert("packages", {
        name: "Pilates em Aparelhos 3x/Semana (Mensal)",
        serviceId: sPilatesId,
        sessionCount: 12,
        validityDays: 30,
        price: 520,
        description: "Plano mensal intensivo com 3 aulas semanais no estúdio.",
        active: true,
      })

      pkgFisio10Id = await ctx.db.insert("packages", {
        name: "Pacote 10 Sessões Fisioterapia Avançada",
        serviceId: sFisioId,
        sessionCount: 10,
        validityDays: 90,
        price: 1600,
        description: "Tratamento completo de reabilitação ortopédica e cinesioterapia.",
        active: true,
      })

      pkgRpg5Id = await ctx.db.insert("packages", {
        name: "Tratamento Postural RPG (5 Sessões)",
        serviceId: sRpgId,
        sessionCount: 5,
        validityDays: 60,
        price: 1000,
        description: "Ciclo inicial de reeducação postural e respiração diafragmática.",
        active: true,
      })
    } else {
      pkgPilates2xId = existingPackages[0]._id
      pkgPilates3xId = existingPackages[1]?._id || existingPackages[0]._id
      pkgFisio10Id = existingPackages[2]?._id || existingPackages[0]._id
      pkgRpg5Id = existingPackages[3]?._id || existingPackages[0]._id
    }

    // 7. Pacotes Ativos dos Pacientes
    const existingPatientPackages = await ctx.db.query("patientPackages").collect()
    if (existingPatientPackages.length === 0 && pkgPilates2xId) {
      // Juliana: 8 sessões contratadas, 6 usadas, 2 restantes (Próxima de renovar)
      await ctx.db.insert("patientPackages", {
        patientId: p1Id,
        packageId: pkgPilates2xId,
        totalSessions: 8,
        usedSessions: 6,
        remainingSessions: 2,
        startDate: "2026-08-31",
        expiryDate: "2026-09-30",
        status: "active",
      })

      // Roberto: Pacote Fisio 10, 4 usadas, 6 restantes (Regular)
      await ctx.db.insert("patientPackages", {
        patientId: p2Id,
        packageId: pkgFisio10Id,
        totalSessions: 10,
        usedSessions: 4,
        remainingSessions: 6,
        startDate: "2026-08-15",
        expiryDate: "2026-11-15",
        status: "active",
      })

      // Beatriz: Pilates 3x, 11 usadas, 1 restante (Alerta crítico de renovação)
      await ctx.db.insert("patientPackages", {
        patientId: p3Id,
        packageId: pkgPilates3xId,
        totalSessions: 12,
        usedSessions: 11,
        remainingSessions: 1,
        startDate: "2026-08-20",
        expiryDate: "2026-09-19",
        status: "active",
      })
    }

    // 8. Usuários do Sistema & Acesso RBAC
    const existingUsers = await ctx.db.query("users").collect()
    if (existingUsers.length === 0) {
      const hashPassword = async (password: string, salt: string) => {
        const enc = new TextEncoder()
        const data = enc.encode(`${salt}__altar_fisio__${password}`)
        const hashBuffer = await crypto.subtle.digest("SHA-256", data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
      }

      // 1. Dr. Marcelo (Admin Geral)
      const saltMarcelo = "salt_marcelo_altar"
      const hashMarcelo = await hashPassword("admin123", saltMarcelo)
      await ctx.db.insert("users", {
        name: "Dr. Marcelo Henrique",
        email: "marcelo@altarfisio.com.br",
        role: "admin",
        passwordHash: hashMarcelo,
        salt: saltMarcelo,
        professionalId: marceloId,
        avatarUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
        active: true,
        createdAt: Date.now(),
      })

      // 2. Dra. Camila (Fisioterapeuta / Instrutora)
      const saltCamila = "salt_camila_altar"
      const hashCamila = await hashPassword("fisio123", saltCamila)
      await ctx.db.insert("users", {
        name: "Dra. Camila Duarte",
        email: "camila@altarfisio.com.br",
        role: "professional",
        passwordHash: hashCamila,
        salt: saltCamila,
        professionalId: camilaId,
        avatarUrl: "https://images.unsplash.com/photo-1594824813586-7871e8932788?w=150&auto=format&fit=crop&q=80",
        active: true,
        createdAt: Date.now(),
      })

      // 3. Bruna Santos (Recepção)
      const saltBruna = "salt_bruna_altar"
      const hashBruna = await hashPassword("recepcao123", saltBruna)
      await ctx.db.insert("users", {
        name: "Bruna Santos",
        email: "recepcao@altarfisio.com.br",
        role: "reception",
        passwordHash: hashBruna,
        salt: saltBruna,
        avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
        active: true,
        createdAt: Date.now(),
      })
    }

    return { success: true, message: "Dados iniciais da Altar Fisio semeados com sucesso!" }
  },
})

export const seedFinanceRecords = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("financialTransactions").collect()
    if (existing.length >= 5) {
      return { success: true, message: "Transações financeiras já existem no banco." }
    }

    const todayStr = new Date().toISOString().split("T")[0]
    const patients = await ctx.db.query("patients").collect()
    const p1 = patients[0]
    const p2 = patients[1]
    const p3 = patients[2]

    const seedTxs = [
      {
        type: "income" as const,
        category: "Mensalidade Pilates",
        description: `Mensalidade Pilates 2x/Semana - ${p1?.name || "Juliana Mendes"}`,
        amount: 380,
        dueDate: todayStr,
        paymentDate: todayStr,
        paymentMethod: "pix" as const,
        status: "paid" as const,
        patientId: p1?._id,
        receiptIssued: true,
        createdAt: Date.now() - 3600000 * 5,
      },
      {
        type: "income" as const,
        category: "Pacote Fisioterapia",
        description: `Pacote 10 Sessões Fisioterapia Avançada - ${p2?.name || "Roberto Costa"}`,
        amount: 1600,
        dueDate: todayStr,
        paymentDate: todayStr,
        paymentMethod: "cartao_credito" as const,
        status: "paid" as const,
        patientId: p2?._id,
        receiptIssued: true,
        createdAt: Date.now() - 3600000 * 4,
      },
      {
        type: "income" as const,
        category: "Mensalidade Pilates",
        description: `Mensalidade Pilates 3x/Semana - ${p3?.name || "Beatriz Lopes"}`,
        amount: 520,
        dueDate: "2026-09-08",
        paymentMethod: "pix" as const,
        status: "pending" as const,
        patientId: p3?._id,
        receiptIssued: false,
        createdAt: Date.now() - 3600000 * 3,
      },
      {
        type: "income" as const,
        category: "Sessão RPG Avulsa",
        description: "Sessão Reeducação Postural Global Avulsa - Lucas Alencar",
        amount: 220,
        dueDate: "2026-08-28", // Vencimento anterior a hoje = Inadimplente / Atrasado
        paymentMethod: "dinheiro" as const,
        status: "pending" as const,
        receiptIssued: false,
        createdAt: Date.now() - 86400000 * 5,
      },
      {
        type: "expense" as const,
        category: "Manutenção Aparelhos",
        description: "Manutenção Preventiva de 4 Reformers e Troca de Molas de Tração",
        amount: 450,
        dueDate: todayStr,
        paymentDate: todayStr,
        paymentMethod: "pix" as const,
        status: "paid" as const,
        receiptIssued: false,
        createdAt: Date.now() - 3600000 * 6,
      },
      {
        type: "expense" as const,
        category: "Materiais & Insumos",
        description: "Lençóis descartáveis para macas, álcool 70% e Therabands elásticas",
        amount: 285,
        dueDate: todayStr,
        paymentDate: todayStr,
        paymentMethod: "cartao_debito" as const,
        status: "paid" as const,
        receiptIssued: false,
        createdAt: Date.now() - 3600000 * 2,
      },
      {
        type: "expense" as const,
        category: "Infraestrutura & TI",
        description: "Internet Fibra Óptica 600MB + Telefonia Altar Fisio",
        amount: 149.9,
        dueDate: todayStr,
        paymentDate: todayStr,
        paymentMethod: "pix" as const,
        status: "paid" as const,
        receiptIssued: false,
        createdAt: Date.now() - 3600000 * 1,
      },
      {
        type: "expense" as const,
        category: "Aluguel & Condomínio",
        description: "Aluguel e taxa condominial do conjunto comercial Altar Fisio",
        amount: 2400,
        dueDate: "2026-09-10",
        paymentMethod: "transferencia" as const,
        status: "pending" as const,
        receiptIssued: false,
        createdAt: Date.now(),
      },
    ]

    for (const tx of seedTxs) {
      await ctx.db.insert("financialTransactions", tx)
    }

    return { success: true, count: seedTxs.length, message: "Transações financeiras iniciais semeadas com sucesso!" }
  },
})
