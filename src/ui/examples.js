// Example budgets. Field values are strings, exactly as a user would type them.

export const EXAMPLES = [
  {
    id: 'thermometer',
    title: 'Digital thermometer at 50 °C',
    measurand: 'Error of digital thermometer at 50 °C',
    unit: '°C',
    rows: [
      { name: 'Reference thermometer (certificate)', method: 'normal', fields: { expanded: '0.10', k: '2' } },
      { name: 'Drift of reference thermometer', method: 'rectangular', fields: { halfWidth: '0.05' } },
      { name: 'Inhomogeneity of the bath', method: 'rectangular', fields: { halfWidth: '0.08' } },
      { name: 'Resolution of the thermometer (0.1 °C)', method: 'rectangular', fields: { halfWidth: '0.05' } },
      { name: 'Repeatability', method: 'typeA', fields: { readings: '50.31 50.28 50.33 50.30 50.27' } },
    ],
    conformity: { value: '0.30', lower: '-0.5', upper: '0.5' },
  },
  {
    id: 'micrometer',
    title: 'Micrometer, 4 readings (small sample)',
    measurand: 'Diameter of a 10 mm pin measured with a digital micrometer',
    unit: 'mm',
    rows: [
      { name: 'Repeatability (4 readings)', method: 'typeA', fields: { readings: '10.012 10.018 10.009 10.015' } },
      { name: 'Micrometer calibration (certificate)', method: 'normal', fields: { expanded: '0.004', k: '2' } },
      { name: 'Resolution of the micrometer (0.001 mm)', method: 'rectangular', fields: { halfWidth: '0.0005' } },
    ],
  },
  {
    id: 'ea402-s2',
    title: 'EA-4/02 S2: weight 10 kg (mg)',
    measurand: 'Conventional mass of a 10 kg weight (deviation from reference)',
    unit: 'mg',
    rows: [
      { name: 'mS reference standard', method: 'normal', fields: { expanded: '45', k: '2' } },
      { name: 'δmD drift of reference', method: 'rectangular', fields: { halfWidth: '15' } },
      { name: 'δm observed difference', method: 'typeAPooled', fields: { s: '25', n: '3', dof: '∞' } },
      { name: 'δmC eccentricity, magnetism', method: 'rectangular', fields: { halfWidth: '10' } },
      { name: 'δB air buoyancy', method: 'rectangular', fields: { halfWidth: '10' } },
    ],
  },
  {
    id: 'ea402-s3',
    title: 'EA-4/02 S3: resistor 10 kΩ (mΩ)',
    measurand: 'Resistance of a 10 kΩ standard resistor',
    unit: 'mΩ',
    rows: [
      { name: 'RS reference standard', method: 'normal', fields: { expanded: '5', k: '2' } },
      { name: 'δRD drift of reference', method: 'rectangular', fields: { halfWidth: '10' } },
      { name: 'δRTS temperature of reference', method: 'rectangular', fields: { halfWidth: '2.75' } },
      { name: 'δRTX temperature of unknown', method: 'rectangular', fields: { halfWidth: '5.5' } },
      { name: 'rC DMM correction factor', method: 'triangular', fields: { halfWidth: '1e-6' }, sensitivity: '1e7' },
      { name: 'r observed ratio', method: 'typeA', fields: { readings: '1.0000104 1.0000107 1.0000106 1.0000103 1.0000105' }, sensitivity: '1e7' },
    ],
  },
  {
    id: 'ea402-s4',
    title: 'EA-4/02 S4: gauge block 50 mm (nm)',
    measurand: 'Length of a 50 mm gauge block',
    unit: 'nm',
    rows: [
      { name: 'lS reference gauge block', method: 'normal', fields: { expanded: '30', k: '2' } },
      { name: 'δlD drift of reference', method: 'triangular', fields: { halfWidth: '30' } },
      { name: 'δl observed difference', method: 'typeAPooled', fields: { s: '12', n: '5', dof: '∞' } },
      { name: 'δlC comparator', method: 'standard', fields: { u: '18.5' } },
      { name: 'δt temperature difference', method: 'rectangular', fields: { halfWidth: '0.05' }, sensitivity: '-575' },
      { name: 'δα·θ product term', method: 'standard', fields: { u: '0.236e-6' }, sensitivity: '-50e6' },
      { name: 'δlV off-centre probing', method: 'rectangular', fields: { halfWidth: '6.7' }, sensitivity: '-1' },
    ],
  },
];
