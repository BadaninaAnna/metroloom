// Statistical helpers: normal and Student t distributions, coverage factors.
// No dependencies, so the same code runs in the browser and in Node tests.

const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(x) {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }
  const y = x - 1;
  let a = LANCZOS_C[0];
  const t = y + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_C.length; i++) a += LANCZOS_C[i] / (y + i);
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued fraction for the incomplete beta function (Lentz's method).
function betaContinuedFraction(x, a, b) {
  const MAX_ITER = 500;
  const EPS = 1e-15;
  const TINY = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

// Complementary error function with ~1e-14 accuracy:
// Maclaurin series of erf for |x| < 3, continued fraction for erfc beyond.
function erfc(x) {
  const z = Math.abs(x);
  let r;
  if (z < 3) {
    let term = z;
    let sum = z;
    for (let n = 1; n < 200; n++) {
      term *= (-z * z) / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    r = 1 - (2 / Math.sqrt(Math.PI)) * sum;
  } else {
    // erfc(z) = exp(-z^2)/sqrt(pi) * 1/(z + 1/2/(z + 1/(z + 3/2/(z + ...)))), Lentz's method
    const TINY = 1e-300;
    let f = z;
    let c = z;
    let d = 0;
    for (let n = 1; n < 500; n++) {
      const a = n / 2;
      d = z + a * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = z + a / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const delta = c * d;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    r = Math.exp(-z * z) / (Math.sqrt(Math.PI) * f);
  }
  return x >= 0 ? r : 2 - r;
}

/** Standard normal cumulative distribution function. */
export function normalCdf(z) {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Student t cumulative distribution function; nu = Infinity gives the normal CDF. */
export function studentTCdf(t, nu) {
  if (!(nu > 0)) throw new RangeError('Degrees of freedom must be positive');
  if (!Number.isFinite(nu)) return normalCdf(t);
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  const tail = 0.5 * regularizedIncompleteBeta(nu / (nu + t * t), nu / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

function bisect(f, target, lo, hi) {
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

/**
 * Coverage factor k for a two-sided coverage probability p and effective degrees
 * of freedom nu (GUM G.3). Default p = 95.45 %, which gives k = 2 for nu = Infinity.
 */
export function coverageFactor(p = 0.9545, nu = Infinity) {
  if (!(p > 0 && p < 1)) throw new RangeError('Coverage probability must be between 0 and 1');
  if (!(nu > 0)) throw new RangeError('Degrees of freedom must be positive');
  const target = (1 + p) / 2;
  const cdf = (t) => studentTCdf(t, nu);
  let hi = 10;
  while (cdf(hi) < target) hi *= 2;
  return bisect(cdf, target, 0, hi);
}
