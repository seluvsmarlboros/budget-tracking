/* Add / Log — unified single form */
import { State } from './state.js';
import { toast } from './app.js';
import { initQRScanner } from './qr.js';
import { parseUPIAndSMS } from './smsParser.js';

let currentType = 'expense';
let currentCat = '';
let currentMethod = 'UPI';
let splitDir = 'lent';
let splitMode = 'half';

export function initAddForm() {
  const form = document.getElementById('log-form');
  populateCats();
  populateFriends();
  try {
    initQRScanner();
  } catch(e) {
    console.warn('QR init failed:', e);
  }

  // Set today's date
  document.getElementById('log-date').valueAsDate = new Date();

  // Paste SMS Listener
  const btnPasteSms = document.getElementById('btn-paste-sms');
  if (btnPasteSms) {
    btnPasteSms.addEventListener('click', async () => {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText) {
          toast('Clipboard is empty! Copy a UPI / banking SMS alert first.');
          return;
        }

        const parsed = parseUPIAndSMS(clipboardText);
        if (parsed) {
          autofillLogForm(parsed);
          toast(`Autofilled ₹${parsed.amount || ''} from clipboard! 📋`);
        } else {
          toast('No transaction details discovered in copied text.');
        }
      } catch (err) {
        console.error('Clipboard reading failed:', err);
        toast('Permission to read clipboard is required.');
      }
    });
  }

  // Type pills
  document.getElementById('type-pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    currentType = pill.dataset.type;
    document.querySelectorAll('#type-pills .pill').forEach(p => p.classList.toggle('active', p === pill));
    document.getElementById('split-controls').style.display = currentType === 'split' ? '' : 'none';
    document.getElementById('cat-pills').style.display = currentType === 'split' ? 'none' : '';
    document.getElementById('log-submit').textContent = currentType === 'income' ? 'Log income' : currentType === 'split' ? 'Log split' : 'Log expense';
    updateSplitHint();
  });

  // Category pills
  document.getElementById('cat-pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    currentCat = pill.dataset.cat;
    document.querySelectorAll('#cat-pills .pill').forEach(p => p.classList.toggle('active', p.dataset.cat === currentCat));
  });

  // Payment method pills
  document.querySelectorAll('[data-method]').forEach(p => {
    p.addEventListener('click', () => {
      currentMethod = p.dataset.method;
      document.querySelectorAll('[data-method]').forEach(x => x.classList.toggle('active', x.dataset.method === currentMethod));
    });
  });

  // Split direction pills
  document.querySelectorAll('[data-dir]').forEach(p => {
    p.addEventListener('click', () => {
      splitDir = p.dataset.dir;
      document.querySelectorAll('[data-dir]').forEach(x => x.classList.toggle('active', x.dataset.dir === splitDir));
      updateSplitHint();
    });
  });

  // Split mode pills
  document.querySelectorAll('[data-split]').forEach(p => {
    p.addEventListener('click', () => {
      splitMode = p.dataset.split;
      document.querySelectorAll('[data-split]').forEach(x => x.classList.toggle('active', x.dataset.split === splitMode));
      updateSplitHint();
    });
  });

  // New friend button
  document.getElementById('btn-new-friend').addEventListener('click', () => {
    const dialog = document.getElementById('dialog-friend');
    dialog.showModal();
  });

  // Amount input for live hint
  document.getElementById('log-amount').addEventListener('input', updateSplitHint);

  // Submit (Manual validation)
  form.addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('log-amount').value);
    const desc = document.getElementById('log-desc').value.trim();
    const date = document.getElementById('log-date').value;
    
    if (!amount || amount <= 0) { toast('Please enter a valid amount'); return; }
    if (!desc) { toast('Please enter a description'); return; }
    if (!date) { toast('Please select a date'); return; }

    if (currentType === 'split') {
      const friend = document.getElementById('split-friend').value;
      if (!friend) { toast('Pick a friend'); return; }
      State.addSplitIOU(splitDir, friend, amount, desc, splitMode === 'half', date);
      toast(`Split logged with ${friend}`);
    } else if (currentType === 'income') {
      State.addTransaction({ type: 'income', category: currentCat || 'Other', amount, paymentMethod: currentMethod, date, description: desc });
      toast('Income logged');
    } else {
      State.addTransaction({ type: 'expense', category: currentCat || 'Other', amount, paymentMethod: currentMethod, date, description: desc });
      toast('Expense logged');
    }

    // Reset
    form.reset();
    document.getElementById('log-date').valueAsDate = new Date();
    currentType = 'expense';
    document.querySelectorAll('#type-pills .pill').forEach(p => p.classList.toggle('active', p.dataset.type === 'expense'));
    document.getElementById('split-controls').style.display = 'none';
    document.getElementById('cat-pills').style.display = '';
    document.getElementById('log-submit').textContent = 'Log expense';
    populateCats();
  });

  // Update currency symbol
  document.getElementById('log-currency').textContent = State.data.user.currency || '₹';

  // Re-render when state changes (new categories/friends)
  State.subscribe(() => { populateCats(); populateFriends(); });
  window.addEventListener('viewchange', e => {
    if (e.detail === 'add') {
      document.getElementById('log-date').valueAsDate = new Date();
      document.getElementById('log-currency').textContent = State.data.user.currency || '₹';
      populateFriends();
    }
  });
}

function populateCats() {
  const container = document.getElementById('cat-pills');
  const cats = State.data.categories;
  const first = cats[0] || 'Food';
  if (!currentCat || !cats.includes(currentCat)) currentCat = first;
  container.innerHTML = cats.map(c =>
    `<button type="button" class="pill small${c === currentCat ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
}

function populateFriends() {
  const sel = document.getElementById('split-friend');
  const current = sel.value;
  sel.innerHTML = '<option value="" disabled selected>Choose…</option>' +
    State.data.friends.list.map(f => `<option value="${f}"${f === current ? ' selected' : ''}>${f}</option>`).join('');
}

function updateSplitHint() {
  const hint = document.getElementById('split-hint');
  const amt = parseFloat(document.getElementById('log-amount').value) || 0;
  const friend = document.getElementById('split-friend').value || 'friend';
  if (currentType !== 'split' || !amt) { hint.textContent = ''; return; }
  const part = splitMode === 'half' ? amt / 2 : amt;
  const sym = State.data.user.currency || '₹';
  if (splitDir === 'lent') {
    hint.textContent = `${friend} will owe you ${sym}${part}`;
  } else {
    hint.textContent = `You'll owe ${friend} ${sym}${part}`;
  }
}

export function autofillLogForm(data) {
  if (!data) return;
  if (data.amount) document.getElementById('log-amount').value = data.amount;
  if (data.description) document.getElementById('log-desc').value = data.description;
  if (data.date) document.getElementById('log-date').value = data.date;
  if (data.type) {
    currentType = data.type;
    const pillRow = document.getElementById('type-pills');
    if (pillRow) {
      document.querySelectorAll('#type-pills .pill').forEach(p => p.classList.toggle('active', p.dataset.type === currentType));
    }
    const splitCtrl = document.getElementById('split-controls');
    if (splitCtrl) splitCtrl.style.display = currentType === 'split' ? '' : 'none';
    const catPills = document.getElementById('cat-pills');
    if (catPills) catPills.style.display = currentType === 'split' ? 'none' : '';
    const submitBtn = document.getElementById('log-submit');
    if (submitBtn) submitBtn.textContent = currentType === 'income' ? 'Log income' : currentType === 'split' ? 'Log split' : 'Log expense';
  }
}
