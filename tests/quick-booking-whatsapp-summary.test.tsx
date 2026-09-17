// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WhatsAppSummaryModal, type WhatsAppScheduleItem } from '../src/components/quickBooking/WhatsAppSummaryModal'
import { accessPolicy } from '../shared/accessPolicy'

describe('WhatsApp Summary Modal & Policy', () => {
  it('has schedules:listSchedulesForPatient properly defined in accessPolicy for staff', () => {
    const policy = accessPolicy['schedules:listSchedulesForPatient']
    expect(policy).toBeTruthy()
    expect(policy).toContain('admin')
    expect(policy).toContain('reception')
    expect(policy).toContain('professional')
  })

  it('renders WhatsAppSummaryModal with pre-filled consolidated summary of sessions', () => {
    const items: WhatsAppScheduleItem[] = [
      {
        date: '2026-09-08',
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '08:50',
        specialty: 'fisioterapia',
        professionalName: 'Dr. Marcelo',
        roomName: 'Sala Pilates',
      },
      {
        date: '2026-09-10',
        dayOfWeek: 4,
        startTime: '08:00',
        endTime: '08:50',
        specialty: 'fisioterapia',
        professionalName: 'Dr. Marcelo',
        roomName: 'Sala Pilates',
      },
    ]

    render(
      <WhatsAppSummaryModal
        open={true}
        onClose={() => {}}
        onSend={async () => {}}
        patientName="Matteus Moreira"
        patientPhone="22999021889"
        items={items}
      />
    )

    expect(screen.getAllByText('Enviar Resumo por WhatsApp').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1 mensagem')).toBeTruthy()
    expect(screen.getByText('Matteus Moreira')).toBeTruthy()
    expect(screen.getByText('2 sessões')).toBeTruthy()

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('Matteus Moreira')
    expect(textarea.value).toContain('Fisioterapia')
    expect(textarea.value).toContain('Dr. Marcelo')
    expect(textarea.value).toContain('08/09/2026')
    expect(textarea.value).toContain('10/09/2026')
    expect(textarea.value).toContain('2 sessões')
  })

  it('allows user to edit the WhatsApp message before sending', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    const items: WhatsAppScheduleItem[] = [
      {
        date: '2026-09-08',
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '08:50',
        specialty: 'pilates',
      },
    ]

    render(
      <WhatsAppSummaryModal
        open={true}
        onClose={onClose}
        onSend={onSend}
        patientName="Matteus Moreira"
        patientPhone="22999021889"
        items={items}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: 'Mensagem customizada: Olá Matteus, traga toalha para a aula!' },
    })
    expect(textarea.value).toBe('Mensagem customizada: Olá Matteus, traga toalha para a aula!')

    const sendBtn = screen.getByRole('button', { name: /Enviar Resumo por WhatsApp/i })
    fireEvent.click(sendBtn)

    expect(onSend).toHaveBeenCalledWith('Mensagem customizada: Olá Matteus, traga toalha para a aula!')
  })

  it('does not send WhatsApp when user clicks Não Enviar WhatsApp', () => {
    const onSend = vi.fn()
    const onClose = vi.fn()

    render(
      <WhatsAppSummaryModal
        open={true}
        onClose={onClose}
        onSend={onSend}
        patientName="Matteus Moreira"
        patientPhone="22999021889"
        items={[]}
      />
    )

    const cancelBtn = screen.getByRole('button', { name: /Não Enviar WhatsApp/i })
    fireEvent.click(cancelBtn)

    expect(onClose).toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('uses templateContent and displays templateTitle when active template is configured', () => {
    const items: WhatsAppScheduleItem[] = [
      {
        date: '2026-09-08',
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '08:50',
        specialty: 'pilates',
        professionalName: 'Dr. Marcelo',
        roomName: 'Studio Pilates',
      },
    ]

    const customTemplate = 'Olá, {{paciente}}! Sua sessão de {{servico}} na {{clinica}} está confirmada com {{profissional}} para {{data}} às {{horario}}.'

    render(
      <WhatsAppSummaryModal
        open={true}
        onClose={() => {}}
        onSend={async () => {}}
        patientName="Matteus Moreira"
        patientPhone="22999021889"
        clinicName="Altar Fisio"
        items={items}
        templateContent={customTemplate}
        templateTitle="Confirmação Imediata Customizada"
      />
    )

    expect(screen.getByText(/Baseado no modelo/i)).toBeTruthy()
    expect(screen.getByText(/"Confirmação Imediata Customizada"/i)).toBeTruthy()

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('Olá, Matteus Moreira!')
    expect(textarea.value).toContain('Sua sessão de Pilates (Solo & Aparelhos) na Altar Fisio está confirmada com Dr. Marcelo')
    expect(textarea.value).toContain('08:00')
  })

  it('interpolates {{datas}} and appends sessions list when multiple sessions are booked', () => {
    const items: WhatsAppScheduleItem[] = [
      {
        date: '2026-09-08',
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '08:50',
        specialty: 'pilates',
      },
      {
        date: '2026-09-10',
        dayOfWeek: 4,
        startTime: '08:00',
        endTime: '08:50',
        specialty: 'pilates',
      },
    ]

    const templateWithDatas = 'Olá, *{{paciente}}*! Seus horários marcados na *{{clinica}}* são:\n{{datas}}\n\nTe esperamos!'

    render(
      <WhatsAppSummaryModal
        open={true}
        onClose={() => {}}
        onSend={async () => {}}
        patientName="Juliana Mendes"
        patientPhone="22999021889"
        clinicName="Altar Fisio"
        items={items}
        templateContent={templateWithDatas}
        templateTitle="Confirmação de Pacote Recorrente"
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('Olá, *Juliana Mendes*!')
    expect(textarea.value).toContain('(2 sessões)')
    expect(textarea.value).toContain('08/09/2026 às 08:00')
    expect(textarea.value).toContain('10/09/2026 às 08:00')
    expect(textarea.value).toContain('Te esperamos!')
  })
})
