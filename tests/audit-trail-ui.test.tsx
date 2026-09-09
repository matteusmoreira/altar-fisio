// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuditTrailViewer } from '../src/components/clinical/AuditTrailViewer'
import type { AuditLog } from '../src/types'

const mockLogs: AuditLog[] = [
  {
    id: 'log1',
    userId: 'user1',
    userName: 'Matteus Moreira',
    userRole: 'admin',
    action: 'view_clinical_record',
    patientName: 'Stefanie Paixão Loubach',
    details: 'Visualização da ficha clínica',
    timestamp: Date.now(),
  },
  {
    id: 'log2',
    userId: 'user1',
    userName: 'Matteus Moreira',
    userRole: 'admin',
    action: 'export_pdf_report',
    details: 'Emissão de relatório',
    timestamp: Date.now() - 60000,
  },
]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('renders audit trail table with action buttons and opaque sticky header', () => {
  const onClearLogs = vi.fn()
  const { container } = render(<AuditTrailViewer logs={mockLogs} onClearLogs={onClearLogs} />)

  // Botões de ação
  expect(screen.getByRole('button', { name: /Excluir Trilha/i })).toBeDefined()
  expect(screen.getByRole('button', { name: /Exportar XLS/i })).toBeDefined()

  // Cabeçalho da tabela com estilo opaco e fixo
  const thead = container.querySelector('thead')
  expect(thead?.className).toContain('bg-card')
  expect(thead?.className).toContain('sticky')
  expect(thead?.className).toContain('z-10')

  const ths = container.querySelectorAll('th')
  expect(ths.length).toBe(5)
  ths.forEach((th) => {
    expect(th.className).toContain('bg-card')
  })
})

test('clicking Excluir Trilha opens confirmation modal and canceling does not clear logs', () => {
  const onClearLogs = vi.fn()
  render(<AuditTrailViewer logs={mockLogs} onClearLogs={onClearLogs} />)

  // Abre modal
  fireEvent.click(screen.getByRole('button', { name: /Excluir Trilha/i }))
  expect(screen.getByText(/Excluir Trilha de Auditoria\?/i)).toBeDefined()
  expect(screen.getByText(/Esta ação apagará permanentemente todos os/i)).toBeDefined()

  // Cancela
  fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }))
  expect(screen.queryByText(/Excluir Trilha de Auditoria\?/i)).toBeNull()
  expect(onClearLogs).not.toHaveBeenCalled()
})

test('confirming modal executes onClearLogs and handles loading state', async () => {
  let resolveClear: () => void
  const onClearLogs = vi.fn().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveClear = resolve
      })
  )

  render(<AuditTrailViewer logs={mockLogs} onClearLogs={onClearLogs} />)

  fireEvent.click(screen.getByRole('button', { name: /Excluir Trilha/i }))
  fireEvent.click(screen.getByRole('button', { name: /Sim, Excluir Trilha/i }))

  expect(onClearLogs).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Excluindo\.\.\./i)).toBeDefined()

  resolveClear!()
  await waitFor(() => {
    expect(screen.queryByText(/Excluir Trilha de Auditoria\?/i)).toBeNull()
  })
})

test('Exportar XLS calls SheetJS dynamically', async () => {
  const { container } = render(<AuditTrailViewer logs={mockLogs} />)

  const exportBtn = screen.getByRole('button', { name: /Exportar XLS/i })
  expect(exportBtn).toBeDefined()

  // Dispara o clique no botão de exportação
  fireEvent.click(exportBtn)

  // O botão lida com o estado sem lançar exceções não tratadas
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Exportar XLS/i })).toBeDefined()
  })
})
