// MVP scope is a single junction type (build brief section 3): precast panel to
// steel frame connection. This is the starter definition the input form
// prefills, based on typical face-gap tolerance chains for that junction.

import { Junction } from './types'

export function createPrecastPanelToSteelFramePreset(): Junction {
  return {
    id: 'precast-panel-steel-frame',
    name: 'Precast panel to steel frame — face gap',
    type: 'precast panel to steel frame',
    requirement: {
      parameter: 'face gap',
      acceptable_min: 10,
      acceptable_max: 20,
      unit: 'mm',
    },
    components: [
      {
        id: 'panel-width',
        name: 'Panel width',
        nominal_value: 2985,
        tolerance_plus: 4,
        tolerance_minus: 4,
        distribution_type: 'normal',
        contributes_to: 'gap',
        sign: -1,
      },
      {
        id: 'frame-bay-width',
        name: 'Frame bay width',
        nominal_value: 3000,
        tolerance_plus: 6,
        tolerance_minus: 6,
        distribution_type: 'normal',
        contributes_to: 'gap',
        sign: 1,
      },
      {
        id: 'erection-tolerance',
        name: 'Erection / setting-out tolerance',
        nominal_value: 0,
        tolerance_plus: 5,
        tolerance_minus: 5,
        distribution_type: 'normal',
        contributes_to: 'gap',
        sign: 1,
      },
      {
        id: 'connection-tolerance',
        name: 'Connection / packer tolerance',
        nominal_value: 0,
        tolerance_plus: 3,
        tolerance_minus: 3,
        distribution_type: 'normal',
        contributes_to: 'gap',
        sign: 1,
      },
    ],
  }
}
