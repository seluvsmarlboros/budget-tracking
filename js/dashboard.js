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


  // iOS Promo Banner Triggers
  const promoDismiss = document.getElementById('btn-dismiss-ios-promo');
  const promoSetup = document.getElementById('btn-setup-ios-promo');
  const modalClose = document.getElementById('close-ios-shortcut-dialog');
  const dialogCopyBtn = document.getElementById('btn-dialog-copy-webhook');

  if (promoDismiss) {
    promoDismiss.addEventListener('click', () => {
      localStorage.setItem('dismissed_ios_promo', 'true');
      const widget = document.getElementById('widget-ios-promo');
      if (widget) widget.style.display = 'none';
    });
  }

  if (promoSetup) {
    promoSetup.addEventListener('click', async () => {
      const dialog = document.getElementById('dialog-ios-shortcut');
      const displayDiv = document.getElementById('ios-dialog-webhook-display');
      
      try {
        const { SupabaseService } = await import('./supabase.js');
        const userObj = await SupabaseService.getCurrentUser();
        if (userObj && userObj.id) {
          if (displayDiv) {
            displayDiv.textContent = `https://${window.location.host}/api/sms-log?userId=${userObj.id}`;
          }
          if (dialog) dialog.showModal();
        } else {
          toast('Please log in first to set up iOS background sync.');
        }
      } catch (err) {
        console.error('Failed to resolve user for iOS promo dialog:', err);
      }
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      const dialog = document.getElementById('dialog-ios-shortcut');
      if (dialog) dialog.close();
    });
  }

  if (dialogCopyBtn) {
    dialogCopyBtn.addEventListener('click', async () => {
      const displayDiv = document.getElementById('ios-dialog-webhook-display');
      if (!displayDiv || displayDiv.textContent === '...') return;
      try {
        await navigator.clipboard.writeText(displayDiv.textContent);
        toast('Webhook URL copied to clipboard! 📋');
      } catch (err) {
        console.error('Failed to copy webhook:', err);
        toast('Failed to copy. Please select and copy manually.');
      }
    });
  }
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

  // Apply widget settings
  const ws = State.data.widgetSettings || { showBudget: true, showAiBar: true, showStats: true, showRecent: true };
  if (el('widget-budget')) el('widget-budget').style.display = ws.showBudget !== false ? '' : 'none';
  if (el('widget-aibar')) el('widget-aibar').style.display = ws.showAiBar !== false ? '' : 'none';
  if (el('widget-stats')) el('widget-stats').style.display = ws.showStats !== false ? 'flex' : 'none';
  if (el('widget-recent')) el('widget-recent').style.display = ws.showRecent !== false ? '' : 'none';

  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  el('greeting').textContent = `${greet}, ${user.name || 'Student'}`;

  // Today's Spending Summary Calculations (Timezone-safe YYYY-MM-DD)
  const dLocal = new Date();
  const yearLocal = dLocal.getFullYear();
  const monthLocal = String(dLocal.getMonth() + 1).padStart(2, '0');
  const dateLocal = String(dLocal.getDate()).padStart(2, '0');
  const todayStr = `${yearLocal}-${monthLocal}-${dateLocal}`;
  
  const todayExpenses = transactions.filter(t => t.type === 'expense' && t.date === todayStr);
  const dailyTotal = todayExpenses.reduce((s, t) => s + t.amount, 0);

  const elDailyTotal = el('daily-total');
  const elDailyBreakdown = el('daily-breakdown');
  if (elDailyTotal && elDailyBreakdown) {
    elDailyTotal.textContent = cur(dailyTotal);
    if (todayExpenses.length === 0) {
      elDailyBreakdown.innerHTML = '<p class="muted" style="margin: 0; font-size: 11.5px; text-align: center; padding: 4px 0;">No expenses logged today.</p>';
    } else {
      const byCat = {};
      todayExpenses.forEach(t => {
        byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      });
      elDailyBreakdown.innerHTML = Object.entries(byCat)
        .map(([cat, amt]) => {
          const pct = Math.round((amt / (dailyTotal || 1)) * 100);
          return `<div style="display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; margin: 2px 0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="legend-dot" style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block;"></span>
              <span style="font-weight: 500;">${cat}</span>
            </div>
            <span class="muted" style="font-weight: 600;">${sym}${amt} (${pct}%)</span>
          </div>`;
        }).join('');
    }
  }

  // Toggle iOS Shortcut promo widget
  const promoWidget = el('widget-ios-promo');
  if (promoWidget) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const dismissed = localStorage.getItem('dismissed_ios_promo') === 'true';
    
    if (isIOS && !dismissed) {
      import('./supabase.js').then(async ({ SupabaseService }) => {
        const userObj = await SupabaseService.getCurrentUser();
        if (userObj && userObj.id) {
          promoWidget.style.display = 'block';
        } else {
          promoWidget.style.display = 'none';
        }
      }).catch(() => {
        promoWidget.style.display = 'none';
      });
    } else {
      promoWidget.style.display = 'none';
    }
  }



  // Budget calculations
  const now = new Date();
  const period = user.budgetPeriod || 'week';
  let periodStart;

  if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    el('budget-period-label').textContent = 'This month';
  } else {
    const dayOfWeek = now.getDay() || 7;
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1, 0, 0, 0, 0);
    el('budget-period-label').textContent = 'This week';
  }

  const periodExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const periodIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const baseBudget = user.weeklyPocketMoney || 0;
  const adjustedBudget = baseBudget + periodIncome;
  
  // Calculate friend debts to deduct from main pocket money
  let netFriendDebt = 0;
  if (friends && friends.balances) {
    Object.values(friends.balances).forEach(b => {
      if (b < 0) {
        netFriendDebt += Math.abs(b);
      }
    });
  }

  const left = adjustedBudget - periodExpenses - netFriendDebt;
  const totalConsumed = periodExpenses + netFriendDebt;
  const pct = adjustedBudget > 0 ? Math.min((totalConsumed / adjustedBudget) * 100, 100) : 0;

  // Toggle warning banner
  const warningEl = el('over-budget-warning');
  if (warningEl) {
    warningEl.style.display = left < 0 ? 'flex' : 'none';
  }

  el('budget-spent').textContent = sym + Math.round(totalConsumed);
  el('budget-limit').textContent = sym + Math.round(adjustedBudget);
  el('budget-remaining').textContent = left >= 0 ? `${sym}${Math.round(left)} left` : `${sym}${Math.round(Math.abs(left))} over`;
  el('budget-remaining').className = 'budget-remaining ' + (left >= 0 ? 'ok' : 'over');

  const bar = el('budget-bar');
  bar.style.width = pct + '%';
  bar.className = 'progress-fill' + (pct >= 100 ? ' over' : '');

  // --- Burn Rate & Runout Forecast Calculations ---
  const burnCard = el('widget-burn-rate');
  if (burnCard) {
    const showBurn = ws.showBurnRate !== false;
    burnCard.style.display = showBurn ? '' : 'none';

    if (showBurn) {
      const msElapsed = now - periodStart;
      const daysElapsed = Math.max(1, Math.ceil(msElapsed / (1000 * 60 * 60 * 24)));
      const dailyBurnRate = periodExpenses / daysElapsed;
      
      const totalDaysInPeriod = period === 'month' 
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        : 7;
      
      const msInPeriod = totalDaysInPeriod * 24 * 60 * 60 * 1000;
      const periodEnd = new Date(periodStart.getTime() + msInPeriod);
      const msRemaining = periodEnd - now;
      const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      
      const statusBadge = el('burn-status-badge');
      const forecastText = el('burn-forecast-text');
      const dailyAvgEl = el('burn-rate-daily-avg');
      const runoutEstEl = el('burn-rate-runout-est');
      const progressBar = el('burn-progress-bar');
      
      dailyAvgEl.textContent = `Daily Spend: ${sym}${dailyBurnRate.toFixed(2)}`;
      
      if (left <= 0) {
        statusBadge.textContent = 'Critical';
        statusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
        statusBadge.style.color = 'var(--red)';
        
        forecastText.innerHTML = `You have already <strong>exhausted</strong> your budget for this ${period}! You are operating on a deficit of <strong>${sym}${Math.abs(left).toFixed(2)}</strong>. Avoid all non-essential purchases.`;
        
        runoutEstEl.textContent = 'Est. Runout: Empty';
        progressBar.style.width = '0%';
        progressBar.style.background = 'var(--red)';
      } else if (periodExpenses === 0) {
        statusBadge.textContent = 'Perfect';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
        statusBadge.style.color = 'var(--green)';
        
        forecastText.innerHTML = `No expenses logged this ${period} yet! Your entire budget of <strong>${sym}${adjustedBudget.toFixed(2)}</strong> is fully intact.`;
        
        runoutEstEl.textContent = 'Est. Runout: Healthy';
        progressBar.style.width = '100%';
        progressBar.style.background = 'var(--green)';
      } else {
        const daysLeftOfFunds = left / dailyBurnRate;
        
        if (daysLeftOfFunds >= daysRemaining) {
          statusBadge.textContent = 'Healthy';
          statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
          statusBadge.style.color = 'var(--green)';
          
          const endSavings = left - dailyBurnRate * daysRemaining;
          forecastText.innerHTML = `At your current spending rate of <strong>${sym}${dailyBurnRate.toFixed(2)}/day</strong>, your funds are projected to last the entire ${period}. You will have about <strong>${sym}${Math.round(endSavings)}</strong> left.`;
          
          runoutEstEl.textContent = 'Est. Runout: Safe';
          
          const pctLeft = Math.min(100, (daysLeftOfFunds / daysRemaining) * 100);
          progressBar.style.width = `${pctLeft}%`;
          progressBar.style.background = 'var(--green)';
        } else {
          statusBadge.textContent = 'Warning';
          statusBadge.style.background = 'rgba(245, 158, 11, 0.1)';
          statusBadge.style.color = 'var(--accent)';
          
          const runoutTime = now.getTime() + daysLeftOfFunds * 24 * 60 * 60 * 1000;
          const runoutDate = new Date(runoutTime);
          const runoutDayName = runoutDate.toLocaleDateString(undefined, { weekday: 'long' });
          const runoutDateString = runoutDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          
          forecastText.innerHTML = `At your current spending rate of <strong>${sym}${dailyBurnRate.toFixed(2)}/day</strong>, you are projected to exhaust your budget by <strong>${runoutDayName} (${runoutDateString})</strong>, which is <strong>${Math.ceil(daysRemaining - daysLeftOfFunds)} days</strong> before the period ends.`;
          
          runoutEstEl.textContent = `Est. Runout: ${runoutDayName.substring(0, 3)} (${runoutDateString})`;
          
          const pctLeft = Math.min(100, (daysLeftOfFunds / daysRemaining) * 100);
          progressBar.style.width = `${pctLeft}%`;
          progressBar.style.background = 'var(--accent)';
        }
      }
    }
  }

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

export function updateDashboardWidgets() {
  const el = id => document.getElementById(id);
  const ws = State.data.widgetSettings || { showBudget: true, showBurnRate: true, showAiBar: true, showStats: true, showRecent: true };
  if (el('widget-budget')) el('widget-budget').style.display = ws.showBudget !== false ? '' : 'none';
  if (el('widget-burn-rate')) el('widget-burn-rate').style.display = ws.showBurnRate !== false ? '' : 'none';
  if (el('widget-aibar')) el('widget-aibar').style.display = ws.showAiBar !== false ? '' : 'none';
  if (el('widget-stats')) el('widget-stats').style.display = ws.showStats !== false ? 'flex' : 'none';
  if (el('widget-recent')) el('widget-recent').style.display = ws.showRecent !== false ? '' : 'none';
}
