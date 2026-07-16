/* Activity — unified feed replacing commute, friends, calendar, wallet */
import { State } from './state.js';
import { toast, cur, fmtDate } from './app.js';
import { showSplitQR } from './qr.js';

let activeFilter = 'all';

export function initActivity() {
  render();
  State.subscribe(render);
  window.addEventListener('viewchange', e => { if (e.detail === 'activity') render(); });

  // Filters
  document.getElementById('filter-row').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    activeFilter = pill.dataset.filter;
    document.querySelectorAll('#filter-row .pill').forEach(p => p.classList.toggle('active', p === pill));
    renderFeed();
  });

  // Friend dialog
  const friendDialog = document.getElementById('dialog-friend');
  document.getElementById('btn-add-friend-activity').addEventListener('click', () => friendDialog.showModal());
  document.getElementById('close-friend-dialog').addEventListener('click', () => friendDialog.close());
  document.getElementById('form-friend').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('inp-friend-name').value.trim();
    if (State.addFriend(name)) {
      toast(`Added ${name}`);
      document.getElementById('inp-friend-name').value = '';
      friendDialog.close();
    } else {
      toast('Friend already exists');
    }
  });

  // Settle dialog
  const settleDialog = document.getElementById('dialog-settle');
  document.getElementById('close-settle-dialog').addEventListener('click', () => settleDialog.close());
  document.getElementById('form-settle').addEventListener('submit', e => {
    e.preventDefault();
    const friend = document.getElementById('settle-friend').value;
    const amt = document.getElementById('settle-amount').value;
    if (!friend || !amt) return;
    State.settleUp(friend, amt, 'UPI');
    toast(`Settled with ${friend}`);
    settleDialog.close();
  });

  // Spike dialog
  const spikeDialog = document.getElementById('dialog-spike');
  const openSpike = () => {
    document.getElementById('spk-date').valueAsDate = new Date(Date.now() + 14 * 864e5);
    spikeDialog.showModal();
  };
  document.getElementById('btn-add-spike')?.addEventListener('click', openSpike);
  document.getElementById('btn-add-spike-empty')?.addEventListener('click', openSpike);
  document.getElementById('close-spike-dialog').addEventListener('click', () => spikeDialog.close());
  document.getElementById('form-spike').addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('spk-title').value.trim();
    const amount = document.getElementById('spk-amount').value;
    const date = document.getElementById('spk-date').value;
    if (!title || !amount || !date) return;
    State.addSpike({ title, amount, date });
    toast('Spike added');
    spikeDialog.close();
    document.getElementById('form-spike').reset();
  });

  // Group split dialog
  const groupDialog = document.getElementById('dialog-group');
  document.getElementById('btn-group-split').addEventListener('click', () => {
    populateGroupMembers();
    groupDialog.showModal();
  });
  document.getElementById('close-group-dialog').addEventListener('click', () => groupDialog.close());
  document.getElementById('form-group').addEventListener('submit', e => {
    e.preventDefault();
    const amount = document.getElementById('grp-amount').value;
    const desc = document.getElementById('grp-desc').value.trim();
    const checked = [...document.querySelectorAll('#grp-members input:checked')].map(i => i.value);
    if (!amount || !desc || checked.length < 2) { toast('Select at least 2 members'); return; }
    State.addGroupSplit(amount, desc, checked);
    toast('Group split logged');
    groupDialog.close();
    document.getElementById('form-group').reset();
  });

  // Live hint for group split
  document.getElementById('grp-amount').addEventListener('input', updateGroupHint);
  document.getElementById('grp-members').addEventListener('change', updateGroupHint);

  // Delegate settle & QR payment request buttons
  document.getElementById('balances-list').addEventListener('click', e => {
    const settleBtn = e.target.closest('[data-settle]');
    const qrBtn = e.target.closest('[data-qr-pay]');

    if (settleBtn) {
      const friend = settleBtn.dataset.settle;
      const bal = State.data.friends.balances[friend] || 0;
      document.getElementById('settle-friend').value = friend;
      document.getElementById('settle-amount').value = Math.abs(bal);
      document.getElementById('settle-desc').textContent =
        bal > 0 ? `${friend} owes you ${cur(bal)}` : `You owe ${friend} ${cur(Math.abs(bal))}`;
      settleDialog.showModal();
    }

    if (qrBtn) {
      const friend = qrBtn.dataset.qrPay;
      const amount = qrBtn.dataset.amount;
      showSplitQR(friend, amount);
    }
  });

  // Equalize Dialog triggers
  const equalizeDialog = document.getElementById('dialog-equalize');
  document.getElementById('btn-equalize').addEventListener('click', () => {
    showEqualizedDebts();
  });
  document.getElementById('close-equalize-dialog').addEventListener('click', () => {
    equalizeDialog.close();
  });
}

function render() {
  renderBalances();
  renderSpike();
  renderFeed();
}

function renderBalances() {
  const { friends } = State.data;
  const list = document.getElementById('balances-list');
  const count = document.getElementById('balance-count');
  const active = friends.list.filter(f => (friends.balances[f] || 0) !== 0);
  count.textContent = active.length;

  if (friends.list.length === 0) {
    list.innerHTML = '<p class="empty-state">No friends added yet</p>';
    return;
  }

  list.innerHTML = friends.list.map(f => {
    const bal = friends.balances[f] || 0;
    const cls = bal > 0 ? 'green' : bal < 0 ? 'red' : 'muted';
    const label = bal > 0 ? `owes you ${cur(bal)}` : bal < 0 ? `you owe ${cur(Math.abs(bal))}` : 'settled';
    return `<div class="bal-item">
      <span class="bal-name">${f}</span>
      <div class="bal-right">
        <span class="bal-amount ${cls}">${label}</span>
        ${bal !== 0 ? `<button class="btn-ghost btn-sm" data-settle="${f}">Settle</button>` : ''}
        ${bal > 0 ? `<button class="btn-ghost btn-sm" data-qr-pay="${f}" data-amount="${bal}" title="Show pay QR">QR</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderSpike() {
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = State.data.spikes.filter(s => new Date(s.date + 'T00:00:00') >= today);
  const el = document.getElementById('activity-spike');
  const noRow = document.getElementById('no-spike-row');

  if (upcoming.length > 0) {
    const s = upcoming[0];
    const days = Math.ceil((new Date(s.date + 'T00:00:00') - today) / 864e5);
    document.getElementById('act-spike-title').textContent = s.title;
    document.getElementById('act-spike-meta').textContent = `in ${days}d`;
    document.getElementById('act-spike-amount').textContent = cur(s.amount);
    el.style.display = '';
    noRow.style.display = 'none';
  } else {
    el.style.display = 'none';
    noRow.style.display = '';
  }
}

function renderFeed() {
  const { transactions, friends } = State.data;
  const sym = State.data.user.currency || '₹';
  const container = document.getElementById('activity-feed');

  // Build unified entries
  let entries = [];

  // Transactions
  transactions.forEach(t => {
    let tag = t.type;
    if (t.category === 'Travel') tag = 'commute';
    if (t.description && (t.description.includes('split') || t.description.includes('Settle') || t.description.includes('Borrowed'))) tag = 'split';
    entries.push({ ...t, tag, sortDate: t.date });
  });

  // IOU history entries that may not have transaction counterparts (optional: show settlement entries)
  // Already covered via transactions — no need to double-show

  // Filter
  if (activeFilter !== 'all') {
    entries = entries.filter(e => {
      if (activeFilter === 'expense') return e.type === 'expense' && e.tag !== 'commute' && e.tag !== 'split';
      if (activeFilter === 'commute') return e.tag === 'commute';
      if (activeFilter === 'split') return e.tag === 'split';
      if (activeFilter === 'income') return e.type === 'income';
      return true;
    });
  }

  // Sort by date desc
  entries.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No activity yet</p>';
    return;
  }

  // Group by date
  const groups = {};
  entries.forEach(e => {
    const key = e.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  let html = '';
  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
    html += `<div class="feed-date-header muted" style="font-size:12px;font-weight:600;padding:12px 0 4px;text-transform:uppercase;letter-spacing:0.3px">${fmtDate(date)}</div>`;
    html += '<div class="card" style="padding:0 16px;margin-bottom:8px">';
    groups[date].forEach(t => {
      let iconHtml = '';
      if (t.type === 'income') {
        iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--green);"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
      } else if (t.tag === 'commute') {
        iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);"><rect x="5" y="4" width="14" height="16" rx="2"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/><path d="M12 8h.01"/><path d="M9 12h6"/></svg>`;
      } else if (t.tag === 'split') {
        iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary);"><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="15" y2="17"/></svg>`;
      } else {
        iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--red);"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
      }

      const iconCls = t.type === 'income' ? 'income' : t.tag === 'split' ? 'split' : '';
      const amtCls = t.type === 'income' ? 'pos' : 'neg';
      const sign = t.type === 'income' ? '+' : '−';
      html += `<div class="feed-item">
        <div class="feed-icon ${iconCls}">${iconHtml}</div>
        <div class="feed-body">
          <div class="feed-desc">${t.description}</div>
          <div class="feed-meta">${t.category || ''}${t.paymentMethod ? ' · ' + t.paymentMethod : ''}</div>
        </div>
        <span class="feed-amount ${amtCls}">${sign}${sym}${t.amount}</span>
      </div>`;
    });
    html += '</div>';
  });

  container.innerHTML = html;
}

function populateGroupMembers() {
  const grid = document.getElementById('grp-members');
  const name = State.data.user.name || 'Me';
  let html = `<label><input type="checkbox" value="${name}" checked disabled>${name}</label>`;
  State.data.friends.list.forEach(f => {
    html += `<label><input type="checkbox" value="${f}">${f}</label>`;
  });
  grid.innerHTML = html;
}

function updateGroupHint() {
  const hint = document.getElementById('grp-hint');
  const amt = parseFloat(document.getElementById('grp-amount').value) || 0;
  const checked = [...document.querySelectorAll('#grp-members input:checked')].length;
  if (!amt || checked < 2) { hint.textContent = ''; return; }
  const share = amt / checked;
  hint.textContent = `${State.data.user.currency || '₹'}${Math.round(share)} per person`;
}

function showEqualizedDebts() {
  const { friends, user } = State.data;
  const sym = user.currency || '₹';
  const container = document.getElementById('equalize-list');
  const dialog = document.getElementById('dialog-equalize');

  const debtors = [];
  const creditors = [];

  friends.list.forEach(f => {
    const bal = friends.balances[f] || 0;
    if (bal > 0) {
      debtors.push({ name: f, amount: bal });
    } else if (bal < 0) {
      creditors.push({ name: f, amount: Math.abs(bal) });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const minAmt = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      from: debtor.name,
      to: creditor.name,
      amount: minAmt
    });

    debtor.amount -= minAmt;
    creditor.amount -= minAmt;

    if (debtor.amount <= 0.01) dIdx++;
    if (creditor.amount <= 0.01) cIdx++;
  }

  if (transactions.length === 0) {
    container.innerHTML = '<p class="empty-state" style="text-align:center;padding:16px 0;">All debts are already settled! 🥳</p>';
  } else {
    container.innerHTML = transactions.map(t => 
      `<div class="equalize-item">
        <span>👉 <strong>${t.from}</strong> pays <strong>${t.to}</strong></span>
        <strong style="color:var(--accent);">${sym}${Math.round(t.amount)}</strong>
      </div>`
    ).join('');
  }

  dialog.showModal();
}
