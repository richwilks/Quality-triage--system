import { describe, expect, it } from 'vitest'
import { componentFromPickedElement } from '../mapping'

describe('componentFromPickedElement', () => {
  it('reads the chosen axis extent as the nominal value', () => {
    const component = componentFromPickedElement({
      id: 'c1',
      name: 'Panel width',
      bounds: { width: 2985.4, height: 3200, depth: 200 },
      axis: 'width',
      sign: -1,
    })

    expect(component.nominal_value).toBe(2985.4)
    expect(component.sign).toBe(-1)
    expect(component.name).toBe('Panel width')
  })

  it('rounds the extracted dimension to 2 decimal places', () => {
    const component = componentFromPickedElement({
      id: 'c1',
      name: 'x',
      bounds: { width: 100, height: 3199.99999, depth: 0 },
      axis: 'height',
      sign: 1,
    })
    expect(component.nominal_value).toBe(3200)
  })

  it('applies a tolerance preset when given one', () => {
    const component = componentFromPickedElement({
      id: 'c1',
      name: 'Panel width',
      bounds: { width: 2985, height: 0, depth: 0 },
      axis: 'width',
      sign: -1,
      tolerancePresetId: 'precast-panel-manufacture',
    })

    expect(component.tolerance_plus).toBe(4)
    expect(component.tolerance_minus).toBe(4)
  })

  it('falls back to a placeholder tolerance when no preset is given or found', () => {
    const noPreset = componentFromPickedElement({
      id: 'c1',
      name: 'x',
      bounds: { width: 100, height: 0, depth: 0 },
      axis: 'width',
      sign: 1,
    })
    expect(noPreset.tolerance_plus).toBe(1)
    expect(noPreset.tolerance_minus).toBe(1)

    const unknownPreset = componentFromPickedElement({
      id: 'c1',
      name: 'x',
      bounds: { width: 100, height: 0, depth: 0 },
      axis: 'width',
      sign: 1,
      tolerancePresetId: 'does-not-exist',
    })
    expect(unknownPreset.tolerance_plus).toBe(1)
    expect(unknownPreset.tolerance_minus).toBe(1)
  })

  it('defaults distribution to normal and contributes_to to gap', () => {
    const component = componentFromPickedElement({
      id: 'c1',
      name: 'x',
      bounds: { width: 100, height: 0, depth: 0 },
      axis: 'width',
      sign: 1,
    })
    expect(component.distribution_type).toBe('normal')
    expect(component.contributes_to).toBe('gap')
  })
})
