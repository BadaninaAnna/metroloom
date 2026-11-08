// Cookie-free usage statistics with GoatCounter. Only event names are sent —
// never any value typed into the calculator.
import { CONFIG } from './config.js';

const sent = new Set();
let ready = false;
const queue = [];

export function initAnalytics() {
  const code = CONFIG.goatcounterCode;
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if (!code || local) return;
  window.goatcounter = { no_onload: false };
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  s.onload = () => {
    ready = true;
    queue.splice(0).forEach(send);
  };
  document.head.appendChild(s);
}

function send(name) {
  try {
    window.goatcounter?.count?.({ path: name, title: name, event: true });
  } catch {
    /* statistics must never break the page */
  }
}

/** Count an event; with `once` it is counted at most once per page view. */
export function track(name, { once = false } = {}) {
  if (once) {
    if (sent.has(name)) return;
    sent.add(name);
  }
  if (!CONFIG.goatcounterCode) return;
  if (ready) send(name);
  else queue.push(name);
}
