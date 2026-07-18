/* App entry — wires everything together */
import { State } from './state.js';
import { initRouter } from './router.js';
import { initOnboarding } from './onboarding.js';
import { initDashboard } from './dashboard.js';
import { initAddForm } from './add.js';
import { initActivity } from './activity.js';
import { initInsights } from './insights.js';
import { initSettings } from './settings.js';
import { initPartner } from './partner.js';
import { initPWA } from './pwa.js';
import { initOCR } from './ocr.js';
import { supabase, SupabaseService } from './supabase.js';

function boot() {
  console.log('UniSpend: boot() triggered');
  initPWA();
  try {
    State.loadState();
    console.log('UniSpend: State loaded successfully:', State.data);
  } catch (e) {
    console.error('UniSpend: Failed to load state:', e);
  }

  if (!State.data.user.onboarded) {
    console.log('UniSpend: User is not onboarded, showing onboarding screen');
    document.getElementById('onboarding').style.display = '';
    document.getElementById('app').classList.add('hidden');
    initOnboarding();
  } else {
    console.log('UniSpend: User is onboarded, launching app');
    document.getElementById('onboarding').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    initRouter();
    initDashboard();
    initAddForm();
    initActivity();
    initInsights();
    initSettings();
    initPartner();
    initOCR();
    processPendingSmsTransactions();
    setupGlobalNotificationsSubscription();
  }

  // Handle shared target text from PWA
  const params = new URLSearchParams(window.location.search);
  const sharedText = params.get('text') || params.get('title') || params.get('url');
  if (sharedText) {
    console.log('[PWA Share Target] Received shared payload:', sharedText);
    import('./smsParser.js').then(parser => {
      const parsed = parser.parseUPIAndSMS(sharedText);
      if (parsed) {
        import('./add.js').then(addForm => {
          window.location.hash = '#add';
          setTimeout(() => {
            addForm.autofillLogForm(parsed);
            toast('Autofilled shared transaction! 🧾');
          }, 400);
        });
      }
    });
  }

  // Fade out splash screen
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 450);
  }
}

// Toast utility
export function toast(msg) {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Currency helper
export function cur(amount) {
  const sym = State.data.user.currency || '₹';
  return sym + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Date formatting
export function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today - d) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

let pendingNotificationQueue = [];
let isProcessingPendingQueue = false;

async function processPendingSmsTransactions() {
  try {
    const user = await SupabaseService.getCurrentUser();
    if (!user) return;

    // Fetch matching pending transactions from notifications queue
    const { data: notifications, error: fetchErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'pending_transaction')
      .order('created_at', { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!notifications || notifications.length === 0) return;

    console.log(`[PWA Background Sync] Found ${notifications.length} queued SMS payments`);

    // Add to local memory queue, filtering out duplicates
    notifications.forEach(notif => {
      if (!pendingNotificationQueue.some(q => q.id === notif.id)) {
        pendingNotificationQueue.push(notif);
      }
    });

    // Start processing queue if not already active
    if (!isProcessingPendingQueue) {
      processNextPendingNotification();
    }

  } catch (err) {
    console.error('Failed to sync background SMS transactions:', err);
  }
}

function processNextPendingNotification() {
  if (pendingNotificationQueue.length === 0) {
    isProcessingPendingQueue = false;
    return;
  }

  isProcessingPendingQueue = true;
  const currentNotif = pendingNotificationQueue[0];
  let txn;
  try {
    txn = JSON.parse(currentNotif.message);
  } catch (err) {
    console.error('Failed to parse notification payload', err);
    // Remove invalid from queue and continue
    pendingNotificationQueue.shift();
    // Delete from DB to prevent loops
    supabase.from('notifications').delete().eq('id', currentNotif.id).then(() => {
      processNextPendingNotification();
    });
    return;
  }

  // Populate dialog details
  const dialog = document.getElementById('dialog-pending-transaction');
  const amountEl = document.getElementById('pending-txn-amount');
  const descEl = document.getElementById('pending-txn-desc');
  const typeEl = document.getElementById('pending-txn-type');

  if (dialog && amountEl && descEl && typeEl) {
    amountEl.textContent = `₹${parseFloat(txn.amount).toFixed(2)}`;
    descEl.textContent = txn.description || 'UPI Transaction';
    typeEl.textContent = txn.type || 'Expense';
    typeEl.style.color = txn.type === 'income' ? 'var(--green)' : 'var(--accent)';

    // Wire dialog buttons (removing old listeners first to avoid memory leaks)
    const approveBtn = document.getElementById('pending-txn-approve-btn');
    const rejectBtn = document.getElementById('pending-txn-reject-btn');

    // Clone button elements to wipe existing event listeners cleanly
    const newApproveBtn = approveBtn.cloneNode(true);
    const newRejectBtn = rejectBtn.cloneNode(true);
    approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);

    newApproveBtn.addEventListener('click', async () => {
      try {
        State.addTransaction(txn);
        toast(`Logged ₹${txn.amount} for ${txn.description}! 📲`);
        // Delete notification from DB
        await supabase.from('notifications').delete().eq('id', currentNotif.id);
        dialog.close();
        pendingNotificationQueue.shift();
        processNextPendingNotification();
      } catch (err) {
        toast(`Error saving: ${err.message}`);
      }
    });

    newRejectBtn.addEventListener('click', async () => {
      try {
        // Delete notification from DB
        await supabase.from('notifications').delete().eq('id', currentNotif.id);
        dialog.close();
        pendingNotificationQueue.shift();
        processNextPendingNotification();
      } catch (err) {
        toast(`Error ignoring: ${err.message}`);
      }
    });

    dialog.showModal();
  } else {
    // If layout missing, fallback to auto log
    State.addTransaction(txn);
    supabase.from('notifications').delete().eq('id', currentNotif.id).then(() => {
      pendingNotificationQueue.shift();
      processNextPendingNotification();
    });
  }
}

async function setupGlobalNotificationsSubscription() {
  try {
    const user = await SupabaseService.getCurrentUser();
    if (!user) return;

    supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && payload.new.type === 'pending_transaction') {
            console.log('[Realtime SMS] New pending transaction received:', payload.new);
            // Append to memory queue and trigger processing
            pendingNotificationQueue.push(payload.new);
            if (!isProcessingPendingQueue) {
              processNextPendingNotification();
            }
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.error('Failed to setup global notifications subscriber:', err);
  }
}

// Global dialog closer delegate
document.body.addEventListener('click', e => {
  const closeBtn = e.target.closest('[data-close-dialog]');
  if (closeBtn) {
    const dialog = closeBtn.closest('dialog');
    if (dialog) dialog.close();
  }
});

document.addEventListener('DOMContentLoaded', boot);
