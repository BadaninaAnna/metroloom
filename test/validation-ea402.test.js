// Validation against the worked examples of EA-4/02 M:2022
// "Evaluation of the Uncertainty of Measurement in Calibration" (EA, approved 2021-11-05).
// Input data and expected results are taken from the document's supplement
// (examples S2, S3, S4) and from table E.1. Expected values are compared with the
// tolerance implied by the number of digits EA prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBudget } from '../src/core/budget.js';
import { coverageFactor } from '../src/core/stats.js';

// |actual - expected| must not exceed half a unit of the last printed digit (+ tiny slack).
function matchesPrinted(actual, printed, decimals, label) {
  const tol = 0.5 * 10 ** -decimals + 1e-9;
  assert.ok(
    Math.abs(actual - printed) <= tol,
    `${label}: EA prints ${printed}, engine gives ${actual} (tolerance ${tol})`,
  );
}

test('EA-4/02 table E.1: coverage factors for p = 95.45 %', () => {
  const tableE1 = {
    1: 13.97, 2: 4.53, 3: 3.31, 4: 2.87, 5: 2.65, 6: 2.52, 7: 2.43, 8: 2.37, 9: 2.32, 10: 2.28,
    12: 2.23, 13: 2.21, 14: 2.2, 15: 2.18, 16: 2.17, 17: 2.16, 18: 2.15, 19: 2.14, 20: 2.13,
    25: 2.11, 30: 2.09, 35: 2.07, 40: 2.06, 45: 2.06, 50: 2.05,
  };
  for (const [nu, k] of Object.entries(tableE1)) {
    matchesPrinted(coverageFactor(0.9545, Number(nu)), k, 2, `k for nu = ${nu}`);
  }
  matchesPrinted(coverageFactor(0.9545, Infinity), 2.0, 2, 'k for nu = infinity');
});

// Table E.1 (German translation, 31.08.2022) prints k = 2.24 for nu = 11. The
// t-distribution gives 2.2549 (confirmed independently by numerical integration
// of the t density), which fits smoothly between 2.28 (nu = 10) and 2.23 (nu = 12).
// The printed value is treated as a misprint; the engine uses the exact quantile.
test('EA-4/02 table E.1, nu = 11: exact value 2.25 (table prints 2.24)', () => {
  matchesPrinted(coverageFactor(0.9545, 11), 2.25, 2, 'k for nu = 11');
});

// S2: calibration of a weight of nominal value 10 kg (all values in mg).
test('EA-4/02 S2: 10 kg weight, u(mX) = 29.3 mg, U = 59 mg', () => {
  const b = evaluateBudget([
    { name: 'mS reference standard', method: 'normal', expanded: 45, k: 2 },
    { name: 'dmD drift of reference', method: 'rectangular', halfWidth: 15 },
    // pooled s = 25 mg from earlier evaluations, 3 observations; EA treats it as reliable
    { name: 'dm observed difference', method: 'typeA', s: 25, n: 3, dof: Infinity },
    { name: 'dmC eccentricity and magnetism', method: 'rectangular', halfWidth: 10 },
    { name: 'dB air buoyancy (1e-6 of 10 kg)', method: 'rectangular', halfWidth: 10 },
  ]);
  const printedU = [22.5, 8.66, 14.4, 5.77, 5.77];
  const decimals = [1, 2, 1, 2, 2];
  b.rows.forEach((r, i) => matchesPrinted(r.contribution, printedU[i], decimals[i], r.name));
  matchesPrinted(b.combined, 29.3, 1, 'u(mX)');
  matchesPrinted(b.k, 2.0, 2, 'k');
  matchesPrinted(b.expanded, 59, 0, 'U');
});

// S3: calibration of a standard resistor of nominal value 10 kOhm (contributions in mOhm).
test('EA-4/02 S3: 10 kOhm resistor, u(RX) = 8.33 mOhm, U = 17 mOhm', () => {
  const RNOM = 10_000_000; // 10 kOhm expressed in mOhm, sensitivity of the ratios
  const b = evaluateBudget([
    { name: 'RS reference standard', method: 'normal', expanded: 5, k: 2 },
    { name: 'dRD drift of reference', method: 'rectangular', halfWidth: 10 },
    { name: 'dRTS temperature, reference', method: 'rectangular', halfWidth: 2.75 },
    { name: 'dRTX temperature, unknown', method: 'rectangular', halfWidth: 5.5 },
    { name: 'rC DMM correction factor', method: 'triangular', halfWidth: 1e-6, sensitivity: RNOM },
    {
      name: 'r observed ratio',
      method: 'typeA',
      readings: [1.0000104, 1.0000107, 1.0000106, 1.0000103, 1.0000105],
      sensitivity: RNOM,
    },
  ]);
  const printedU = [2.5, 5.8, 1.6, 3.2, 4.1, 0.7];
  b.rows.forEach((r, i) => matchesPrinted(r.contribution, printedU[i], 1, r.name));
  matchesPrinted(b.rows[5].u, 0.0707e-6, 10, 'u(r)');
  matchesPrinted(b.combined, 8.33, 2, 'u(RX)');
  matchesPrinted(b.k, 2.0, 2, 'k');
  matchesPrinted(b.expanded, 17, 0, 'U');
});

// S4: calibration of a gauge block of nominal length 50 mm (contributions in nm).
test('EA-4/02 S4: 50 mm gauge block, u(lX) = 34.3 nm, U = 69 nm', () => {
  const b = evaluateBudget([
    { name: 'lS reference gauge block', method: 'normal', expanded: 30, k: 2 },
    { name: 'dlD drift of reference', method: 'triangular', halfWidth: 30 },
    // pooled s = 12 nm from the comparator verification, 5 observations
    { name: 'dl observed difference', method: 'typeA', s: 12, n: 5, dof: Infinity },
    // EA prints u = 18.5 nm for the comparator; taken as given (limits 32 nm, rectangular)
    { name: 'dlC comparator', method: 'standard', u: 18.5 },
    { name: 'dt temperature difference', method: 'rectangular', halfWidth: 0.05, sensitivity: -575 },
    // product term (alpha difference x temperature deviation), u given in S4.6
    { name: 'da x theta', method: 'standard', u: 0.236e-6, sensitivity: -50e6 },
    { name: 'dlV off-centre probing', method: 'rectangular', halfWidth: 6.7, sensitivity: -1 },
  ]);
  const printedU = [15.0, 12.2, 5.37, 18.5, 16.6, 11.8, 3.87];
  const decimals = [1, 1, 2, 1, 1, 1, 2];
  b.rows.forEach((r, i) => matchesPrinted(r.contribution, printedU[i], decimals[i], r.name));
  matchesPrinted(b.combined, 34.3, 1, 'u(lX)');
  matchesPrinted(b.expanded, 69, 0, 'U');
});

// Why the degrees of freedom of a pooled standard deviation matter: if the pooled
// s in S2 were (wrongly) given only n - 1 = 2 degrees of freedom, k would rise and
// U would no longer match EA. The UI must therefore ask for the dof of a pooled s.
test('EA-4/02 S2 with n - 1 dof for the pooled s gives a larger U', () => {
  const b = evaluateBudget([
    { method: 'normal', expanded: 45, k: 2 },
    { method: 'rectangular', halfWidth: 15 },
    { method: 'typeA', s: 25, n: 3 },
    { method: 'rectangular', halfWidth: 10 },
    { method: 'rectangular', halfWidth: 10 },
  ]);
  assert.ok(b.k > 2.05, `k = ${b.k}`);
  assert.ok(b.expanded > 60, `U = ${b.expanded}`);
});
