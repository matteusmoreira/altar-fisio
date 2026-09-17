import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

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
    const log1 = await ctx.db.insert('notificationLogs', {
      channel: 'whatsapp_uazapi',
      recipientName: 'Paciente Teste 1',
      recipientContact: '22999021889',
      triggerType: 'lembrete_24h',
      content: 'Mensagem de lembrete 1',
      status: 'sent',
      timestamp: Date.now() - 2000,
    })
    const log2 = await ctx.db.insert('notificationLogs', {
      channel: 'whatsapp_uazapi',
      recipientName: 'Paciente Teste 2',
      recipientContact: '22998877665',
      triggerType: 'manual',
      content: 'Mensagem de lembrete 2',
      status: 'failed',
      errorMessage: 'UAZAPI retornou HTTP 401',
      timestamp: Date.now() - 1000,
    })
    return { userId, log1, log2 }
  })
  return { t, ...ids }
}

test('admin can clear all notification logs and audit log is recorded', async () => {
  const f = await fixture('admin')

  // Verifica que os logs existem
  const beforeLogs = await f.t.query(api.notifications.listLogs, { sessionToken: 'staff_token' })
  expect(beforeLogs.length).toBe(2)

  // Executa a limpeza completa
  const result = await f.t.mutation(api.notifications.clearNotificationLogs, { sessionToken: 'staff_token' })
  expect(result).toEqual({ deletedCount: 2 })

  // Verifica que a lista de logs está vazia
  const afterLogs = await f.t.query(api.notifications.listLogs, { sessionToken: 'staff_token' })
  expect(afterLogs.length).toBe(0)

  // Verifica que foi registrado na trilha de auditoria administrativa
  const auditLogs = await f.t.query(api.audit.listAuditLogs, { sessionToken: 'staff_token' })
  const clearAudit = auditLogs.find((a: any) => a.action === 'clear_notification_logs')
  expect(clearAudit).toBeTruthy()
  expect(clearAudit?.details).toContain('2 registros')
})

test('admin can delete a single notification log by ID', async () => {
  const f = await fixture('admin')

  await f.t.mutation(api.notifications.deleteNotificationLog, { sessionToken: 'staff_token', id: f.log1 })

  const remaining = await f.t.query(api.notifications.listLogs, { sessionToken: 'staff_token' })
  expect(remaining.length).toBe(1)
  expect(remaining[0]._id).toBe(f.log2)

  // Verifica auditoria da exclusão individual
  const auditLogs = await f.t.query(api.audit.listAuditLogs, { sessionToken: 'staff_token' })
  const deleteAudit = auditLogs.find((a: any) => a.action === 'delete_notification_log')
  expect(deleteAudit).toBeTruthy()
  expect(deleteAudit?.details).toContain('Paciente Teste 1')
})

test.each(['reception', 'professional'] as const)('rejects clearNotificationLogs and deleteNotificationLog by %s', async (role) => {
  const f = await fixture(role)

  await expect(
    f.t.mutation(api.notifications.clearNotificationLogs, { sessionToken: 'staff_token' })
  ).rejects.toThrow(/permissão/i)

  await expect(
    f.t.mutation(api.notifications.deleteNotificationLog, { sessionToken: 'staff_token', id: f.log1 })
  ).rejects.toThrow(/permissão/i)
})

test('rejects clearNotificationLogs with invalid session token', async () => {
  const f = await fixture('admin')

  await expect(
    f.t.mutation(api.notifications.clearNotificationLogs, { sessionToken: 'invalid_token' })
  ).rejects.toThrow(/Sessão/i)
})
