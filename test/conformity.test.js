import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessConformity } from '../src/core/conformity.js';

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}, got ${actual}`);

const base = { lower: -0.5, upper: 0.5, expandedUncertainty: 0.2, k: 2 };

test('value well inside tolerance passes', () => {
  const r = assessConformity({ ...base, value: 0 });
  assert.equal(r.statement, 'pass');
  assert.equal(r.inAcceptanceZone, true);
  assert.ok(r.probabilityOfConformance > 0.999999);
  close(r.tur, 2.5, 1e-12);
});

test('value exactly on a limit has 50 % probability of conformance', () => {
  const r = assessConformity({ ...base, value: 0.5 });
  close(r.probabilityOfConformance, 0.5, 1e-6);
  assert.equal(r.statement, 'conditional-pass');
});

test('value just outside the limit within U is a conditional fail', () => {
  const r = assessConformity({ ...base, value: 0.6 });
  assert.equal(r.withinTolerance, false);
  assert.equal(r.statement, 'conditional-fail');
  close(r.probabilityOfConformance, 0.158655, 1e-5); // P(Z < -1)
});

test('value far outside fails', () => {
  const r = assessConformity({ ...base, value: 0.8 });
  assert.equal(r.statement, 'fail');
});

test('guard band w = U shrinks the acceptance zone', () => {
  const simple = assessConformity({ ...base, value: 0.4 });
  const guarded = assessConformity({ ...base, value: 0.4, guardBand: 0.2 });
  assert.equal(simple.inAcceptanceZone, true);
  assert.equal(guarded.inAcceptanceZone, false);
  close(guarded.acceptanceZone.upper, 0.3, 1e-12);
});

test('one-sided upper limit', () => {
  const r = assessConformity({ value: 10, upper: 12, expandedUncertainty: 1, k: 2 });
  assert.equal(r.tur, null);
  close(r.probabilityOfConformance, 0.999968, 1e-5); // P(Z < 4)
  assert.equal(r.statement, 'pass');
});

test('zero uncertainty gives a certain answer', () => {
  assert.equal(assessConformity({ ...base, value: 0.4, expandedUncertainty: 0 }).probabilityOfConformance, 1);
  assert.equal(assessConformity({ ...base, value: 0.6, expandedUncertainty: 0 }).probabilityOfConformance, 0);
});

test('invalid input is rejected', () => {
  assert.throws(() => assessConformity({ value: 0, expandedUncertainty: 0.1 }), RangeError);
  assert.throws(() => assessConformity({ ...base, value: 0, lower: 1, upper: 0 }), RangeError);
  assert.throws(() => assessConformity({ ...base, value: 0, guardBand: 0.6 }), RangeError);
  assert.throws(() => assessConformity({ ...base, value: 0, expandedUncertainty: -1 }), RangeError);
});
