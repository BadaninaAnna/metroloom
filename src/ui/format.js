// Parsing and formatting helpers for the UI.

/** Parse a user-typed number; accepts decimal comma and scientific notation. NaN if invalid/empty. */
export function parseNum(raw) {
  if (raw === null || raw === undefined) return NaN;
  const t = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (t === '') return NaN;
  if (/^[+-]?(inf|infinity|∞)$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

export const isBlank = (raw) => raw === null || raw === undefined || String(raw).trim() === '';

/** Readings separated by spaces, new lines or semicolons (a comma is a decimal comma). */
export function parseReadings(raw) {
  const parts = String(raw ?? '').split(/[\s;]+/).filter(Boolean);
  return parts.map(parseNum);
}

/** Number with n significant digits, without exponent for "normal" magnitudes. */
export function sig(x, n = 4) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const abs = Math.abs(x);
  if (abs >= 1e-4 && abs < 1e7) {
    const decimals = Math.max(0, n - 1 - Math.floor(Math.log10(abs)));
    return minus(x.toFixed(Math.min(decimals, 12)));
  }
  return minus(x.toPrecision(n)).replace('e', '·10^');
}

/** A user-entered number shown as short as possible (no padding zeros). */
export function plain(x) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  return minus(String(Number(x.toPrecision(10))));
}

/** Round to 2 significant digits as recommended for reporting U (GUM 7.2.6). */
export function reportU(x) {
  if (!Number.isFinite(x) || x <= 0) return sig(x);
  const decimals = Math.max(0, 1 - Math.floor(Math.log10(x)));
  if (x >= 1e-4 && x < 1e7) return x.toFixed(Math.min(decimals, 12));
  return x.toPrecision(2);
}

export function pct(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)} %`;
}

function minus(s) {
  return s.replace(/^-/, '−');
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
