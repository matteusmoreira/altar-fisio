// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ScheduleMetricsBar } from '../src/components/schedule/ScheduleMetricsBar'
import { WeeklyScheduleView } from '../src/components/schedule/WeeklyScheduleView'
import { MonthlyScheduleView } from '../src/components/schedule/MonthlyScheduleView'
import type { Schedule } from '@/types'

afterEach(() => {
  cleanup()
})

const mockSchedules: Schedule[] = [
  {
    id: 's1',
    roomId: 'r1',
    roomName: 'Studio Pilates',
    roomColor: '#10b981',
    professionalId: 'p1',
    professionalName: 'Dr. Marcelo Henrique',
    date: '2026-09-15',
    startTime: '08:00',
    endTime: '08:50',
    maxCapacity: 4,
    type: 'turma',
    specialty: 'pilates',
    title: 'Pilates Solo',
    status: 'scheduled',
    participants: [
      { id: 'part1', patientId: 'pat1', patientName: 'Carlos Drummond', patientPhone: '11999991111', status: 'scheduled' },
      { id: 'part2', patientId: 'pat2', patientName: 'Clarice Lispector', patientPhone: '11988882222', status: 'present' },
    ],
  },
]

describe('Schedule Responsiveness & Adaptive Layout', () => {
  it('ScheduleMetricsBar incorporates responsive classes (grid-cols-2 lg:grid-cols-4) and fluid width', () => {
    const { container } = render(<ScheduleMetricsBar schedules={mockSchedules} />)
    const metricsGrid = container.firstElementChild
    expect(metricsGrid?.className).toContain('grid-cols-2')
    expect(metricsGrid?.className).toContain('lg:grid-cols-4')
    expect(metricsGrid?.className).toContain('w-full')
    expect(metricsGrid?.className).toContain('min-w-0')
  })

  it('MonthlyScheduleView applies responsive flex-col xl:flex-row layout and fluid sidebar to avoid squashing', () => {
    const { container } = render(
      <MonthlyScheduleView
        currentDate="2026-09-15"
        schedules={mockSchedules}
        onSelectSchedule={vi.fn()}
        onCreateScheduleAtDate={vi.fn()}
        onNavigateToDay={vi.fn()}
        onOpenEnroll={vi.fn()}
      />
    )

    const mainFlex = container.firstElementChild
    expect(mainFlex?.className).toContain('flex-col')
    expect(mainFlex?.className).toContain('xl:flex-row')
    expect(mainFlex?.className).toContain('w-full')
    expect(mainFlex?.className).toContain('min-w-0')

    // Sidebar has flexible width xl:w-80 2xl:w-96 instead of rigid w-96
    const sidebar = container.querySelector('.xl\\:w-80')
    expect(sidebar).toBeTruthy()
    expect(sidebar?.className).toContain('2xl:w-96')
  })

  it('WeeklyScheduleView renders fluid 5-column desktop grid with min-w-[680px] xl:min-w-0 and mobile pills on < md', () => {
    const { container } = render(
      <WeeklyScheduleView
        currentDate="2026-09-15"
        schedules={mockSchedules}
        onSelectSchedule={vi.fn()}
        onCreateScheduleAtDate={vi.fn()}
        onOpenEnroll={vi.fn()}
      />
    )

    // Desktop grid wrapper has touch-pan-x and min-w-0
    const desktopGrid = container.querySelector('.min-w-\\[680px\\]')
    expect(desktopGrid).toBeTruthy()
    expect(desktopGrid?.className).toContain('xl:min-w-0')
    expect(desktopGrid?.className).toContain('w-full')
    expect(desktopGrid?.className).toContain('grid-cols-5')

    // Confirma que não possui coluna de Sábado ou Domingo na visualização semanal
    expect(container.textContent).toContain('Seg')
    expect(container.textContent).toContain('Sex')
    expect(container.textContent).not.toContain('Sáb')
    expect(container.textContent).not.toContain('Dom')

    // Mobile pills selector is set to md:hidden
    const mobilePills = container.querySelector('.md\\:hidden')
    expect(mobilePills).toBeTruthy()
  })
})
