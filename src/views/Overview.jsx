import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';
import { askAI, askForBudgetAdvice } from '../services/ai';

export default function Overview() {
  const { state, addTransaction, addCategory, addFriend, addSplitIOU, updateSettings } = useStateContext();
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  
  // Dialog refs
  const iosDialogRef = useRef(null);
  
  const { user, transactions, spikes, friends, widgetSettings, ai } = state;
  const sym = user.currency || '₹';

  // State Mutators map for AI commands
  const stateContextMutators = {
    addTransaction,
    addCategory,
    addFriend,
    addSplitIOU,
    updateSettings,
    addSpike: () => {}, // placeholder if needed
    addSavingsGoal: () => {} // placeholder if needed
  };

  // Helper formatting functions
  const cur = (amount) => {
    return sym + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(); 
    today.setHours(0,0,0,0);
    const diff = Math.floor((today - d) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // 1. GREETING
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // 2. TODAY'S SPENDING CALCULATIONS
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  
  const todayExpenses = transactions.filter(t => t.type === 'expense' && t.date === todayStr);
  const dailyTotal = todayExpenses.reduce((s, t) => s + t.amount, 0);

  // Group today's expenses by category
  const todayGroupedExpenses = {};
  todayExpenses.forEach(t => {
    todayGroupedExpenses[t.category] = (todayGroupedExpenses[t.category] || 0) + t.amount;
  });

  // 3. BUDGET CALCULATIONS
  const now = new Date();
  const period = user.budgetPeriod || 'week';
  let periodStart;

  if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    const dayOfWeek = now.getDay() || 7;
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1, 0, 0, 0, 0);
  }

  const periodExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const periodIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const baseBudget = user.weeklyPocketMoney || 0;
  const adjustedBudget = baseBudget + periodIncome;
  
  // Calculate friend debts to deduct from pocket money
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
  const budgetProgressPct = adjustedBudget > 0 ? Math.min((totalConsumed / adjustedBudget) * 100, 100) : 0;

  // 4. BURN RATE & RUNOUT FORECAST
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

  let burnStatus = 'Healthy';
  let burnBadgeBg = 'rgba(16, 185, 129, 0.1)';
  let burnBadgeColor = 'var(--green)';
  let forecastHtml = '';
  let burnProgressWidth = '100%';
  let burnProgressBg = 'var(--green)';

  if (left <= 0) {
    burnStatus = 'Critical';
    burnBadgeBg = 'rgba(239, 68, 68, 0.1)';
    burnBadgeColor = 'var(--red)';
    forecastHtml = `You have already <strong>exhausted</strong> your budget for this ${period}! You are operating on a deficit of <strong>${cur(left)}</strong>. Avoid all non-essential purchases.`;
    burnProgressWidth = '0%';
    burnProgressBg = 'var(--red)';
  } else if (periodExpenses === 0) {
    burnStatus = 'Perfect';
    burnBadgeBg = 'rgba(16, 185, 129, 0.1)';
    burnBadgeColor = 'var(--green)';
    forecastHtml = `No expenses logged this ${period} yet! Your entire budget of <strong>${cur(adjustedBudget)}</strong> is fully intact.`;
    burnProgressWidth = '100%';
    burnProgressBg = 'var(--green)';
  } else {
    const daysLeftOfFunds = left / dailyBurnRate;
    
    if (daysLeftOfFunds >= daysRemaining) {
      burnStatus = 'Healthy';
      burnBadgeBg = 'rgba(16, 185, 129, 0.1)';
      burnBadgeColor = 'var(--green)';
      const endSavings = left - dailyBurnRate * daysRemaining;
      forecastHtml = `At your current spending rate of <strong>${cur(dailyBurnRate)}/day</strong>, your funds are projected to last the entire ${period}. You will have about <strong>${cur(endSavings)}</strong> left.`;
      burnProgressWidth = `${Math.min(100, (daysLeftOfFunds / daysRemaining) * 100)}%`;
      burnProgressBg = 'var(--green)';
    } else {
      burnStatus = 'Warning';
      burnBadgeBg = 'rgba(245, 158, 11, 0.1)';
      burnBadgeColor = 'var(--accent)';
      
      const runoutTime = now.getTime() + daysLeftOfFunds * 24 * 60 * 60 * 1000;
      const runoutDate = new Date(runoutTime);
      const runoutDayName = runoutDate.toLocaleDateString(undefined, { weekday: 'long' });
      const runoutDateString = runoutDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      forecastHtml = `At your current spending rate of <strong>${cur(dailyBurnRate)}/day</strong>, you are projected to exhaust your budget by <strong>${runoutDayName} (${runoutDateString})</strong>, which is <strong>${Math.ceil(daysRemaining - daysLeftOfFunds)} days</strong> before the period ends.`;
      burnProgressWidth = `${Math.min(100, (daysLeftOfFunds / daysRemaining) * 100)}%`;
      burnProgressBg = 'var(--accent)';
    }
  }

  // 5. COMMUTE & IOUS
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const commuteTotal = transactions
    .filter(t => t.type === 'expense' && t.category === 'Travel' && new Date(t.date + 'T00:00:00') >= monthStart)
    .reduce((s, t) => s + t.amount, 0);

  let owedTotal = 0;
  let oweTotal = 0;
  Object.values(friends.balances).forEach(b => {
    if (b > 0) owedTotal += b;
    else oweTotal += Math.abs(b);
  });

  // 6. BACKGROUND AI ADVICE TRIGGER
  useEffect(() => {
    if (user.targetGoal && ai.apiKey && !user.cachedAiAdvice) {
      const fetchAdvice = async () => {
        setIsAdviceLoading(true);
        try {
          const adviceText = await askForBudgetAdvice(state);
          if (adviceText) {
            updateSettings({ cachedAiAdvice: adviceText });
          }
        } catch (err) {
          console.warn('AI Advisor background update failed:', err);
        } finally {
          setIsAdviceLoading(false);
        }
      };
      fetchAdvice();
    }
  }, [transactions.length, user.targetGoal, period, user.cutbackCategory]);

  // AI Command Form submission
  const handleAiSubmit = async (e) => {
    e.preventDefault();
    const cmd = aiInput.trim();
    if (!cmd) return;

    setIsAiLoading(true);
    setAiResponse({ type: 'loading', message: 'Analyzing and executing command...' });

    try {
      const result = await askAI(cmd, state, stateContextMutators);
      setAiInput('');
      setAiResponse({
        type: 'success',
        message: result.message,
        actions: result.actions
      });
      window.toast('AI command executed! 📲');
    } catch (err) {
      setAiResponse({
        type: 'error',
        message: err.message || 'Failed to execute command.'
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // iOS Shortcut promo logic
  const [showIosPromo, setShowIosPromo] = useState(false);
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const dismissed = localStorage.getItem('dismissed_ios_promo') === 'true';
    setShowIosPromo(isIOS && !dismissed);
  }, []);

  const handleDismissIosPromo = () => {
    localStorage.setItem('dismissed_ios_promo', 'true');
    setShowIosPromo(false);
  };

  const handleSetupIosPromo = () => {
    if (iosDialogRef.current) {
      iosDialogRef.current.showModal();
    }
  };

  // Render recent transaction icon
  const getTransactionIcon = (t) => {
    if (t.type === 'income') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
      );
    } else if (t.category === 'Travel') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4" width="14" height="16" rx="2"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/><path d="M12 8h.01"/><path d="M9 12h6"/>
        </svg>
      );
    } else {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
        </svg>
      );
    }
  };

  return (
    <section id="view-home" className="view active">
      <h1 className="greeting">{greet}, {user.name || 'Student'}</h1>

      {/* AI Command Bar Widget */}
      {widgetSettings.showAiBar !== false && (
        <div id="widget-aibar" style={{ marginBottom: '16px' }}>
          <form id="ai-command-form" className="ai-capsule" onSubmit={handleAiSubmit}>
            <input
              type="text"
              id="ai-input"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask AI: 'add 120 for lunch' or 'change my budget to 2000'..."
              required
              disabled={isAiLoading}
              autoComplete="off"
            />
            <button type="submit" id="ai-submit" disabled={isAiLoading}>
              {isAiLoading ? 'Analyzing...' : 'Ask AI'}
            </button>
          </form>
          {aiResponse && (
            <div className={`ai-response ${aiResponse.type}`} style={{ display: 'block', marginTop: '-12px', marginBottom: '16px', padding: '16px', background: 'rgba(197, 160, 89, 0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <p style={{ fontWeight: 500, marginBottom: '4px' }}>{aiResponse.message}</p>
              {aiResponse.actions && aiResponse.actions.length > 0 && (
                <>
                  <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px dashed var(--border)' }} />
                  <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Logged Actions:</strong>
                  <div style={{ marginTop: '4px', fontSize: '12.5px', lineHeight: '1.4' }}>
                    {aiResponse.actions.map((act, i) => (
                      <div key={i}>• {act}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Over Budget Warning Banner */}
      {left < 0 && (
        <div id="over-budget-warning" className="card warning-card" style={{ display: 'flex', borderColor: 'var(--red)', background: 'rgba(200, 94, 58, 0.08)' }}>
          <span className="warning-icon" style={{ marginRight: '12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div className="warning-body">
            <div className="warning-title" style={{ fontWeight: 'bold', color: 'var(--red)' }}>Budget Overdraft</div>
            <div className="warning-desc" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>You have exceeded your safe spending limit! Reduce non-essential expenses.</div>
          </div>
        </div>
      )}

      {/* iOS Background Sync Promotion Widget */}
      {showIosPromo && (
        <div id="widget-ios-promo" className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(197, 160, 89, 0.04) 100%)', borderLeft: '4px solid var(--accent)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '4px', letterSpacing: '0.5px' }}>iOS Feature</div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>Background Auto-Logging for iPhone</h4>
              <p className="muted" style={{ margin: 0, fontSize: '12px', lineHeight: '1.45' }}>Log expenses automatically in the background when you receive bank SMS notifications.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={handleDismissIosPromo} style={{ padding: '2px 6px', height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px' }}>&times;</button>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-primary btn-sm" onClick={handleSetupIosPromo} style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>Setup Shortcut</button>
          </div>
        </div>
      )}

      {/* Today's Spending Summary Card */}
      <div className="card" id="widget-daily-summary" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, letterSpacing: '-0.2px' }}>Today's Spending</h3>
          </div>
          <span id="daily-total" style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent)' }}>{cur(dailyTotal)}</span>
        </div>
        <div id="daily-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--border)', paddingTop: '8px', marginTop: '8px' }}>
          {todayExpenses.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: '11.5px', textAlign: 'center', padding: '4px 0' }}>No expenses logged today.</p>
          ) : (
            Object.entries(todayGroupedExpenses).map(([category, amount]) => {
              const pct = Math.round((amount / (dailyTotal || 1)) * 100);
              return (
                <div key={category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="legend-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span>
                    <span style={{ fontWeight: 500 }}>{category}</span>
                  </div>
                  <span className="muted" style={{ fontWeight: 600 }}>{cur(amount)} ({pct}%)</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Burn Rate Widget */}
      {widgetSettings.showBurnRate !== false && (
        <div className="card" id="widget-burn-rate" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, letterSpacing: '-0.2px' }}>Burn Rate & Runout Forecast</h3>
            </div>
            <span id="burn-status-badge" className="badge" style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', background: burnBadgeBg, color: burnBadgeColor }}>{burnStatus}</span>
          </div>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: forecastHtml }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted" id="burn-rate-daily-avg">Daily Spend: {cur(dailyBurnRate)}/day</span>
              <span className="muted" id="burn-rate-runout-est">Est. Runout: {burnStatus === 'Critical' ? 'Exhausted' : burnStatus === 'Healthy' ? 'Safe' : 'Early'}</span>
            </div>
            <div className="progress-track" style={{ height: '6px', background: 'rgba(255,255,255,0.03)' }}>
              <div className="progress-fill" id="burn-progress-bar" style={{ width: burnProgressWidth, background: burnProgressBg }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly/Monthly Budget Card */}
      {widgetSettings.showBudget !== false && (
        <div className="card budget-card" id="widget-budget">
          <div className="budget-header">
            <span className="budget-label" id="budget-period-label">{period === 'month' ? 'This month' : 'This week'}</span>
            <span id="budget-remaining" className={`budget-remaining ${left >= 0 ? 'ok' : 'over'}`}>
              {left >= 0 ? `${cur(left)} left` : `${cur(left)} over`}
            </span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${budgetProgressPct >= 100 ? 'over' : ''}`} id="budget-bar" style={{ width: `${budgetProgressPct}%` }}></div>
          </div>
          <div className="budget-footer">
            <span><strong id="budget-spent">{cur(totalConsumed)}</strong> spent</span>
            {netFriendDebt > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Includes {cur(netFriendDebt)} friend debts</span>}
            <span className="muted">of <span id="budget-limit">{cur(adjustedBudget)}</span></span>
          </div>

          {/* AI Advisor Panel */}
          {user.targetGoal && (
            <div className="ai-advisor-panel" id="ai-advisor-panel">
              <div className="ai-advisor-header">
                <div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  AI Budget Advisor
                </div>
                {isAdviceLoading && <span id="ai-advisor-loader" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>thinking...</span>}
              </div>
              <div id="ai-advisor-meta" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Targeting: {user.targetGoal} | Cutback Area: {user.cutbackCategory || 'Canteen'}
              </div>
              <p id="ai-advisor-text" className="muted" style={{ fontSize: '12.5px', lineHeight: '1.45' }}>
                {user.cachedAiAdvice || 'Generating custom advice...'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats Row Widget */}
      {widgetSettings.showStats !== false && (
        <div className="stat-row" id="widget-stats">
          <div className="card stat-card stat-commute">
            <span className="stat-label">Commute this month</span>
            <span className="stat-value" id="home-commute">{cur(commuteTotal)}</span>
          </div>
          <div className="card stat-card clickable stat-owed" onClick={() => location.hash = '#activity'}>
            <span className="stat-label">Friends owe you</span>
            <span className="stat-value green" id="home-owed">{cur(owedTotal)}</span>
          </div>
          <div className="card stat-card clickable stat-owe" onClick={() => location.hash = '#activity'}>
            <span className="stat-label">You owe</span>
            <span className="stat-value red" id="home-owe">{cur(oweTotal)}</span>
          </div>
        </div>
      )}

      {/* Recent Feed Widget */}
      {widgetSettings.showRecent !== false && (
        <div id="widget-recent">
          <div className="section-head">
            <h2>Recent Activities</h2>
            <a href="#activity" className="link">View all →</a>
          </div>
          <div className="card" id="home-recent">
            {transactions.length === 0 ? (
              <p className="empty-state">No entries yet. Ask AI or tap Log below!</p>
            ) : (
              transactions.slice(0, 3).map(t => (
                <div className="feed-item" key={t.id}>
                  <div className="feed-icon">{getTransactionIcon(t)}</div>
                  <div className="feed-body">
                    <div className="feed-desc">{t.description}</div>
                    <div className="feed-meta">{fmtDate(t.date)}</div>
                  </div>
                  <span className={`feed-amount ${t.type === 'income' ? 'pos' : 'neg'}`}>
                    {t.type === 'income' ? '+' : '−'}{cur(t.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* iOS Webhook setup dialog modal */}
      <dialog id="dialog-ios-shortcut" className="dialog" ref={iosDialogRef}>
        <button type="button" className="btn-close-dialog" onClick={() => iosDialogRef.current?.close()} aria-label="Close dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ marginBottom: '12px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-light)' }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>Setup iOS Auto-Logging</h3>
          <p className="muted" style={{ fontSize: '13px', margin: '6px 0 0 0' }}>Log expenses instantly from your bank SMS texts in the background.</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '14px', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px' }}>Step 1: Copy Webhook URL</span>
            <div id="ios-dialog-webhook-display" style={{ fontSize: '11.5px', fontFamily: 'monospace', wordBreak: 'break-all', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
              {`https://${window.location.host}/api/sms-log?userId=${user.upiId || 'local'}`}
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm"
              style={{ width: 'auto' }}
              onClick={async () => {
                const urlText = `https://${window.location.host}/api/sms-log?userId=${user.upiId || 'local'}`;
                await navigator.clipboard.writeText(urlText);
                window.toast('Copied webhook URL! 📋');
              }}
            >
              Copy URL
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '14px', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px' }}>Step 2: Get Pre-saved Shortcut</span>
            <p className="muted" style={{ margin: 0, fontSize: '12px', lineHeight: '1.4' }}>When adding the Shortcut to your iPhone, it will ask for your webhook URL. Simply paste the link you copied in Step 1!</p>
            <a href="https://www.icloud.com/shortcuts/6430011c73ef4eb692df7780c534b32e" target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '36px' }}>Get iOS Shortcut 🔗</a>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={() => iosDialogRef.current?.close()} style={{ width: '100%' }}>Close</button>
        </div>
      </dialog>
    </section>
  );
}
