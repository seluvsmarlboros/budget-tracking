/* Insights — horizontal bars, simple comparisons, export */
import { State } from './state.js';
import { cur } from './app.js';

const PALETTE = ['#10b981', '#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7'];

export function initInsights() {
  render();
  State.subscribe(render);
  window.addEventListener('viewchange', e => { if (e.detail === 'insights') render(); });

  document.getElementById('btn-export-summary').addEventListener('click', exportSummary);
}

function render() {
  const { transactions, user, commute } = State.data;
  const sym = user.currency || '₹';
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Month totals (expenses only)
  const thisMonth = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thisMonthStart)
    .reduce((s, t) => s + t.amount, 0);

  const lastMonth = transactions
    .filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return t.type === 'expense' && d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((s, t) => s + t.amount, 0);

  document.getElementById('ins-this-month').textContent = cur(thisMonth);
  document.getElementById('ins-last-month').textContent = cur(lastMonth);

  const deltaEl = document.getElementById('ins-delta');
  if (lastMonth > 0) {
    const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    deltaEl.textContent = (pct >= 0 ? '↑' : '↓') + Math.abs(pct) + '%';
    deltaEl.className = 'stat-value ' + (pct > 0 ? 'red' : 'green');
  } else {
    deltaEl.textContent = '—';
    deltaEl.className = 'stat-value muted';
  }

  // Category breakdown (this month expenses)
  const byCategory = {};
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thisMonthStart)
    .forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const catTotal = catEntries.reduce((s, [, v]) => s + v, 0) || 1;

  const barEl = document.getElementById('cat-bar');
  const legendEl = document.getElementById('cat-legend');

  if (catEntries.length === 0) {
    barEl.innerHTML = '';
    legendEl.innerHTML = '<span class="muted" style="font-size:13px">No data this month</span>';
  } else {
    barEl.innerHTML = catEntries.map(([cat, amt], i) => {
      const pct = (amt / catTotal) * 100;
      const color = PALETTE[i % PALETTE.length];
      return `<div class="bar-seg" style="width:${pct}%;background:${color}" title="${cat}: ${sym}${amt}"></div>`;
    }).join('');

    legendEl.innerHTML = catEntries.map(([cat, amt], i) => {
      const color = PALETTE[i % PALETTE.length];
      const pct = Math.round((amt / catTotal) * 100);
      return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${cat} ${sym}${amt} (${pct}%)</div>`;
    }).join('');
  }

  // Payment method
  let upi = 0, cash = 0;
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thisMonthStart)
    .forEach(t => { if (t.paymentMethod === 'Cash') cash += t.amount; else upi += t.amount; });
  const methodTotal = upi + cash || 1;
  document.getElementById('ins-upi').textContent = `${sym}${Math.round(upi)} (${Math.round(upi / methodTotal * 100)}%)`;
  document.getElementById('ins-cash').textContent = `${sym}${Math.round(cash)} (${Math.round(cash / methodTotal * 100)}%)`;

  // Travel breakdown
  let fares = 0, fuel = 0, repair = 0;
  (commute.logs || []).forEach(l => {
    const d = new Date(l.date + 'T00:00:00');
    if (d < thisMonthStart) return;
    if (l.type === 'ticket' || l.type === 'pass') fares += l.amount;
    else if (l.type === 'fuel') fuel += l.amount;
    else if (l.type === 'repair') repair += l.amount;
  });
  document.getElementById('ins-fares').textContent = cur(fares);
  document.getElementById('ins-fuel').textContent = cur(fuel);
  document.getElementById('ins-repair').textContent = cur(repair);
}

function exportSummary() {
  const data = JSON.stringify(State.data, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unispend-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  import('./app.js').then(m => m.toast('Backup downloaded'));
}
