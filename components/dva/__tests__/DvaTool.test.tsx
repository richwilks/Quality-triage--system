// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DvaTool from '../DvaTool'

afterEach(cleanup)

// jsdom doesn't implement ResizeObserver, which recharts' ResponsiveContainer needs.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.URL.createObjectURL = vi.fn(() => 'blob:mock')
  global.URL.revokeObjectURL = vi.fn()
})

describe('DvaTool end-to-end wiring', () => {
  it('runs a worst-case/RSS calculation on the preset junction and shows results', async () => {
    const user = userEvent.setup()
    render(<DvaTool />)

    await user.click(screen.getByRole('button', { name: 'Run calculation' }))

    // Nominal for the precast panel preset is 15mm (see lib/dva/presets.ts).
    expect(await screen.findByText('15.0 mm')).toBeInTheDocument()
    expect(screen.getAllByText(/At risk|Pass|Fail/).length).toBeGreaterThan(0)
  })

  it('runs a Monte Carlo simulation and shows the failure rate and dominant driver', async () => {
    const user = userEvent.setup()
    render(<DvaTool />)

    await user.click(screen.getByRole('button', { name: 'Monte Carlo' }))

    const samplesInput = screen.getByLabelText('Samples') as HTMLInputElement
    fireEvent.change(samplesInput, { target: { value: '2000' } })
    expect(samplesInput.value).toBe('2000')

    await user.click(screen.getByRole('button', { name: 'Run calculation' }))

    expect(await screen.findByText('2,000')).toBeInTheDocument()
    expect(screen.getByText(/Clash \/ failure rate/)).toBeInTheDocument()
    expect(screen.getByText(/was the largest contributor in|No failing runs/)).toBeInTheDocument()
  })

  it('runs the buildability check alongside the dimensional one, on the preset fixings', async () => {
    const user = userEvent.setup()
    render(<DvaTool />)

    await user.click(screen.getByRole('button', { name: 'Run calculation' }))

    // Risk overview shows both flags independently.
    const riskHeading = await screen.findByText('Risk overview')
    const riskSection = riskHeading.closest('div') as HTMLElement
    expect(within(riskSection).getByText('Dimensional (fit)')).toBeInTheDocument()
    expect(within(riskSection).getByText('Buildability (installation)')).toBeInTheDocument()

    // Fixing access table lists all three preset fixings.
    const fixingHeading = screen.getByText('Fixing access')
    const fixingSection = fixingHeading.closest('div')!.parentElement as HTMLElement
    expect(within(fixingSection).getByText('Top bracket bolt')).toBeInTheDocument()
    expect(within(fixingSection).getByText('Base plate anchor bolt')).toBeInTheDocument()
    expect(within(fixingSection).getByText('Packer shim insertion')).toBeInTheDocument()

    // The base plate anchor is defined with less clearance than it requires -> Fail.
    const anchorRow = within(fixingSection).getByText('Base plate anchor bolt').closest('tr')!
    expect(within(anchorRow).getByText('Fail')).toBeInTheDocument()

    // The sequence is satisfiable for the preset (no circular dependency).
    expect(await screen.findByText(/A valid installation order exists/)).toBeInTheDocument()
  })

  it('logs a result as evidence and can view/export it', async () => {
    const user = userEvent.setup()
    render(<DvaTool />)

    await user.click(screen.getByRole('button', { name: 'Run calculation' }))
    await user.click(await screen.findByRole('button', { name: 'Log as evidence' }))

    const evidenceHeading = screen.getByRole('heading', { name: 'Evidence log' })
    const evidenceSection = evidenceHeading.parentElement as HTMLElement
    const logEntry = await within(evidenceSection).findByText(/Worst-case \/ RSS/)
    expect(logEntry).toBeInTheDocument()

    const row = logEntry.closest('li')!
    await user.click(within(row).getByRole('button', { name: 'View / Print' }))

    expect(await screen.findByText('Dimensional Variation Analysis — Evidence Record')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print / Save as PDF' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Back to tool' }))
    expect(await screen.findByRole('button', { name: 'Run calculation' })).toBeInTheDocument()
  })
})
