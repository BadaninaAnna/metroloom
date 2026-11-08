// Metroloom page logic: uncertainty budget table and conformity assessment.
import { evaluateBudget, standardUncertainty } from '../core/budget.js';
import { assessConformity } from '../core/conformity.js';
import { EXAMPLES } from './examples.js';
import { CONFIG } from './config.js';
import { initAnalytics, track } from './analytics.js';
import { parseNum, isBlank, parseReadings, sig, plain, reportU, pct, escapeHtml as esc } from './format.js';

const METHODS = {
  normal: { label: 'Normal — certificate (U, k)', fields: [['expanded', 'U'], ['k', 'k']] },
  rectangular: { label: 'Rectangular (± a)', fields: [['halfWidth', 'a (half-width)']] },
  triangular: { label: 'Triangular (± a)', fields: [['halfWidth', 'a (half-width)']] },
  'u-shaped': { label: 'U-shaped (± a)', fields: [['halfWidth', 'a (half-width)']] },
  typeA: { label: 'Type A — readings', fields: [['readings', 'Readings (space or new line)', 'textarea']] },
  typeAPooled: { label: 'Type A — pooled s', fields: [['s', 's'], ['n', 'n averaged'], ['dof', 'ν of s']] },
  standard: { label: 'Standard uncertainty u', fields: [['u', 'u']] },
};
const OWN_DOF = new Set(['typeA', 'typeAPooled']);
const RULES = {
  simple: 'Simple acceptance (w = 0)',
  guarded: 'Guarded acceptance (w = U)',
  custom: 'Custom guard band',
};
const STATEMENTS = {
  pass: ['Pass', 'The measured value and its whole uncertainty interval (± U) lie within the tolerance.'],
  'conditional-pass': ['Conditional pass', 'The measured value is within the tolerance, but the uncertainty interval crosses a limit.'],
  'conditional-fail': ['Conditional fail', 'The measured value is outside the tolerance, but the uncertainty interval reaches into it.'],
  fail: ['Fail', 'The measured value and its whole uncertainty interval lie outside the tolerance.'],
};
const STORAGE_KEY = 'metroloom:v1';

const $ = (id) => document.getElementById(id);
const tbody = $('budget-rows');
let nextId = 1;
let lastBudget = null;
let state = loadState() ?? stateFromExample(EXAMPLES[0]);

/* ---------------- state ---------------- */

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function newRow(r = {}) {
  return {
    id: nextId++,
    name: r.name ?? '',
    method: METHODS[r.method] ? r.method : 'rectangular',
    fields: { ...(r.fields ?? {}) },
    sensitivity: r.sensitivity ?? '1',
    dof: r.dof ?? '',
  };
}

function stateFromExample(ex) {
  return {
    measurand: ex.measurand ?? '',
    unit: ex.unit ?? '',
    coverage: '0.9545',
    rows: ex.rows.map(newRow),
    conformity: {
      value: ex.conformity?.value ?? '',
      lower: ex.conformity?.lower ?? '',
      upper: ex.conformity?.upper ?? '',
      U: '',
      k: '2',
      rule: 'simple',
      w: '',
      fromBudget: true,
    },
    verdict: { decision: '', name: '', date: today(), comment: '' },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.rows)) return null;
    const fresh = stateFromExample({ rows: [] });
    return {
      ...fresh,
      ...s,
      rows: s.rows.map(newRow),
      conformity: { ...fresh.conformity, ...s.conformity },
      verdict: { ...fresh.verdict, ...s.verdict },
    };
  } catch {
    return null;
  }
}

let saveTimer;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: the page still works without it */
    }
  }, 300);
}

/* ---------------- budget table ---------------- */

function methodOptions(selected) {
  return Object.entries(METHODS)
    .map(([key, m]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${m.label}</option>`)
    .join('');
}

function rowHtml(r) {
  const fields = METHODS[r.method].fields
    .map(([key, label, kind]) =>
      kind === 'textarea'
        ? `<label class="wide">${label}<textarea data-field="${key}" rows="2" spellcheck="false">${esc(r.fields[key] ?? '')}</textarea></label>`
        : `<label>${label}<input type="text" inputmode="decimal" data-field="${key}" value="${esc(r.fields[key] ?? '')}"></label>`,
    )
    .join('');
  const dofCell = OWN_DOF.has(r.method)
    ? '<span class="dof-auto" data-out="dof">—</span>'
    : `<input type="text" inputmode="decimal" data-prop="dof" value="${esc(r.dof)}" placeholder="∞" aria-label="Degrees of freedom">`;
  return `<tr data-id="${r.id}">
    <td class="col-name"><input type="text" data-prop="name" value="${esc(r.name)}" placeholder="Component" aria-label="Component name"></td>
    <td class="col-method"><select data-prop="method" aria-label="Evaluation method">${methodOptions(r.method)}</select></td>
    <td class="col-input"><div class="fields">${fields}</div><div class="row-error" data-out="error"></div></td>
    <td class="col-c"><input type="text" inputmode="decimal" data-prop="sensitivity" value="${esc(r.sensitivity)}" aria-label="Sensitivity coefficient"></td>
    <td class="col-dof">${dofCell}</td>
    <td class="num" data-out="u">—</td>
    <td class="num" data-out="contribution">—</td>
    <td class="num" data-out="share">—</td>
    <td class="no-print"><button type="button" class="btn icon" data-action="remove" aria-label="Remove component">×</button></td>
  </tr>`;
}

function renderRows() {
  tbody.innerHTML = state.rows.map(rowHtml).join('');
}

function rowById(id) {
  return state.rows.find((r) => r.id === id);
}

/** Convert a table row into an engine component, collecting readable errors. */
function toComponent(r) {
  const errors = [];
  const num = (key, label) => {
    const raw = r.fields[key];
    if (isBlank(raw)) {
      errors.push(`${label} is required`);
      return NaN;
    }
    const v = parseNum(raw);
    if (Number.isNaN(v)) errors.push(`${label} is not a number`);
    return v;
  };
  let c;
  switch (r.method) {
    case 'normal':
      c = { method: 'normal', expanded: num('expanded', 'U'), k: num('k', 'k') };
      break;
    case 'rectangular':
    case 'triangular':
    case 'u-shaped':
      c = { method: r.method, halfWidth: num('halfWidth', 'a') };
      break;
    case 'typeA': {
      const readings = parseReadings(r.fields.readings);
      if (readings.some(Number.isNaN)) errors.push('Readings contain a value that is not a number');
      else if (readings.length < 2) errors.push('Enter at least 2 readings');
      c = { method: 'typeA', readings };
      break;
    }
    case 'typeAPooled': {
      c = { method: 'typeA', s: num('s', 's'), n: num('n', 'n') };
      if (!isBlank(r.fields.dof)) {
        const d = parseNum(r.fields.dof);
        if (Number.isNaN(d)) errors.push('ν of s is not a number');
        else c.dof = d;
      }
      break;
    }
    default:
      c = { method: 'standard', u: num('u', 'u') };
  }
  if (!OWN_DOF.has(r.method) && !isBlank(r.dof)) {
    const d = parseNum(r.dof);
    if (Number.isNaN(d)) errors.push('ν is not a number');
    else c.dof = d;
  }
  const sens = isBlank(r.sensitivity) ? 1 : parseNum(r.sensitivity);
  if (Number.isNaN(sens)) errors.push('Sensitivity coefficient is not a number');
  c.sensitivity = sens;
  c.name = r.name || undefined;
  if (errors.length === 0) {
    try {
      const { u, dof } = standardUncertainty(c);
      return { component: c, u, dof };
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { errors };
}

function setOut(tr, key, text) {
  const el = tr.querySelector(`[data-out="${key}"]`);
  if (el) el.textContent = text;
}

function fmtDof(d) {
  if (!Number.isFinite(d)) return '∞';
  return Number.isInteger(d) ? String(d) : d.toFixed(1);
}

function fmtEffectiveDof(d) {
  if (!Number.isFinite(d)) return '∞';
  if (d >= 1000) return String(Math.floor(d));
  return d.toFixed(1);
}

function recomputeBudget() {
  const results = state.rows.map(toComponent);
  const hasErrors = results.some((r) => r.errors);
  let budget = null;
  let error = '';
  if (state.rows.length === 0) error = 'Add at least one component.';
  else if (!hasErrors) {
    try {
      budget = evaluateBudget(results.map((r) => r.component), { coverageProbability: Number(state.coverage) });
    } catch (e) {
      error = e.message;
    }
  }

  state.rows.forEach((row, i) => {
    const tr = tbody.querySelector(`tr[data-id="${row.id}"]`);
    if (!tr) return;
    const res = results[i];
    const brow = budget?.rows[i];
    setOut(tr, 'error', res.errors ? `${res.errors.join('. ')}.` : '');
    setOut(tr, 'u', res.errors ? '—' : sig(res.u));
    setOut(tr, 'contribution', brow ? sig(brow.contribution) : '—');
    setOut(tr, 'share', brow ? pct(brow.share) : '—');
    setOut(tr, 'dof', res.errors ? '—' : fmtDof(res.dof));
    tr.querySelectorAll('input[data-field], textarea[data-field], input[data-prop="sensitivity"], input[data-prop="dof"]').forEach((el) => {
      const raw = el.value;
      let bad = false;
      if (el.tagName === 'TEXTAREA') bad = !isBlank(raw) && parseReadings(raw).some(Number.isNaN);
      else bad = !isBlank(raw) && Number.isNaN(parseNum(raw));
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    });
  });

  lastBudget = budget;
  renderBudgetResults(budget, hasErrors ? 'Correct the components marked in red to see the result.' : error);
  renderContrib(budget);

  if (budget && state.conformity.fromBudget) fillConformityFromBudget(false);
}

function renderBudgetResults(b, error) {
  const out = $('budget-results');
  if (!b) {
    out.innerHTML = `<div class="notice error">${esc(error || 'No result yet.')}</div>`;
    return;
  }
  const unit = state.unit ? ` ${esc(state.unit)}` : '';
  const p = Number(state.coverage) * 100;
  out.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="k-label">Combined standard uncertainty u<sub>c</sub></div><div class="k-value">${sig(b.combined)}${unit}</div></div>
      <div class="kpi"><div class="k-label">Effective degrees of freedom ν<sub>eff</sub></div><div class="k-value">${fmtEffectiveDof(b.effectiveDof)}</div></div>
      <div class="kpi"><div class="k-label">Coverage factor k (p = ${p} %)</div><div class="k-value">${b.k.toFixed(2)}</div></div>
      <div class="kpi main"><div class="k-label">Expanded uncertainty U</div><div class="k-value">${sig(b.expanded)}${unit}</div></div>
    </div>
    <p class="reported">Reported: <strong>U = ${reportU(b.expanded)}${unit}</strong>
      <span class="muted">(k = ${b.k.toFixed(2)}, coverage probability ${p} %, rounded to two significant digits)</span></p>
    ${Number.isFinite(b.effectiveDof) && b.dofForK < 1000 ? `<p class="muted small">k is taken from the t-distribution with ν = ${b.dofForK} (ν<sub>eff</sub> rounded down, EA-4/02 E.2).</p>` : ''}`;
}

function renderContrib(b) {
  const out = $('contrib-chart');
  if (!b || b.rows.length < 2) {
    out.innerHTML = '';
    return;
  }
  const rows = b.rows
    .map((r, i) => ({ name: r.name || `Component ${i + 1}`, share: r.share }))
    .sort((a, c) => c.share - a.share);
  out.innerHTML = `<h3>Contribution to the combined variance</h3>${rows
    .map(
      (r) => `<div class="bar-row"><span class="bar-label" title="${esc(r.name)}">${esc(r.name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(r.share * 100).toFixed(2)}%"></span></span>
        <span class="bar-pct">${(r.share * 100).toFixed(1)}%</span></div>`,
    )
    .join('')}`;
}

/* ---------------- conformity ---------------- */

function fillConformityFromBudget(fromClick) {
  if (!lastBudget) return;
  state.conformity.U = reportU(lastBudget.expanded);
  state.conformity.k = lastBudget.k.toFixed(2);
  if (fromClick) state.conformity.fromBudget = true;
  $('c-U').value = state.conformity.U;
  $('c-k').value = state.conformity.k;
  recomputeConformity();
}

function readLimit(raw, fallback) {
  return isBlank(raw) ? fallback : parseNum(raw);
}

function recomputeConformity() {
  const c = state.conformity;
  const chart = $('conformity-chart');
  const out = $('conformity-results');
  $('c-w-wrap').hidden = c.rule !== 'custom';

  const fields = { 'c-value': c.value, 'c-lower': c.lower, 'c-upper': c.upper, 'c-U': c.U, 'c-k': c.k, 'c-w': c.w };
  for (const [id, raw] of Object.entries(fields)) {
    $(id).setAttribute('aria-invalid', !isBlank(raw) && Number.isNaN(parseNum(raw)) ? 'true' : 'false');
  }

  if (isBlank(c.value) || isBlank(c.U) || (isBlank(c.lower) && isBlank(c.upper))) {
    chart.innerHTML = '';
    out.innerHTML = '<div class="notice info">Enter the measured value, at least one tolerance limit and the expanded uncertainty U.</div>';
    return;
  }

  const value = parseNum(c.value);
  const lower = readLimit(c.lower, -Infinity);
  const upper = readLimit(c.upper, Infinity);
  const U = parseNum(c.U);
  const k = isBlank(c.k) ? 2 : parseNum(c.k);
  const w = c.rule === 'simple' ? 0 : c.rule === 'guarded' ? U : parseNum(c.w);

  let res;
  try {
    if ([value, lower, upper, U, k, w].some(Number.isNaN)) throw new Error('Some inputs are not numbers.');
    if (c.rule === 'custom' && isBlank(c.w)) throw new Error('Enter the guard band w.');
    res = assessConformity({ value, lower, upper, expandedUncertainty: U, k, guardBand: w });
  } catch (e) {
    chart.innerHTML = '';
    out.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
    return;
  }

  chart.innerHTML = chartSvg({ value, lower, upper, U, w, acc: res.acceptanceZone });
  const unit = state.unit ? ` ${esc(state.unit)}` : '';
  const [title, text] = STATEMENTS[res.statement];
  const ruleText = c.rule === 'custom' ? `Custom guard band (w = ${plain(w)}${unit})` : c.rule === 'guarded' ? `Guarded acceptance (w = U = ${plain(U)}${unit})` : RULES.simple;
  const zone = `[${plain(res.acceptanceZone.lower)}; ${plain(res.acceptanceZone.upper)}]${unit}`;
  const turHint = res.tur !== null && res.tur < 4 ? ' <span class="hint">below the commonly recommended 4 : 1</span>' : '';
  out.innerHTML = `
    <div class="statement ${res.statement}"><strong>${title}</strong>${text}
      <div class="muted small">Statement according to ILAC G8:09/2019, using the interval value ± U.</div></div>
    <ul class="facts">
      <li><span class="f-label">Decision rule</span><span>${ruleText}</span></li>
      <li><span class="f-label">Acceptance zone</span><span class="f-value">${zone}</span></li>
      <li><span class="f-label">With this rule, the measured value is</span><span><strong>${res.inAcceptanceZone ? 'inside' : 'outside'}</strong> the acceptance zone</span></li>
      <li><span class="f-label">Probability of conformance</span><span class="f-value">${pct(res.probabilityOfConformance, 2)}</span></li>
      <li><span class="f-label">Standard uncertainty u = U / k</span><span class="f-value">${sig(res.standardUncertainty)}${unit}</span></li>
      ${res.tur !== null ? `<li><span class="f-label">Test uncertainty ratio (TUR)</span><span><span class="f-value">${res.tur.toFixed(1)} : 1</span>${turHint}</span></li>` : ''}
    </ul>`;
}

function chartSvg({ value, lower, upper, U, w, acc }) {
  // Draw at the container's real width so labels keep their size on phones.
  const W = Math.round(Math.max(320, Math.min(720, $('conformity-chart').clientWidth || 720)));
  const H = 150;
  const pad = 24;
  const finite = [value - U, value + U, lower, upper].filter(Number.isFinite);
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  let span = max - min || Math.abs(value) || 1;
  if (!Number.isFinite(lower)) min -= span * 0.5;
  if (!Number.isFinite(upper)) max += span * 0.5;
  span = max - min || 1;
  min -= span * 0.12;
  max += span * 0.12;
  const x = (v) => pad + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (W - 2 * pad);
  const top = 38;
  const bottom = 112;
  const lo = Number.isFinite(lower) ? lower : min;
  const hi = Number.isFinite(upper) ? upper : max;
  const parts = [];
  const rect = (a, b, cls) => {
    if (b > a) parts.push(`<rect class="${cls}" x="${x(a)}" y="${top}" width="${x(b) - x(a)}" height="${bottom - top}"/>`);
  };
  rect(min, lo, 'zone-out');
  rect(hi, max, 'zone-out');
  rect(lo, hi, 'zone-ok');
  if (w > 0) {
    if (Number.isFinite(lower)) rect(lower, acc.lower, 'zone-guard');
    if (Number.isFinite(upper)) rect(acc.upper, upper, 'zone-guard');
  }
  parts.push(`<line class="axis" x1="${pad}" x2="${W - pad}" y1="${bottom}" y2="${bottom}"/>`);
  const limit = (v, label, anchor) => {
    parts.push(`<line class="limit" x1="${x(v)}" x2="${x(v)}" y1="${top - 6}" y2="${bottom + 4}"/>`);
    parts.push(`<text class="strong" x="${x(v)}" y="${top - 12}" text-anchor="${anchor}">${label} ${plain(v)}</text>`);
  };
  if (Number.isFinite(lower)) limit(lower, 'Lower limit', 'middle');
  if (Number.isFinite(upper)) limit(upper, 'Upper limit', 'middle');
  if (w > 0) {
    const alimit = (v) => {
      parts.push(`<line class="alimit" x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${bottom}"/>`);
      parts.push(`<text x="${x(v)}" y="${bottom + 18}" text-anchor="middle">acceptance ${plain(v)}</text>`);
    };
    if (Number.isFinite(lower)) alimit(acc.lower);
    if (Number.isFinite(upper)) alimit(acc.upper);
  }
  const yb = 76;
  const x1 = x(value - U);
  const x2 = x(value + U);
  parts.push(`<line class="ubar" x1="${x1}" x2="${x2}" y1="${yb}" y2="${yb}"/>`);
  parts.push(`<line class="ubar" x1="${x1}" x2="${x1}" y1="${yb - 8}" y2="${yb + 8}"/>`);
  parts.push(`<line class="ubar" x1="${x2}" x2="${x2}" y1="${yb - 8}" y2="${yb + 8}"/>`);
  parts.push(`<circle class="point" cx="${x(value)}" cy="${yb}" r="6"/>`);
  parts.push(`<text class="strong" x="${x(value)}" y="${yb - 14}" text-anchor="middle">${plain(value)} ± ${plain(U)}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Measured value with expanded uncertainty relative to the tolerance limits">${parts.join('')}</svg>`;
}

/* ---------------- wiring ---------------- */

function syncStaticInputs() {
  $('measurand').value = state.measurand;
  $('unit').value = state.unit;
  $('coverage').value = state.coverage;
  const c = state.conformity;
  $('c-value').value = c.value;
  $('c-lower').value = c.lower;
  $('c-upper').value = c.upper;
  $('c-U').value = c.U;
  $('c-k').value = c.k;
  $('c-rule').value = c.rule;
  $('c-w').value = c.w;
  const v = state.verdict;
  document.querySelectorAll('input[name="decision"]').forEach((el) => {
    el.checked = el.value === v.decision;
  });
  $('v-name').value = v.name;
  $('v-date').value = v.date;
  $('v-comment').value = v.comment;
}

function renderAll() {
  syncStaticInputs();
  renderRows();
  recomputeBudget();
  recomputeConformity();
}

tbody.addEventListener('input', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const row = rowById(Number(tr.dataset.id));
  const { prop, field } = e.target.dataset;
  if (field) row.fields[field] = e.target.value;
  else if (prop === 'method') {
    row.method = e.target.value;
    tr.outerHTML = rowHtml(row);
  } else if (prop) row[prop] = e.target.value;
  recomputeBudget();
  if (lastBudget) track('budget-calculated', { once: true });
  saveState();
});

tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="remove"]');
  if (!btn) return;
  const id = Number(btn.closest('tr').dataset.id);
  state.rows = state.rows.filter((r) => r.id !== id);
  renderRows();
  recomputeBudget();
  saveState();
});

$('add-row').addEventListener('click', () => {
  const row = newRow({ method: 'rectangular' });
  state.rows.push(row);
  tbody.insertAdjacentHTML('beforeend', rowHtml(row));
  recomputeBudget();
  saveState();
  tbody.querySelector(`tr[data-id="${row.id}"] input[data-prop="name"]`).focus();
});

for (const [id, key] of [['measurand', 'measurand'], ['unit', 'unit'], ['coverage', 'coverage']]) {
  $(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    recomputeBudget();
    recomputeConformity();
    saveState();
  });
}

for (const [id, key] of [['c-value', 'value'], ['c-lower', 'lower'], ['c-upper', 'upper'], ['c-U', 'U'], ['c-k', 'k'], ['c-rule', 'rule'], ['c-w', 'w']]) {
  $(id).addEventListener('input', (e) => {
    state.conformity[key] = e.target.value;
    if (key === 'U' || key === 'k') state.conformity.fromBudget = false;
    recomputeConformity();
    if ($('conformity-results').querySelector('.statement')) track('conformity-assessed', { once: true });
    saveState();
  });
}

$('use-budget').addEventListener('click', () => {
  fillConformityFromBudget(true);
  saveState();
});

document.querySelectorAll('input[name="decision"]').forEach((el) =>
  el.addEventListener('change', () => {
    state.verdict.decision = el.value;
    saveState();
  }),
);
for (const [id, key] of [['v-name', 'name'], ['v-date', 'date'], ['v-comment', 'comment']]) {
  $(id).addEventListener('input', (e) => {
    state.verdict[key] = e.target.value;
    saveState();
  });
}

const exampleSelect = $('example-select');
exampleSelect.insertAdjacentHTML('beforeend', EXAMPLES.map((ex) => `<option value="${ex.id}">${esc(ex.title)}</option>`).join(''));
exampleSelect.addEventListener('change', () => {
  const ex = EXAMPLES.find((x) => x.id === exampleSelect.value);
  exampleSelect.value = '';
  if (!ex) return;
  const hasWork = state.rows.some((r) => r.name || Object.values(r.fields).some((v) => !isBlank(v)));
  if (hasWork && !window.confirm('Replace the current budget with this example?')) return;
  state = stateFromExample(ex);
  renderAll();
  saveState();
  track(`example-${ex.id}`);
});

$('clear-btn').addEventListener('click', () => {
  if (!window.confirm('Clear the budget and the conformity inputs?')) return;
  state = stateFromExample({ rows: [{}] });
  state.conformity.fromBudget = false;
  renderAll();
  saveState();
});

$('print-btn').addEventListener('click', () => {
  const title = state.measurand ? `<strong>${esc(state.measurand)}</strong><br>` : '';
  $('print-meta').innerHTML = `${title}Report printed ${new Date().toLocaleString()} · calculated with Metroloom (metroloom.net)`;
  track('report-printed');
  window.print();
});

// Optional feedback and waitlist forms (configured in config.js).
function setupLink(id, url, event) {
  const a = $(id);
  if (!url) return false;
  a.href = url;
  a.hidden = false;
  a.addEventListener('click', () => track(event));
  return true;
}
setupLink('feedback-link', CONFIG.feedbackFormUrl, 'feedback-clicked');
if (!setupLink('waitlist-link', CONFIG.waitlistFormUrl, 'waitlist-clicked')) {
  $('waitlist-note').textContent = 'The waitlist opens soon.';
}
initAnalytics();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(recomputeConformity, 150);
});

renderAll();
