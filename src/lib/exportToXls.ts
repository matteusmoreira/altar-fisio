import { formatDateBR } from "./dateUtils"

interface PublicBookingExportItem {
  _id: string
  patientName: string
  patientPhone: string
  patientCpf: string
  date: string
  startTime: string
  endTime?: string
  roomName?: string
  professionalName?: string
  serviceName?: string
  status: string
  answers?: Array<{
    questionId: string
    questionLabel: string
    answer: string
  }>
  notes?: string
  createdAt?: number
}

// 1. Exportar Ficha Individual do Paciente em XLS
export function exportSingleBookingToXls(booking: PublicBookingExportItem) {
  const statusLabel =
    booking.status === "confirmed"
      ? "Confirmado"
      : booking.status === "pending_approval"
      ? "Aguardando Aprovação"
      : "Recusado"

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Ficha de Agendamento</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        .header { background-color: #0d9488; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; height: 40px; }
        .subheader { background-color: #f0fdfa; color: #115e59; font-size: 11pt; font-weight: bold; }
        .section-title { background-color: #e2e8f0; font-size: 11pt; font-weight: bold; }
        .label { font-weight: bold; background-color: #f8fafc; width: 220px; }
        .value { }
        td { border: 0.5pt solid #cbd5e1; padding: 6px 10px; vertical-align: middle; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="2" class="header">ALTAR FISIO • FICHA DE AGENDAMENTO ONLINE</td>
        </tr>
        <tr>
          <td colspan="2" class="subheader">Dr. Marcelo • Fisioterapia, Studio de Pilates & RPG</td>
        </tr>
        <tr><td colspan="2" style="height: 10px; border: none;"></td></tr>
        
        <tr>
          <td colspan="2" class="section-title">1. DADOS DO PACIENTE</td>
        </tr>
        <tr>
          <td class="label">Nome Completo:</td>
          <td class="value">${booking.patientName || ""}</td>
        </tr>
        <tr>
          <td class="label">WhatsApp / Celular:</td>
          <td class="value">${booking.patientPhone || ""}</td>
        </tr>
        <tr>
          <td class="label">CPF:</td>
          <td class="value">${booking.patientCpf || ""}</td>
        </tr>
        <tr>
          <td class="label">Status do Agendamento:</td>
          <td class="value font-bold">${statusLabel}</td>
        </tr>
        
        <tr><td colspan="2" style="height: 10px; border: none;"></td></tr>
        <tr>
          <td colspan="2" class="section-title">2. DETALHES DA SESSÃO RESERVADA</td>
        </tr>
        <tr>
          <td class="label">Data da Sessão:</td>
          <td class="value">${formatDateBR(booking.date)}</td>
        </tr>
        <tr>
          <td class="label">Horário:</td>
          <td class="value">${booking.startTime || ""} ${booking.endTime ? "às " + booking.endTime : ""}</td>
        </tr>
        <tr>
          <td class="label">Ambiente / Sala:</td>
          <td class="value">${booking.roomName || "Sala Principal"}</td>
        </tr>
        <tr>
          <td class="label">Profissional Alocado:</td>
          <td class="value">${booking.professionalName || "Qualquer Profissional"}</td>
        </tr>
        <tr>
          <td class="label">Data da Solicitação Online:</td>
          <td class="value">${booking.createdAt ? new Date(booking.createdAt).toLocaleString("pt-BR") : ""}</td>
        </tr>

        <tr><td colspan="2" style="height: 10px; border: none;"></td></tr>
        <tr>
          <td colspan="2" class="section-title">3. RESPOSTAS DA TRIAGEM CLÍNICA & CONVÊNIO</td>
        </tr>
        ${(booking.answers || [])
          .map(
            (ans) => `
            <tr>
              <td class="label">${ans.questionLabel}:</td>
              <td class="value">${ans.answer || "Não informado"}</td>
            </tr>
          `
          )
          .join("")}

        ${
          booking.notes
            ? `
          <tr>
            <td class="label">Observações do Paciente:</td>
            <td class="value">${booking.notes}</td>
          </tr>
        `
            : ""
        }
      </table>
    </body>
    </html>
  `

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const sanitizedName = (booking.patientName || "paciente").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
  a.href = url
  a.download = `ficha_agendamento_${sanitizedName}_${booking.date}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 2. Exportar Todos os Agendamentos Consolidados em XLS
export function exportAllBookingsToXls(bookings: PublicBookingExportItem[]) {
  // Extrai todas as perguntas únicas da triagem para virarem colunas
  const questionLabelsSet = new Set<string>()
  bookings.forEach((b) => {
    b.answers?.forEach((ans) => {
      if (ans.questionLabel) questionLabelsSet.add(ans.questionLabel)
    })
  })
  const dynamicQuestions = Array.from(questionLabelsSet)

  const rowsHtml = bookings
    .map((b) => {
      const statusLabel =
        b.status === "confirmed"
          ? "Confirmado"
          : b.status === "pending_approval"
          ? "Aguardando Aprovação"
          : "Recusado"

      // Mapeia respostas pelas perguntas
      const answerMap = new Map<string, string>()
      b.answers?.forEach((ans) => {
        answerMap.set(ans.questionLabel, ans.answer)
      })

      const answersTds = dynamicQuestions
        .map((q) => `<td>${answerMap.get(q) || "-"}</td>`)
        .join("")

      return `
        <tr>
          <td>${b._id}</td>
          <td>${b.createdAt ? new Date(b.createdAt).toLocaleString("pt-BR") : ""}</td>
          <td style="font-weight: bold;">${b.patientName}</td>
          <td>${b.patientPhone}</td>
          <td>${b.patientCpf}</td>
          <td>${formatDateBR(b.date)}</td>
          <td>${b.startTime}</td>
          <td>${b.roomName || "Sala Principal"}</td>
          <td>${statusLabel}</td>
          ${answersTds}
          <td>${b.notes || "-"}</td>
        </tr>
      `
    })
    .join("")

  const dynamicHeaders = dynamicQuestions
    .map((q) => `<th style="background-color: #0d9488; color: #ffffff;">${q}</th>`)
    .join("")

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
        th { background-color: #0d9488; color: #ffffff; padding: 8px; border: 0.5pt solid #cbd5e1; text-align: left; font-weight: bold; }
        td { border: 0.5pt solid #cbd5e1; padding: 6px; }
      </style>
    </head>
    <body>
      <h2>Relatório de Agendamentos Online • Altar Fisio (Dr. Marcelo)</h2>
      <p>Exportado em: ${new Date().toLocaleString("pt-BR")} | Total de registros: ${bookings.length}</p>
      <table>
        <thead>
          <tr>
            <th>ID Registro</th>
            <th>Data Solicitação</th>
            <th>Nome do Paciente</th>
            <th>WhatsApp</th>
            <th>CPF</th>
            <th>Data da Sessão</th>
            <th>Horário</th>
            <th>Sala / Espaço</th>
            <th>Status</th>
            ${dynamicHeaders}
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const dateStr = new Date().toISOString().split("T")[0]
  a.href = url
  a.download = `agendamentos_online_altar_fisio_${dateStr}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
