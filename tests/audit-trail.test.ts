import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import * as XLSX from 'xlsx'

const modules = import.meta.glob('../convex/**/*.ts')

async function fixture(role: 'admin' | 'reception' | 'professional' = 'admin') {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      name: 'Operador Teste',
      email: 'operador@example.invalid',
      role,
      active: true,
      salt: 'salt',
      passwordHash: 'hash',
      createdAt: Date.now(),
    })
    await ctx.db.insert('userSessions', {
      userId,
      token: 'staff_token',
      authVersion: 2,
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
    })
    const log1 = await ctx.db.insert('auditLogs', {
      userId,
      userName: 'Operador Teste',
      userRole: role,
      action: 'view_clinical_record',
      details: 'Visualização de ficha',
      timestamp: Date.now() - 1000,
    })
    const log2 = await ctx.db.insert('auditLogs', {
      userId,
      userName: 'Operador Teste',
      userRole: role,
      action: 'export_pdf_report',
      details: 'Emissão de laudo',
      timestamp: Date.now(),
    })
    return { userId, log1, log2 }
  })
  return { t, ...ids }
}

test('admin can clear all audit logs and receive deleted count', async () => {
  const f = await fixture('admin')

  // Verifica que os logs existem
  const beforeLogs = await f.t.query(api.audit.listAuditLogs, { sessionToken: 'staff_token' })
  expect(beforeLogs.length).toBe(2)

  // Executa a limpeza
  const result = await f.t.mutation(api.audit.clearAuditLogs, { sessionToken: 'staff_token' })
  expect(result).toEqual({ deletedCount: 2 })

  // Verifica que a trilha está vazia
  const afterLogs = await f.t.query(api.audit.listAuditLogs, { sessionToken: 'staff_token' })
  expect(afterLogs.length).toBe(0)
})

test('admin can delete a single audit log by ID', async () => {
  const f = await fixture('admin')

  await f.t.mutation(api.audit.deleteAuditLog, { sessionToken: 'staff_token', id: f.log1 })

  const remaining = await f.t.query(api.audit.listAuditLogs, { sessionToken: 'staff_token' })
  expect(remaining.length).toBe(1)
  expect(remaining[0]._id).toBe(f.log2)
})

test.each(['reception', 'professional'] as const)('rejects clearAuditLogs and deleteAuditLog by %s', async (role) => {
  const f = await fixture(role)

  await expect(
    f.t.mutation(api.audit.clearAuditLogs, { sessionToken: 'staff_token' })
  ).rejects.toThrow(/permissão/i)

  await expect(
    f.t.mutation(api.audit.deleteAuditLog, { sessionToken: 'staff_token', id: f.log1 })
  ).rejects.toThrow(/permissão/i)
})

test('rejects clearAuditLogs with invalid session token', async () => {
  const f = await fixture('admin')

  await expect(
    f.t.mutation(api.audit.clearAuditLogs, { sessionToken: 'invalid_token' })
  ).rejects.toThrow(/Sessão/i)
})

test('audit logs export to XLSX produces formatted sheet with columns and rows', () => {
  const sampleLogs = [
    {
      "Data / Hora": "09/09/2026 14:30:00",
      "Operador": "Matteus Moreira",
      "Perfil": "ADMIN",
      "Ação": "Visualização Prontuário",
      "Código Ação": "view_clinical_record",
      "Paciente": "Stefanie Paixão Loubach",
      "Detalhes": "Visualização da ficha clínica",
      "Endereço IP": "192.168.1.1",
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(sampleLogs)
  XLSX.utils.book_append_sheet(wb, ws, "Trilha de Auditoria")

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  const roundTrip = XLSX.read(buf, { type: 'buffer' })

  expect(roundTrip.SheetNames).toContain("Trilha de Auditoria")
  const parsed = XLSX.utils.sheet_to_json(roundTrip.Sheets["Trilha de Auditoria"])
  expect(parsed).toEqual(sampleLogs)
})
