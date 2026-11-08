import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, studentTCdf, coverageFactor } from '../src/core/stats.js';

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}, got ${actual}`);

test('normal CDF matches known quantiles', () => {
  close(normalCdf(0), 0.5, 1e-9);
  close(normalCdf(1.959964), 0.975, 1e-6);
  close(normalCdf(-1.959964), 0.025, 1e-6);
  assert.equal(normalCdf(Infinity), 1);
  assert.equal(normalCdf(-Infinity), 0);
});

test('Student t CDF matches known quantiles', () => {
  close(studentTCdf(2.228139, 10), 0.975, 1e-6);
  close(studentTCdf(12.706205, 1), 0.975, 1e-6);
  close(studentTCdf(0, 7), 0.5, 1e-12);
  close(studentTCdf(-2.570582, 5), 0.025, 1e-6);
});

// GUM (JCGM 100:2008) table G.2, column p = 95.45 %.
const GUM_G2 = [
  [1, 13.97], [2, 4.53], [3, 3.31], [4, 2.87], [5, 2.65], [6, 2.52], [7, 2.43],
  [8, 2.37], [9, 2.32], [10, 2.28], [20, 2.13], [50, 2.05], [Infinity, 2.0],
];

for (const [nu, k] of GUM_G2) {
  test(`coverage factor for nu = ${nu} matches GUM table G.2 (k = ${k})`, () => {
    close(coverageFactor(0.9545, nu), k, 0.005);
  });
}

test('coverage factor for 95 % and infinite dof is 1.96', () => {
  close(coverageFactor(0.95, Infinity), 1.96, 0.001);
});

test('coverage factor rejects invalid input', () => {
  assert.throws(() => coverageFactor(1.2, 5), RangeError);
  assert.throws(() => coverageFactor(0.95, 0), RangeError);
});
