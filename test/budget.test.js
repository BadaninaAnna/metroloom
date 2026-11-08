import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeA, standardUncertainty, evaluateBudget } from '../src/core/budget.js';

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}, got ${actual}`);

test('type A from readings', () => {
  const r = typeA([10.1, 10.3, 9.9, 10.2, 10.0]);
  close(r.mean, 10.1, 1e-12);
  close(r.s, 0.158113883, 1e-9);
  close(r.u, 0.0707106781, 1e-9);
  assert.equal(r.dof, 4);
});

test('type A needs at least two readings', () => {
  assert.throws(() => typeA([1]), RangeError);
});

test('type B divisors', () => {
  close(standardUncertainty({ method: 'rectangular', halfWidth: Math.sqrt(3) }).u, 1, 1e-12);
  close(standardUncertainty({ method: 'triangular', halfWidth: Math.sqrt(6) }).u, 1, 1e-12);
  close(standardUncertainty({ method: 'u-shaped', halfWidth: Math.SQRT2 }).u, 1, 1e-12);
  close(standardUncertainty({ method: 'normal', expanded: 0.045, k: 2 }).u, 0.0225, 1e-12);
  assert.equal(standardUncertainty({ method: 'rectangular', halfWidth: 1 }).dof, Infinity);
});

test('type A from s and n', () => {
  const r = standardUncertainty({ method: 'typeA', s: 0.3, n: 9 });
  close(r.u, 0.1, 1e-12);
  assert.equal(r.dof, 8);
});

test('budget of three unit components with infinite dof', () => {
  const b = evaluateBudget([
    { name: 'a', method: 'standard', u: 1 },
    { name: 'b', method: 'standard', u: 1 },
    { name: 'c', method: 'standard', u: 1 },
  ]);
  close(b.combined, Math.sqrt(3), 1e-12);
  assert.equal(b.effectiveDof, Infinity);
  close(b.k, 2.0, 0.001);
  close(b.expanded, b.k * Math.sqrt(3), 1e-12);
  b.rows.forEach((r) => close(r.share, 1 / 3, 1e-12));
});

test('sensitivity coefficients scale contributions', () => {
  const b = evaluateBudget([
    { method: 'standard', u: 2, sensitivity: -0.5 },
    { method: 'standard', u: 0, sensitivity: 10 },
  ]);
  close(b.rows[0].contribution, 1, 1e-12);
  close(b.combined, 1, 1e-12);
});

test('Welch-Satterthwaite effective degrees of freedom', () => {
  // u1 = 1 (dof 4), u2 = 1 (dof inf): veff = (1 + 1)^2 / (1^4 / 4) = 16
  const b = evaluateBudget([
    { method: 'standard', u: 1, dof: 4 },
    { method: 'standard', u: 1 },
  ]);
  close(b.effectiveDof, 16, 1e-9);
  assert.equal(b.dofForK, 16);
  assert.ok(b.k > 2.13 && b.k < 2.18, `k = ${b.k} should lie between GUM values for nu 20 and 15`);
});

test('non-integer effective dof is truncated before looking up k', () => {
  // veff = (1 + 1)^2 / (1/3 + 1/3) = 6
  const b = evaluateBudget([
    { method: 'standard', u: 1, dof: 3 },
    { method: 'standard', u: 1, dof: 3 },
  ]);
  close(b.effectiveDof, 6, 1e-9);
  const c = evaluateBudget([
    { method: 'standard', u: 1, dof: 3 },
    { method: 'standard', u: 1.1, dof: 3 },
  ]);
  assert.equal(c.dofForK, Math.floor(c.effectiveDof));
});

test('invalid components are rejected', () => {
  assert.throws(() => evaluateBudget([]), RangeError);
  assert.throws(() => evaluateBudget([{ method: 'magic' }]), RangeError);
  assert.throws(() => evaluateBudget([{ method: 'rectangular', halfWidth: -1 }]), RangeError);
  assert.throws(() => evaluateBudget([{ method: 'normal', expanded: 1, k: 0 }]), RangeError);
});
