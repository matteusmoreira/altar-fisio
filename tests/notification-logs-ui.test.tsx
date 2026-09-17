// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({
  isAdmin: true,
  logs: [
    {
      id: 'log1',
      channel: 'whatsapp_uazapi',
      recipientName: 'Stefanie Paixão Loubach',
      recipientContact: '22992904831',
      triggerType: 'manual',
      content: 'Olá Stefanie, seu agendamento foi confirmado!',
      status: 'failed',
      errorMessage: 'UAZAPI retornou HTTP 401',
      timestamp: 1789649400000,
    },
    {
      id: 'log2',
      channel: 'whatsapp_uazapi',
      recipientName: 'Juliana Mendes da Silva',
      recipientContact: '22999021889',
      triggerType: 'lembrete_24h',
      content: 'Olá Juliana, seu atendimento é amanhã!',
      status: 'sent',
      timestamp: 1789649500000,
    },
  ],
  stats: {
    total: 2,
    totalSent: 1,
    totalFailed: 1,
    totalQueued: 0,
    whatsappCount: 2,
    emailCount: 0,
    todayCount: 2,
    successRate: 50,
  },
  clearLogsMutation: vi.fn(),
  deleteLogMutation: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: mocks.isAdmin,
    role: mocks.isAdmin ? 'admin' : 'reception',
    isAuthenticated: true,
    token: 'test_token',
  }),
}))

vi.mock('@/contexts/ClinicDataContext', () => ({
  useClinicData: () => ({
    notificationLogs: mocks.logs,
    notificationStats: mocks.stats,
    schedules: [],
    sendWhatsAppReminder: vi.fn(),
    sendEmailReceipt: vi.fn(),
    triggerUpcomingRemindersNow: vi.fn(),
    testUazapiConnection: vi.fn(),
    testResendConnection: vi.fn(),
  }),
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: { mode: 'light', colorPreset: 'emerald' },
  }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (reference: unknown) => {
    const name = getFunctionName(reference as any)
    if (name.includes('listInstances')) return []
    return []
  },
  useAction: () => vi.fn(),
  useMutation: (reference: unknown) => {
    const name = getFunctionName(reference as any)
    if (name.includes('clearNotificationLogs')) return mocks.clearLogsMutation
    if (name.includes('deleteNotificationLog')) return mocks.deleteLogMutation
    return vi.fn()
  },
}))

import { NotificationsPage } from '../src/pages/NotificationsPage'

function activateTab(tab: HTMLElement) {
  fireEvent.pointerDown(tab, { button: 0 })
  fireEvent.click(tab)
  fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(tab, { key: ' ', code: 'Space' })
}

beforeEach(() => {
  mocks.isAdmin = true
  mocks.clearLogsMutation.mockReset()
  mocks.deleteLogMutation.mockReset()
  mocks.clearLogsMutation.mockResolvedValue({ deletedCount: 2 })
  mocks.deleteLogMutation.mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('admin sees Excluir Todos os Logs button and can clear all logs through confirmation modal', async () => {
  mocks.isAdmin = true
  render(<NotificationsPage />)

  // Clica na aba Histórico & Auditoria
  const historyTab = screen.getByRole('tab', { name: /Histórico & Auditoria/i })
  activateTab(historyTab)

  // Botão de exclusão total deve estar visível para admin
  const clearAllBtn = screen.getByRole('button', { name: /Excluir Todos os Logs/i })
  expect(clearAllBtn).toBeTruthy()

  // Clica no botão para abrir o modal de confirmação
  fireEvent.click(clearAllBtn)

  // Verifica que o modal abriu com título e alerta
  expect(screen.getByText(/Excluir Todos os Logs de Notificação?/i)).toBeTruthy()
  expect(screen.getByText(/Esta ação apagará permanentemente todos os/i)).toBeTruthy()

  // Clica em Cancelar
  const cancelBtn = screen.getByRole('button', { name: /Cancelar/i })
  fireEvent.click(cancelBtn)
  expect(mocks.clearLogsMutation).not.toHaveBeenCalled()

  // Abre novamente e confirma
  fireEvent.click(clearAllBtn)
  const confirmBtn = screen.getByRole('button', { name: /Sim, Excluir Todos/i })
  fireEvent.click(confirmBtn)

  expect(mocks.clearLogsMutation).toHaveBeenCalledTimes(1)
})

test('admin can delete a single notification log item via trash button', async () => {
  mocks.isAdmin = true
  render(<NotificationsPage />)

  // Clica na aba Histórico & Auditoria
  const historyTab = screen.getByRole('tab', { name: /Histórico & Auditoria/i })
  activateTab(historyTab)

  // Botões de lixeira individuais existem para cada log
  const deleteSingleButtons = screen.getAllByTitle('Excluir este log')
  expect(deleteSingleButtons.length).toBe(2)

  // Clica para excluir o primeiro log
  fireEvent.click(deleteSingleButtons[0])

  // Confirmação individual
  expect(screen.getByText(/Excluir Registro de Notificação?/i)).toBeTruthy()
  expect(screen.getAllByText(/Stefanie Paixão Loubach/i).length).toBeGreaterThanOrEqual(1)

  // Clica em Excluir
  const confirmBtn = screen.getByRole('button', { name: /^Excluir$/i })
  fireEvent.click(confirmBtn)

  expect(mocks.deleteLogMutation).toHaveBeenCalledWith({ id: 'log1' })
})

test('non-admin user does not see Excluir Todos os Logs or row trash buttons', () => {
  mocks.isAdmin = false
  render(<NotificationsPage />)

  // Clica na aba Histórico & Auditoria
  const historyTab = screen.getByRole('tab', { name: /Histórico & Auditoria/i })
  activateTab(historyTab)

  // Botão de exclusão total NÃO deve existir
  expect(screen.queryByRole('button', { name: /Excluir Todos os Logs/i })).toBeNull()

  // Botões de exclusão individual NÃO devem existir
  expect(screen.queryAllByTitle('Excluir este log').length).toBe(0)
})

test('NotificationsPage does not render AppointmentDeliveryProblems banner', () => {
  render(<NotificationsPage />)
  expect(screen.queryByText(/WhatsApp: envios que precisam de atenção/i)).toBeNull()
  expect(screen.queryByLabelText(/Envios que precisam de atenção/i)).toBeNull()
})

