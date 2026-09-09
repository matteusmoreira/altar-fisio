// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { api } from '../convex/_generated/api'
import { staffErrorMessage } from '../src/lib/staffErrors'
const mocks = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ token: 'staff' }) }))
vi.mock('convex/react', () => ({ useMutation: () => mocks.call, useAction: () => mocks.call, useQuery: vi.fn() }))
import { useMutation, useAction } from '../src/lib/staffConvex'
afterEach(() => { cleanup(); mocks.call.mockReset() })
test.each([new Error('[CONVEX M(schedules:addParticipantToSchedule)] [Request ID: abc] Server Error Called by client'), new Error('secret internal path'), null])('does not expose technical errors', error => {
  expect(staffErrorMessage(error)).toContain('Atualize a página')
  expect(staffErrorMessage(error)).not.toMatch(/CONVEX|Request ID|Server Error|secret/)
})
test('preserves only intentional public error data', () => {
  expect(staffErrorMessage(new ConvexError('Esta turma está lotada.'))).toBe('Esta turma está lotada.')
})
test.each([useMutation, useAction])('staff wrapper delivers clean messages to existing admin screens', useCall => {
  mocks.call.mockRejectedValue(new ConvexError('Esta turma está lotada.'))
  const { result } = renderHook(() => useCall(api.schedules.addParticipantToSchedule as any))
  return expect(result.current({})).rejects.toThrow(/^Esta turma está lotada\.$/)
})
