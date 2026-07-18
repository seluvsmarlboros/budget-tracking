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
  
  const { user, transactions, spikes, friends, widgetSettings, ai, wallet } = state;
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
      {/* Over Budget Warning Banner */}
      {left < 0 && (
        <div id="over-budget-warning" className="card warning-card" style={{ display: 'flex', borderColor: 'var(--red)', background: 'rgba(200, 94, 58, 0.08)', marginBottom: '24px' }}>
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
        <div id="widget-ios-promo" className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(197, 160, 89, 0.04) 100%)', borderLeft: '4px solid var(--accent)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '4px', letterSpacing: '0.5px' }}>iOS Feature</div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>Background Auto-Logging for iPhone</h4>
              <p className="muted" style={{ margin: 0, fontSize: '12.5px', lineHeight: '1.45' }}>Log expenses automatically when you receive bank SMS alerts.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={handleDismissIosPromo} style={{ padding: '2px 6px', height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px' }}>&times;</button>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-primary btn-sm" onClick={handleSetupIosPromo} style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>Setup Shortcut</button>
          </div>
        </div>
      )}

      {/* 2. TWO-COLUMN / SINGLE-COLUMN GRID */}
      <div className="overview-grid">
        
        {/* LEFT COLUMN: Hero balance, AI, and Activities */}
        <div className="overview-column">
          
          {/* 1. HERO BALANCE SECTION CARD */}
          <div className="hero-balance-section">
            <span className="hero-greeting">{greet}, {user.name || 'Student'}</span>
            <h1 className="hero-amount">{cur(left)}</h1>
            <span className="hero-subtitle">
              {left >= 0 ? 'remaining' : 'overdraft'} of {cur(adjustedBudget)} budget
            </span>
            <div className="hero-progress-container">
              <div className="progress-track" style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                <div
                  className={`progress-fill ${budgetProgressPct >= 100 ? 'over' : ''}`}
                  style={{
                    width: `${Math.min(100, budgetProgressPct)}%`,
                    height: '100%',
                    background: budgetProgressPct >= 100 ? 'var(--red)' : 'var(--accent-gradient)',
                    borderRadius: '99px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* AI Command capsule */}
          {widgetSettings.showAiBar !== false && (
            <div id="widget-aibar">
              <form id="ai-command-form" className="ai-capsule" onSubmit={handleAiSubmit}>
                <input
                  type="text"
                  id="ai-input"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask AI: 'spent 120 on canteen lunch'..."
                  required
                  disabled={isAiLoading}
                  autoComplete="off"
                />
                <button type="submit" id="ai-submit" disabled={isAiLoading}>
                  {isAiLoading ? '...' : 'Ask AI'}
                </button>
              </form>
              {aiResponse && (
                <div className={`ai-response ${aiResponse.type}`} style={{ display: 'block', marginTop: '12px', padding: '16px', background: 'rgba(197, 160, 89, 0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <p style={{ fontWeight: 500, margin: 0 }}>{aiResponse.message}</p>
                  {aiResponse.actions && aiResponse.actions.length > 0 && (
                    <>
                      <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px dashed var(--border)' }} />
                      <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Actions Logged:</strong>
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

          {/* Recent Feed Widget (Shows 5 on desktop, 3 on mobile) */}
          {widgetSettings.showRecent !== false && (
            <div id="widget-recent">
              <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2>Recent Activities</h2>
                <a href="#activity" className="link">View all →</a>
              </div>
              <div className="recent-list-clean">
                {transactions.length === 0 ? (
                  <p className="empty-state" style={{ padding: '16px 0', textAlign: 'center' }}>No entries yet. Ask AI or tap Log below!</p>
                ) : (
                  transactions.slice(0, window.innerWidth >= 768 ? 5 : 3).map(t => (
                    <div className="recent-item-clean" key={t.id}>
                      <div className="item-left">
                        <div className="item-icon">{getTransactionIcon(t)}</div>
                        <div className="item-details">
                          <span className="item-desc">{t.description}</span>
                          <span className="item-meta">{t.category} • {fmtDate(t.date)}</span>
                        </div>
                      </div>
                      <span className={`item-amount ${t.type === 'income' ? 'pos' : 'neg'}`}>
                        {t.type === 'income' ? '+' : '−'}{cur(t.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Consolidated Stats, Goals, Spikes, & Advice */}
        <div className="overview-column">
          
          {/* Financial Pulse Consolidated Card */}
          <div className="card pulse-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Financial Pulse</h3>
            
            <div className="pulse-row">
              <div className="pulse-col">
                <span className="pulse-label">Spent Today</span>
                <span className="pulse-val">{cur(dailyTotal)}</span>
              </div>
              <div className="pulse-col">
                <span className="pulse-label">Daily Average</span>
                <span className="pulse-val">{cur(dailyBurnRate)}</span>
              </div>
              <div className="pulse-col">
                <span className="pulse-label">Status</span>
                <span className={`pulse-badge ${burnStatus.toLowerCase()}`}>{burnStatus}</span>
              </div>
            </div>

            {/* Net Debts Info */}
            {(netFriendDebt > 0 || owedTotal > 0 || oweTotal > 0) && (
              <div className="pulse-debt-box">
                {netFriendDebt > 0 && (
                  <div className="pulse-debt-item">
                    <span>Friend debts included:</span>
                    <strong>{cur(netFriendDebt)}</strong>
                  </div>
                )}
                {(owedTotal > 0 || oweTotal > 0) && (
                  <div className="pulse-debt-item">
                    <span>Net IOU balance:</span>
                    <span style={{ color: (owedTotal >= oweTotal) ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {owedTotal >= oweTotal ? `Friends owe you ${cur(owedTotal - oweTotal)}` : `You owe ${cur(oweTotal - owedTotal)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Single Sentence Forecast */}
            <p className="pulse-forecast-summary" dangerouslySetInnerHTML={{ __html: forecastHtml }} />
          </div>

          {/* Student Savings Goals Progress Card */}
          {wallet?.savingsGoals && wallet.savingsGoals.length > 0 && (
            <div className="card pulse-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Savings Progress</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {wallet.savingsGoals.map((goal, i) => {
                  const pct = Math.min(100, Math.round(((goal.saved || 0) / (goal.target || 1)) * 100));
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ fontWeight: 500 }}>{goal.name}</span>
                        <span className="muted" style={{ fontWeight: 600 }}>{cur(goal.saved)} / {cur(goal.target)} ({pct}%)</span>
                      </div>
                      <div className="progress-track" style={{ height: '6px', background: 'rgba(255,255,255,0.03)' }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: '99px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Spike Expenses Card */}
          {spikes && spikes.length > 0 && (
            <div className="card pulse-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Upcoming Spikes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...spikes]
                  .filter(s => s && s.date && new Date(s.date) >= new Date().setHours(0,0,0,0))
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .slice(0, 2)
                  .map((s, i) => {
                    const diffDays = Math.ceil((new Date(s.date) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{s.title}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>In {diffDays} days ({new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{cur(s.amount)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* AI Advisor Panel */}
          {user.targetGoal && (
            <div className="card advice-card" style={{ padding: '16px', background: 'rgba(197, 160, 89, 0.02)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '600', color: 'var(--accent)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  AI Budget Advisor
                </div>
                {isAdviceLoading && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>thinking...</span>}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Target: {user.targetGoal} | Cutback category: {user.cutbackCategory || 'Canteen'}
              </div>
              <p style={{ fontSize: '12.5px', lineHeight: '1.45', color: 'var(--text-secondary)', margin: 0 }}>
                {user.cachedAiAdvice || 'Analyzing spend patterns to generate advice...'}
              </p>
            </div>
          )}
        </div>
      </div>

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
