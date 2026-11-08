// GUM uncertainty budget for uncorrelated input quantities (GUM 5.1).
import { coverageFactor } from './stats.js';

/** Divisors that turn a half-width a into a standard uncertainty (GUM 4.3.7 - 4.3.9). */
export const DIVISORS = Object.freeze({
  rectangular: Math.sqrt(3),
  triangular: Math.sqrt(6),
  'u-shaped': Math.SQRT2,
});

function requireFinite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function requirePositive(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be greater than 0`);
}

function optionalDof(dof) {
  if (dof === undefined || dof === null) return Infinity;
  if (dof !== Infinity) requirePositive(dof, 'Degrees of freedom');
  return dof;
}

/** Type A evaluation from repeated readings (GUM 4.2). */
export function typeA(readings) {
  if (!Array.isArray(readings) || readings.length < 2) {
    throw new RangeError('Type A evaluation needs at least 2 readings');
  }
  readings.forEach((r, i) => requireFinite(r, `Reading ${i + 1}`));
  const n = readings.length;
  const mean = readings.reduce((sum, r) => sum + r, 0) / n;
  const variance = readings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (n - 1);
  const s = Math.sqrt(variance);
  return { n, mean, s, u: s / Math.sqrt(n), dof: n - 1 };
}

/**
 * Standard uncertainty and degrees of freedom of one budget component.
 *
 * Supported methods:
 *  - 'typeA'        { readings } or { s, n }        u = s / sqrt(n), dof = n - 1
 *  - 'rectangular'  { halfWidth }                   u = a / sqrt(3)
 *  - 'triangular'   { halfWidth }                   u = a / sqrt(6)
 *  - 'u-shaped'     { halfWidth }                   u = a / sqrt(2)
 *  - 'normal'       { expanded, k }                 u = U / k (e.g. from a certificate)
 *  - 'standard'     { u }                           u given directly
 * Type B components may carry an optional `dof` (default Infinity).
 */
export function standardUncertainty(component) {
  const { method } = component;
  switch (method) {
    case 'typeA': {
      if (component.readings) {
        const a = typeA(component.readings);
        return { u: a.u, dof: a.dof };
      }
      requireFinite(component.s, 'Standard deviation s');
      if (component.s < 0) throw new RangeError('Standard deviation s must not be negative');
      requireFinite(component.n, 'n');
      if (!Number.isInteger(component.n) || component.n < 2) {
        throw new RangeError('n must be an integer of at least 2');
      }
      return { u: component.s / Math.sqrt(component.n), dof: component.n - 1 };
    }
    case 'rectangular':
    case 'triangular':
    case 'u-shaped': {
      requireFinite(component.halfWidth, 'Half-width');
      if (component.halfWidth < 0) throw new RangeError('Half-width must not be negative');
      return { u: component.halfWidth / DIVISORS[method], dof: optionalDof(component.dof) };
    }
    case 'normal': {
      requireFinite(component.expanded, 'Expanded uncertainty');
      if (component.expanded < 0) throw new RangeError('Expanded uncertainty must not be negative');
      requirePositive(component.k, 'Coverage factor k');
      return { u: component.expanded / component.k, dof: optionalDof(component.dof) };
    }
    case 'standard': {
      requireFinite(component.u, 'Standard uncertainty');
      if (component.u < 0) throw new RangeError('Standard uncertainty must not be negative');
      return { u: component.u, dof: optionalDof(component.dof) };
    }
    default:
      throw new RangeError(`Unknown method: ${method}`);
  }
}

/**
 * Evaluate a full budget.
 * @param {Array} components  each { name, method, sensitivity = 1, ...method fields }
 * @param {{coverageProbability?: number}} options
 */
export function evaluateBudget(components, { coverageProbability = 0.9545 } = {}) {
  if (!Array.isArray(components) || components.length === 0) {
    throw new RangeError('A budget needs at least one component');
  }
  const rows = components.map((c, i) => {
    const sensitivity = c.sensitivity ?? 1;
    requireFinite(sensitivity, `Sensitivity coefficient of component ${i + 1}`);
    const { u, dof } = standardUncertainty(c);
    return { name: c.name ?? `Component ${i + 1}`, method: c.method, sensitivity, u, dof, contribution: Math.abs(sensitivity) * u };
  });

  const variance = rows.reduce((sum, r) => sum + r.contribution ** 2, 0);
  const combined = Math.sqrt(variance);

  // Welch-Satterthwaite (GUM G.4.1); terms with infinite dof contribute 0.
  const wsDenominator = rows.reduce(
    (sum, r) => (Number.isFinite(r.dof) ? sum + r.contribution ** 4 / r.dof : sum),
    0,
  );
  const effectiveDof = wsDenominator > 0 ? variance ** 2 / wsDenominator : Infinity;
  // GUM G.4.1 note 1: truncate to the next lower integer before looking up k.
  const dofForK = Number.isFinite(effectiveDof) ? Math.max(1, Math.floor(effectiveDof)) : Infinity;
  const k = coverageFactor(coverageProbability, dofForK);

  return {
    rows: rows.map((r) => ({ ...r, share: variance > 0 ? r.contribution ** 2 / variance : 0 })),
    combined,
    effectiveDof,
    dofForK,
    coverageProbability,
    k,
    expanded: k * combined,
  };
}
