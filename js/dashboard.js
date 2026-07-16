/* Dashboard / Overview */
import { State } from './state.js';
import { cur, fmtDate, toast } from './app.js';
import { askAI, askForBudgetAdvice } from './ai.js';

const COMMUTE_COSTS = {
  metro: { cost: 60, name: 'Metro return' },
  bus: { cost: 30, name: 'Bus return' },
  petrol: { cost: 100, name: 'Bike fuel' },
  cab: { cost: 250, name: 'Cab share' },
  none: { cost: 0, name: 'Walk' }
};

let lastTxCount = -1;
let lastGoal = null;
let lastPeriod = null;
let lastCutback = null;
let isFetchingAdvice = false;

export function initDashboard() {
  render();
  State.subscribe(render);
  window.addEventListener('viewchange', e => { if (e.detail === 'home') render(); });

  // AI Command Form
  const aiForm = document.getElementById('ai-command-form');
  const aiInput = document.getElementById('ai-input');
  const aiSubmit = document.getElementById('ai-submit');
  const aiResponse = document.getElementById('ai-response');

  aiForm.addEventListener('submit', async e => {
    e.preventDefault();
    const cmd = aiInput.value.trim();
    if (!cmd) return;

    aiInput.disabled = true;
    aiSubmit.disabled = true;
    aiResponse.style.display = '';
    aiResponse.className = 'ai-response loading';
    aiResponse.textContent = 'Analyzing and executing command...';

    try {
      const result = await askAI(cmd);
      aiInput.value = '';
      aiResponse.className = 'ai-response success';

      let html = '';
      if (result.message) {
        html += `<p style="font-weight: 500; margin-bottom: 4px;">${result.message}</p>`;
      }
      if (result.actions && result.actions.length > 0) {
        if (html) html += '<hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">';
        html += '<strong style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary);">Logged Actions:</strong><br>' +
          result.actions.map(act => `• ${act}`).join('<br>');
      }
      if (!html) {
        html = 'Completed successfully.';
      }
      aiResponse.innerHTML = html;
    } catch (err) {
      aiResponse.className = 'ai-response error';
      aiResponse.textContent = err.message || 'Failed to run command.';
    } finally {
      aiInput.disabled = false;
      aiSubmit.disabled = false;
    }
  });


}

async function updateAiAdviceBackground() {
  if (isFetchingAdvice) return;
  const { user } = State.data;
  if (!user.targetGoal || !State.data.ai.apiKey) return;

  isFetchingAdvice = true;
  const loader = document.getElementById('ai-advisor-loader');
  if (loader) loader.style.display = 'inline';

  try {
    const advice = await askForBudgetAdvice();
    if (advice) {
      State.data.user.cachedAiAdvice = advice;
      State.saveState();
    }
  } catch (err) {
    console.warn('AI Advisor background update failed:', err);
  } finally {
    isFetchingAdvice = false;
    if (loader) loader.style.display = 'none';
  }
}

function render() {
  const { user, transactions, spikes, friends } = State.data;
  const sym = user.currency || '₹';
  const el = id => document.getElementById(id);

  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  el('greeting').textContent = `${greet}, ${user.name || 'Student'}`;



  // Budget calculations
  const now = new Date();
  const period = user.budgetPeriod || 'week';
  let periodStart;

  if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    el('budget-period-label').textContent = 'This month';
  } else {
    const dayOfWeek = now.getDay() || 7;
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - dayOfWeek + 1);
    periodStart.setHours(0,0,0,0);
    el('budget-period-label').textContent = 'This week';
  }

  const periodExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const budget = user.weeklyPocketMoney || 0;
  
  // Calculate friend debts to deduct from main pocket money
  let netFriendDebt = 0;
  if (friends && friends.balances) {
    Object.values(friends.balances).forEach(b => {
      if (b < 0) {
        netFriendDebt += Math.abs(b);
      }
    });
  }

  const left = budget - periodExpenses - netFriendDebt;
  const totalConsumed = periodExpenses + netFriendDebt;
  const pct = budget > 0 ? Math.min((totalConsumed / budget) * 100, 100) : 0;

  // Toggle warning banner
  const warningEl = el('over-budget-warning');
  if (warningEl) {
    warningEl.style.display = left < 0 ? 'flex' : 'none';
  }

  el('budget-spent').textContent = sym + Math.round(totalConsumed);
  el('budget-limit').textContent = sym + budget;
  el('budget-remaining').textContent = left >= 0 ? `${sym}${Math.round(left)} left` : `${sym}${Math.round(Math.abs(left))} over`;
  el('budget-remaining').className = 'budget-remaining ' + (left >= 0 ? 'ok' : 'over');

  const bar = el('budget-bar');
  bar.style.width = pct + '%';
  bar.className = 'progress-fill' + (pct >= 100 ? ' over' : '');
  // Render AI Advisor static / cached suggestion
  const advicePanel = el('ai-advisor-panel');
  if (user.targetGoal) {
    advicePanel.style.display = '';
    el('ai-advisor-meta').textContent = `Targeting: ${user.targetGoal} | Cutback Area: ${user.cutbackCategory || 'Canteen'}`;
    el('ai-advisor-text').textContent = user.cachedAiAdvice || 'Analyzing logs to generate advice...';
  } else {
    advicePanel.style.display = 'none';
  }

  // Trigger non-blocking background update if transactions count or settings changed
  if (user.targetGoal && 
      (transactions.length !== lastTxCount || 
       user.targetGoal !== lastGoal || 
       period !== lastPeriod ||
       user.cutbackCategory !== lastCutback ||
       !user.cachedAiAdvice)) {
    
    lastTxCount = transactions.length;
    lastGoal = user.targetGoal;
    lastPeriod = period;
    lastCutback = user.cutbackCategory || 'Canteen';
    
    // Non-blocking fire
    updateAiAdviceBackground();
  }

  // Commute this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const commuteTotal = transactions
    .filter(t => t.type === 'expense' && t.category === 'Travel' && new Date(t.date + 'T00:00:00') >= monthStart)
    .reduce((s, t) => s + t.amount, 0);
  el('home-commute').textContent = cur(commuteTotal);

  // IOU summary
  let owed = 0, owe = 0;
  Object.values(friends.balances).forEach(b => { if (b > 0) owed += b; else owe += Math.abs(b); });
  el('home-owed').textContent = cur(owed);
  el('home-owe').textContent = cur(owe);



  // Recent transactions (last 3)
  const recent = transactions.slice(0, 3);
  const container = el('home-recent');
  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">No entries yet</p>';
    return;
  }
  container.innerHTML = recent.map(t => feedItem(t, sym)).join('');
}

function feedItem(t, sym) {
  let iconHtml = '';
  if (t.type === 'income') {
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--green);"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
  } else if (t.category === 'Travel') {
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);"><rect x="5" y="4" width="14" height="16" rx="2"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/><path d="M12 8h.01"/><path d="M9 12h6"/></svg>`;
  } else if (t.type === 'expense') {
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--red);"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
  } else {
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary);"><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="15" y2="17"/></svg>`;
  }

  const cls = t.type === 'income' ? 'income' : t.category === 'Travel' ? '' : '';
  const amtCls = t.type === 'income' ? 'pos' : 'neg';
  const sign = t.type === 'income' ? '+' : '−';
  return `<div class="feed-item">
    <div class="feed-icon ${cls}">${iconHtml}</div>
    <div class="feed-body">
      <div class="feed-desc">${t.description}</div>
      <div class="feed-meta">${fmtDate(t.date)}</div>
    </div>
    <span class="feed-amount ${amtCls}">${sign}${sym}${t.amount}</span>
  </div>`;
}
