/* Bank Integration Controller (js/bank.js) */
import { toast } from './app.js';
import { State } from './state.js';

export function initBank() {
  const btnLink = document.getElementById('btn-link-bank');
  const btnUnlink = document.getElementById('btn-unlink-bank');
  const btnSync = document.getElementById('btn-sync-bank');
  const dialogLink = document.getElementById('dialog-link-bank');
  
  const bankButtons = document.querySelectorAll('#bank-list-buttons button');
  const formAuth = document.getElementById('form-link-bank-auth');
  const selectedBankHidden = document.getElementById('selected-bank-name');
  
  const btnCloseSelect = document.getElementById('close-bank-select-dialog');
  const btnCloseAuth = document.getElementById('close-link-bank-dialog');

  if (!btnLink) return;

  // Open select dialog
  btnLink.addEventListener('click', () => {
    formAuth.style.display = 'none';
    document.getElementById('bank-list-buttons').style.display = 'flex';
    document.getElementById('bank-select-cancel-container').style.display = 'block';
    dialogLink.showModal();
  });

  // Select bank button
  bankButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const bankName = btn.dataset.bank;
      selectedBankHidden.value = bankName;
      document.getElementById('bank-list-buttons').style.display = 'none';
      document.getElementById('bank-select-cancel-container').style.display = 'none';
      formAuth.style.display = 'flex';
    });
  });

  // Cancel select
  btnCloseSelect.addEventListener('click', () => {
    dialogLink.close();
  });

  // Cancel auth
  btnCloseAuth.addEventListener('click', () => {
    dialogLink.close();
  });

  // Auth submit (link)
  formAuth.addEventListener('submit', (e) => {
    e.preventDefault();
    const bankName = selectedBankHidden.value;
    State.data.linkedBank = {
      linked: true,
      bankName: bankName,
      syncedCount: 0
    };
    State.saveState();
    toast(`Successfully linked with ${bankName}! 🏦`);
    renderBankUI();
    dialogLink.close();
    // Reset fields
    document.getElementById('bank-user-id').value = '';
    document.getElementById('bank-password').value = '';
  });

  // Unlink
  btnUnlink.addEventListener('click', () => {
    if (confirm('Are you sure you want to disconnect this bank account?')) {
      State.data.linkedBank = {
        linked: false,
        bankName: '',
        syncedCount: 0
      };
      State.saveState();
      toast('Bank account disconnected.');
      renderBankUI();
    }
  });

  // Sync now
  btnSync.addEventListener('click', () => {
    if (State.data.linkedBank.syncedCount >= 1) {
      toast('All pending transactions are already synced! 🏦');
      return;
    }

    toast('Syncing bank ledger...');
    btnSync.disabled = true;

    setTimeout(() => {
      // Seed 3 mock bank transactions
      const base = new Date();
      const d = off => { const dt = new Date(base); dt.setDate(dt.getDate() + off); return dt.toISOString().split('T')[0]; };
      
      const txns = [
        { type: 'expense', category: 'Canteen', amount: 80, paymentMethod: 'UPI', date: d(0), description: 'Canteen Coffee (Bank Sync)' },
        { type: 'expense', category: 'Books', amount: 1200, paymentMethod: 'UPI', date: d(-1), description: 'Bookstore Textbook (Bank Sync)' },
        { type: 'expense', category: 'Other', amount: 199, paymentMethod: 'UPI', date: d(-2), description: 'Netflix Subscription (Bank Sync)' }
      ];

      txns.forEach(t => State.addTransaction(t));
      
      State.data.linkedBank.syncedCount = 1;
      State.saveState();
      
      toast('Imported 3 new bank transactions! 💸');
      btnSync.disabled = false;
      renderBankUI();
    }, 1500);
  });

  // Initial render
  renderBankUI();
}

export function renderBankUI() {
  const unlinkedView = document.getElementById('bank-unlinked-view');
  const linkedView = document.getElementById('bank-linked-view');
  const bankNameDisplay = document.getElementById('bank-name-display');
  const bankLastSync = document.getElementById('bank-last-sync');

  if (!unlinkedView || !linkedView) return;

  const lb = State.data.linkedBank || { linked: false };
  
  if (lb.linked) {
    unlinkedView.style.display = 'none';
    linkedView.style.display = 'flex';
    bankNameDisplay.textContent = `🏦 ${lb.bankName}`;
    bankLastSync.textContent = lb.syncedCount > 0 ? new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never';
  } else {
    unlinkedView.style.display = 'block';
    linkedView.style.display = 'none';
  }
}
