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

async function processPendingSmsTransactions() {
  try {
    const user = await SupabaseService.getCurrentUser();
    if (!user) return;

    // Fetch matching pending transactions from notifications queue
    const { data: notifications, error: fetchErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'pending_transaction');

    if (fetchErr) throw fetchErr;
    if (!notifications || notifications.length === 0) return;

    console.log(`[PWA Background Sync] Processing ${notifications.length} queued SMS payments`);

    for (const notif of notifications) {
      try {
        const txn = JSON.parse(notif.message);
        State.addTransaction(txn);
        toast(`Auto-logged ₹${txn.amount} for ${txn.description} from iOS SMS! 📲`);
      } catch (parseErr) {
        console.error('Failed to parse queued SMS transaction payload:', parseErr);
      }
    }

    // Flush processed items
    const { error: delErr } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'pending_transaction');

    if (delErr) throw delErr;

  } catch (err) {
    console.error('Failed to sync background SMS transactions:', err);
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
