import { expect, test } from 'vitest'
import { clinicDateTime, isFutureBooking } from '../shared/bookingTime'

test('the clinic day remains in Sao Paulo when UTC has advanced to tomorrow', () => {
  const now = Date.parse('2026-09-10T01:00:00Z')
  expect(clinicDateTime(now)).toBe('2026-09-09T22:00')
  expect(isFutureBooking('2026-09-09', '23:00', now)).toBe(true)
  expect(isFutureBooking('2026-09-09', '08:00', now)).toBe(false)
  expect(isFutureBooking('2026-09-10', '08:00', now)).toBe(true)
})

test('midnight uses hour zero and a session expires at its exact start', () => {
  const now = Date.parse('2026-09-10T03:00:00Z')
  expect(clinicDateTime(now)).toBe('2026-09-10T00:00')
  expect(isFutureBooking('2026-09-10', '00:00', now)).toBe(false)
  expect(isFutureBooking('2026-09-10', '00:01', now)).toBe(true)
})
