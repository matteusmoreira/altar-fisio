import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

const settings = {
  clinicName: 'Clínica teste',
  clinicSubtitle: 'Teste',
  primaryColor: 'green',
  colorPreset: 'emerald',
  mode: 'light' as const,
  cancellationNoticeHours: 2,
  replacementExpiryDays: 30,
  uazapiEndpoint: 'https://whatpress.uazapi.com',
  uazapiAdminToken: 'fixture-admin-token',
}

async function fixture() {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    for (const role of ['admin', 'professional', 'reception'] as const) {
      const id = await ctx.db.insert('users', {
        name: role,
        email: `${role}@example.invalid`,
        role,
        passwordHash: 'fixture',
        salt: 'fixture',
        active: true,
        createdAt: 1,
      })
      await ctx.db.insert('userSessions', {
        userId: id,
        token: role,
        authVersion: 2,
        expiresAt: Date.now() + 60_000,
        createdAt: 1,
      })
    }
    await ctx.db.insert('clinicSettings', settings)
  })
  return t
}

describe('Exclusão e desconexão resiliente de instâncias WhatsApp', () => {
  test('exclui instância localmente se o provedor Uazapi retornar 401 (já inexistente/expirada)', async () => {
    const t = await fixture()
    const instanceId = await t.run((ctx) =>
      ctx.db.insert('whatsappInstances', {
        name: 'Matteus',
        instanceId: 'rcf670cfd74300c',
        token: 'fixture-token-401',
        status: 'connected',
        isDefault: true,
        createdAt: 1,
        updatedAt: 1,
      })
    )

    // Simula resposta 401 da Uazapi (token não existe mais no servidor)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
    )

    try {
      const result = await t.action(api.whatsapp.deleteInstanceAction, {
        sessionToken: 'admin',
        instanceId,
      })

      expect(result.success).toBe(true)
      const deleted = await t.run((ctx) => ctx.db.get(instanceId))
      expect(deleted).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('exclui instância localmente se o provedor Uazapi retornar 404 (instância não encontrada)', async () => {
    const t = await fixture()
    const instanceId = await t.run((ctx) =>
      ctx.db.insert('whatsappInstances', {
        name: 'Antiga',
        instanceId: 'antiga123',
        token: 'fixture-token-404',
        status: 'disconnected',
        isDefault: false,
        createdAt: 1,
        updatedAt: 1,
      })
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }))
    )

    try {
      const result = await t.action(api.whatsapp.deleteInstanceAction, {
        sessionToken: 'admin',
        instanceId,
      })

      expect(result.success).toBe(true)
      const deleted = await t.run((ctx) => ctx.db.get(instanceId))
      expect(deleted).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('força exclusão local se force: true mesmo com erro 500 no provedor', async () => {
    const t = await fixture()
    const instanceId = await t.run((ctx) =>
      ctx.db.insert('whatsappInstances', {
        name: 'Travada',
        instanceId: 'travada123',
        token: 'fixture-token-500',
        status: 'connected',
        isDefault: false,
        createdAt: 1,
        updatedAt: 1,
      })
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 }))
    )

    try {
      // Sem force, preserva a instância
      const resWithoutForce = await t.action(api.whatsapp.deleteInstanceAction, {
        sessionToken: 'admin',
        instanceId,
      })
      expect(resWithoutForce.success).toBe(false)
      expect(await t.run((ctx) => ctx.db.get(instanceId))).not.toBeNull()

      // Com force: true, exclui localmente
      const resWithForce = await t.action(api.whatsapp.deleteInstanceAction, {
        sessionToken: 'admin',
        instanceId,
        force: true,
      })
      expect(resWithForce.success).toBe(true)
      expect(await t.run((ctx) => ctx.db.get(instanceId))).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('desconecta instância localmente mesmo se o provedor retornar 401', async () => {
    const t = await fixture()
    const instanceId = await t.run((ctx) =>
      ctx.db.insert('whatsappInstances', {
        name: 'DesconectarTeste',
        instanceId: 'desc123',
        token: 'fixture-token-disc-401',
        status: 'connected',
        isDefault: false,
        createdAt: 1,
        updatedAt: 1,
      })
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
    )

    try {
      const result = await t.action(api.whatsapp.disconnectInstanceAction, {
        sessionToken: 'admin',
        instanceId,
      })

      expect(result.success).toBe(true)
      const updated = await t.run((ctx) => ctx.db.get(instanceId))
      expect(updated?.status).toBe('disconnected')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('quando exclui instância padrão, promove a próxima e limpa clinicSettings se não houver mais nenhuma', async () => {
    const t = await fixture()
    const inst1 = await t.run((ctx) =>
      ctx.db.insert('whatsappInstances', {
        name: 'Padrao1',
        instanceId: 'p1',
        token: 'tok-p1',
        status: 'connected',
        isDefault: true,
        createdAt: 1,
        updatedAt: 1,
      })
    )
    const inst2 = await t.run((ctx) =>
      ctx.db.insert('whatsappInstances', {
        name: 'Segunda2',
        instanceId: 'p2',
        token: 'tok-p2',
        status: 'connected',
        isDefault: false,
        createdAt: 2,
        updatedAt: 2,
      })
    )

    // Atualiza clinicSettings para apontar para tok-p1
    await t.run(async (ctx) => {
      const s = await ctx.db.query('clinicSettings').first()
      if (s) await ctx.db.patch(s._id, { activeWhatsappInstanceToken: 'tok-p1' })
    })

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))

    try {
      // Exclui inst1
      await t.action(api.whatsapp.deleteInstanceAction, { sessionToken: 'admin', instanceId: inst1 })

      // inst2 agora deve ser padrão
      const remaining = await t.run((ctx) => ctx.db.get(inst2))
      expect(remaining?.isDefault).toBe(true)

      const sAfter = await t.run((ctx) => ctx.db.query('clinicSettings').first())
      expect(sAfter?.activeWhatsappInstanceToken).toBe('tok-p2')

      // Agora exclui inst2 também
      await t.action(api.whatsapp.deleteInstanceAction, { sessionToken: 'admin', instanceId: inst2 })
      const sEmpty = await t.run((ctx) => ctx.db.query('clinicSettings').first())
      expect(sEmpty?.activeWhatsappInstanceToken).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
