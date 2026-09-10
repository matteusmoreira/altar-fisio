import { beforeEach, expect, test, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { createPublicBookingSubmit } from '../src/lib/publicBookingSubmit'

const { action } = vi.hoisted(() => ({ action: vi.fn() }))
vi.mock('convex/browser', () => ({ ConvexHttpClient: class { action = action } }))
const args = { name: 'Teste', documentCpf: '52998224725', phone: '11987654321', birthDate: '1990-01-01', date: '2099-09-09', startTime: '09:00', endTime: '09:55', answers: [] }
beforeEach(() => { action.mockReset() })

test('a lost HTTP response retries with the same receipt key', async () => {
  action.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ success: true })
  const submit = createPublicBookingSubmit('https://example.convex.cloud')
  expect(await submit(args)).toEqual({ success: true })
  expect(action.mock.calls[0][1]).toEqual(action.mock.calls[1][1])
  expect(action.mock.calls[0][1].requestId).toMatch(/^[0-9a-f-]{36}$/)
})

test('manual retry retains the key and changed data gets a new key', async () => {
  action.mockRejectedValue(new TypeError('Failed to fetch'))
  const submit = createPublicBookingSubmit('https://example.convex.cloud')
  await expect(submit(args)).rejects.toThrow(/Confira sua conexão/)
  const firstKey = action.mock.calls[0][1].requestId
  action.mockResolvedValue({ success: true })
  await submit(args)
  expect(action.mock.lastCall![1].requestId).toBe(firstKey)
  await submit({ ...args, startTime: '10:00' })
  expect(action.mock.lastCall![1].requestId).not.toBe(firstKey)
})

test('business errors are preserved without retrying', async () => {
  action.mockRejectedValue(new ConvexError('Horário indisponível.'))
  await expect(createPublicBookingSubmit('https://example.convex.cloud')(args)).rejects.toMatchObject({ data: 'Horário indisponível.' })
  expect(action).toHaveBeenCalledTimes(1)
})
