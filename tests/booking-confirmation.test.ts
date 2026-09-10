import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { DEFAULT_CONFIRMATION } from '../shared/bookingConfirmation'
import { DEFAULT_BOOKING_STEPS } from '../convex/bookingBuilder'

const modules = import.meta.glob('../convex/**/*.ts')
test('confirmation persists, survives unrelated edits, validates text and resets', async () => {
  const t = convexTest(schema, modules)
  await t.run(async ctx => {
    const now = Date.now()
    const userId = await ctx.db.insert('users', { name: 'Admin', email: 'test@example.invalid', role: 'admin', active: true, salt: 'test', passwordHash: 'test', createdAt: now })
    await ctx.db.insert('userSessions', { userId, token: 'staff', authVersion: 2, expiresAt: now + 86400000, createdAt: now })
  })
  const args = { sessionToken: 'staff', requireApproval: false, steps: DEFAULT_BOOKING_STEPS, fields: [] }
  const confirmation = { ...DEFAULT_CONFIRMATION, confirmedTitle: 'Tudo certo!', showPayment: false, address: 'Rua de exemplo, 10' }
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, confirmation })
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, welcomeTitle: 'Olá' })
  expect((await t.query(api.bookingBuilder.getBookingConfig)).confirmation).toEqual(confirmation)
  await expect(t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, confirmation: { ...confirmation, confirmedTitle: ' ' } })).rejects.toThrow(/Preencha/)
  await expect(t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, sessionToken: 'invalid', confirmation })).rejects.toThrow()
  await t.mutation(api.bookingBuilder.resetBookingConfigToDefault, { sessionToken: 'staff' })
  expect((await t.query(api.bookingBuilder.getBookingConfig)).confirmation).toEqual(DEFAULT_CONFIRMATION)
})
