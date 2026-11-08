// Conformity assessment with measurement uncertainty (ILAC G8:09/2019, JCGM 106:2012).
// The engine only reports what the user's own criteria imply; the verdict is the user's.
import { normalCdf } from './stats.js';

function requireNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new TypeError(`${label} must be a number`);
}

/**
 * @param {object} p
 * @param {number} p.value                 measured value (or measured error)
 * @param {number} [p.lower=-Infinity]     lower tolerance limit
 * @param {number} [p.upper=Infinity]      upper tolerance limit
 * @param {number} p.expandedUncertainty   U
 * @param {number} [p.k=2]                 coverage factor of U
 * @param {number} [p.guardBand=0]         guard band w (w = 0: simple acceptance, w = U: guarded acceptance)
 */
export function assessConformity({
  value,
  lower = -Infinity,
  upper = Infinity,
  expandedUncertainty,
  k = 2,
  guardBand = 0,
}) {
  requireNumber(value, 'Measured value');
  if (!Number.isFinite(value)) throw new RangeError('Measured value must be finite');
  requireNumber(lower, 'Lower limit');
  requireNumber(upper, 'Upper limit');
  if (!Number.isFinite(lower) && !Number.isFinite(upper)) {
    throw new RangeError('At least one tolerance limit is required');
  }
  if (!(lower < upper)) throw new RangeError('Lower limit must be below the upper limit');
  requireNumber(expandedUncertainty, 'Expanded uncertainty');
  if (!(expandedUncertainty >= 0) || !Number.isFinite(expandedUncertainty)) {
    throw new RangeError('Expanded uncertainty must be a finite number of at least 0');
  }
  requireNumber(k, 'Coverage factor k');
  if (!(k > 0)) throw new RangeError('Coverage factor k must be greater than 0');
  requireNumber(guardBand, 'Guard band');
  if (!(guardBand >= 0)) throw new RangeError('Guard band must not be negative');

  const acceptanceLower = lower + guardBand;
  const acceptanceUpper = upper - guardBand;
  if (!(acceptanceLower <= acceptanceUpper)) {
    throw new RangeError('Guard band is larger than half the tolerance interval: no acceptance zone left');
  }

  const U = expandedUncertainty;
  const u = U / k;
  const withinTolerance = value >= lower && value <= upper;

  // Binary decision rule with the chosen guard band (ILAC G8 4.2).
  const inAcceptanceZone = value >= acceptanceLower && value <= acceptanceUpper;

  // Non-binary statement using the interval value +/- U (ILAC G8 4.2.3).
  let statement;
  const intervalInside = value - U >= lower && value + U <= upper;
  const intervalOutside = value + U < lower || value - U > upper;
  if (intervalInside) statement = 'pass';
  else if (intervalOutside) statement = 'fail';
  else statement = withinTolerance ? 'conditional-pass' : 'conditional-fail';

  // Probability that the true value lies within the tolerance, normal distribution N(value, u).
  let probabilityOfConformance;
  if (u === 0) probabilityOfConformance = withinTolerance ? 1 : 0;
  else probabilityOfConformance = normalCdf((upper - value) / u) - normalCdf((lower - value) / u);

  const tolerance = Number.isFinite(lower) && Number.isFinite(upper) ? upper - lower : null;
  const tur = tolerance !== null && U > 0 ? tolerance / (2 * U) : null;

  return {
    withinTolerance,
    acceptanceZone: { lower: acceptanceLower, upper: acceptanceUpper },
    inAcceptanceZone,
    statement,
    probabilityOfConformance,
    standardUncertainty: u,
    tur,
  };
}
