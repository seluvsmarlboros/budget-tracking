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

function boot() {
  console.log('UniSpend: boot() triggered');
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

document.addEventListener('DOMContentLoaded', boot);
