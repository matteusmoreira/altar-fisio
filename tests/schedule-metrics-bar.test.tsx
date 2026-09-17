// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleMetricsBar } from '../src/components/schedule/ScheduleMetricsBar'
import type { Schedule } from '@/types'

describe('ScheduleMetricsBar', () => {
  it('exibe "Vagas Ocupadas" em vez de "Alunos / Vagas" e calcula métricas corretamente', () => {
    const fakeSchedules: Schedule[] = [
      {
        id: 's1',
        roomId: 'r1',
        professionalId: 'p1',
        date: '2026-09-01',
        startTime: '08:00',
        endTime: '09:00',
        maxCapacity: 5,
        type: 'turma',
        status: 'scheduled',
        participants: [
          { id: 'part1', patientId: 'pat1', patientName: 'Matteus Moreira', status: 'scheduled' },
          { id: 'part2', patientId: 'pat2', patientName: 'Noah Loubach', status: 'scheduled' },
        ],
      },
      {
        id: 's2',
        roomId: 'r1',
        professionalId: 'p1',
        date: '2026-09-02',
        startTime: '08:00',
        endTime: '09:00',
        maxCapacity: 5,
        type: 'turma',
        status: 'scheduled',
        participants: [
          { id: 'part3', patientId: 'pat1', patientName: 'Matteus Moreira', status: 'scheduled' },
        ],
      },
    ]

    render(<ScheduleMetricsBar schedules={fakeSchedules} />)

    // Verifica que "Vagas Ocupadas" está presente no DOM
    expect(screen.getByText('Vagas Ocupadas')).toBeTruthy()
    // Verifica que o rótulo antigo "Alunos / Vagas" NÃO está mais presente
    expect(screen.queryByText('Alunos / Vagas')).toBeNull()

    // Sessões: 2
    expect(screen.getByText('2')).toBeTruthy()

    // Vagas Ocupadas: 3 / 10
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('/ 10')).toBeTruthy()

    // Vagas Livres: 7
    expect(screen.getByText('7')).toBeTruthy()

    // Ocupação: 30%
    expect(screen.getByText('30%')).toBeTruthy()

    // Tooltip com pacientes únicos
    const occupiedCard = screen.getByTitle(/3 vaga\(s\) ocupada\(s\) em 2 sessão\(ões\) \(2 pacientes únicos\)/)
    expect(occupiedCard).toBeTruthy()
  })
})
