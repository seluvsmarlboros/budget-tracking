import React, { useState, useMemo } from 'react';
import { useStateContext } from '../contexts/StateContext';

export default function WhatIfSimulator() {
  const { state } = useStateContext();
  const { user, transactions = [] } = state;
  const sym = user?.currency || '₹';

  const [activeTab, setActiveTab] = useState('afford'); // 'afford' | 'goal'
  
  // Tab 1: Can I afford this state
  const [purchaseAmount, setPurchaseAmount] = useState('');
  
  // Tab 2: Savings Goal Planner state
  const [goalAmount, setGoalAmount] = useState('');
  const [dailyCutback, setDailyCutback] = useState(150); // default cutback ₹150/day

  // Date and Budget Math (Identical to Overview.jsx)
  const now = new Date();
  const period = user.budgetPeriod || 'month';
  let periodStart;
  if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    const dayOfWeek = now.getDay() || 7;
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
  }

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);

  const periodExpenses = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart)
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, periodStart]);

  const periodIncome = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income' && new Date(t.date + 'T00:00:00') >= periodStart)
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, periodStart]);

  const baseBudget = user.weeklyPocketMoney || 5000;
  const availableCash = Math.max(0, baseBudget + periodIncome - periodExpenses);

  // Tab 1 Math: Purchase Impact
  const cost = parseFloat(purchaseAmount) || 0;
  const currentDailyLimit = Math.max(1, Math.round(availableCash / remainingDays));
  const remainingCashAfterPurchase = availableCash - cost;
  const afterPurchaseDailyLimit = Math.round(remainingCashAfterPurchase / remainingDays);

  // Dynamic threshold based on user's current baseline pace:
  // Safe/Comfortable: >= 65% of current daily limit retained
  // Tight: 35% - 64% of current daily limit retained
  // Critical: < 35% of current daily limit retained
  const comfortableThreshold = Math.max(30, Math.round(currentDailyLimit * 0.65));
  const tightThreshold = Math.max(10, Math.round(currentDailyLimit * 0.35));

  let verdictType = 'safe'; // 'safe' | 'tight' | 'over'
  let verdictTitle = '';
  let verdictDesc = '';

  if (cost > availableCash) {
    verdictType = 'over';
    const deficit = cost - availableCash;
    verdictTitle = 'Exceeds Available Cash';
    verdictDesc = `This purchase exceeds your remaining balance by ${sym}${deficit.toLocaleString()}.`;
  } else if (afterPurchaseDailyLimit < tightThreshold) {
    verdictType = 'over';
    verdictTitle = 'Critical Budget Impact';
    verdictDesc = `Reduces your daily limit down to ${sym}${Math.max(0, afterPurchaseDailyLimit)}/day (drops below 35% of your normal daily pace).`;
  } else if (afterPurchaseDailyLimit < comfortableThreshold) {
    verdictType = 'tight';
    verdictTitle = 'Tight Budget Ahead';
    verdictDesc = `Reduces your daily allowance from ${sym}${currentDailyLimit}/day to ${sym}${Math.max(0, afterPurchaseDailyLimit)}/day for the next ${remainingDays} days.`;
  } else {
    verdictType = 'safe';
    verdictTitle = 'Safe & Comfortable Purchase!';
    verdictDesc = `You preserve a healthy ${sym}${afterPurchaseDailyLimit}/day allowance (${Math.round((afterPurchaseDailyLimit / currentDailyLimit) * 100)}% of your normal pace) for the next ${remainingDays} days.`;
  }


  // Tab 2 Math: Savings Goal Target
  const targetGoalVal = parseFloat(goalAmount) || 0;
  const daysToGoal = dailyCutback > 0 ? Math.ceil(targetGoalVal / dailyCutback) : 0;
  const goalTargetDate = useMemo(() => {
    if (!daysToGoal) return '';
    const d = new Date();
    d.setDate(d.getDate() + daysToGoal);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [daysToGoal]);

  const cur = (amt) => sym + Math.abs(amt).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="card pulse-card" style={{ padding: '20px', marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            What-If Simulator
          </h3>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
            Financial Scenario Planner
          </h2>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border)',
          borderRadius: '99px',
          padding: '3px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('afford')}
            style={{
              background: activeTab === 'afford' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'afford' ? '#0d1a15' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '99px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Can I Afford This?
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goal')}
            style={{
              background: activeTab === 'goal' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'goal' ? '#0d1a15' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '99px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Savings Goal Planner
          </button>
        </div>
      </div>

      {/* TAB 1: CAN I AFFORD THIS */}
      {activeTab === 'afford' && (
        <div>
          {/* Quick Amount Selection Chips */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
              Enter or select planned expense:
            </label>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {[500, 1000, 2500, 5000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPurchaseAmount(amt.toString())}
                  style={{
                    background: purchaseAmount === amt.toString() ? 'rgba(197, 160, 89, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: purchaseAmount === amt.toString() ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: purchaseAmount === amt.toString() ? 'var(--accent)' : 'var(--text)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sym}{amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Input Field */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontWeight: 700, fontSize: '15px' }}>
                {sym}
              </span>
              <input
                type="number"
                placeholder="Enter custom purchase amount..."
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px 12px 32px',
                  color: 'var(--text)',
                  fontSize: '15px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Results Summary Card */}
          <div style={{
            background: verdictType === 'safe'
              ? 'rgba(74, 222, 128, 0.06)'
              : verdictType === 'tight'
              ? 'rgba(255, 152, 0, 0.06)'
              : 'rgba(239, 83, 80, 0.08)',
            border: verdictType === 'safe'
              ? '1px solid rgba(74, 222, 128, 0.25)'
              : verdictType === 'tight'
              ? '1px solid rgba(255, 152, 0, 0.25)'
              : '1px solid rgba(239, 83, 80, 0.3)',
            borderRadius: '14px',
            padding: '16px'
          }}>
            {/* Verdict Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: verdictType === 'safe' ? '#4ADE80' : verdictType === 'tight' ? '#ff9800' : '#ef5350'
                }} />
                <span style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: verdictType === 'safe' ? '#4ADE80' : verdictType === 'tight' ? '#ff9800' : '#ef5350'
                }}>
                  {verdictTitle}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{remainingDays} days remaining</span>
            </div>

            {/* Before / After Comparison Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '10px',
              marginBottom: '10px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Daily Limit</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                  {cur(currentDailyLimit)} <span style={{ fontSize: '11px', fontWeight: 400 }}>/day</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>After Purchase Limit</div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: verdictType === 'safe' ? '#4ADE80' : verdictType === 'tight' ? '#ff9800' : '#ef5350',
                  marginTop: '2px'
                }}>
                  {cur(Math.max(0, afterPurchaseDailyLimit))} <span style={{ fontSize: '11px', fontWeight: 400 }}>/day</span>
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '12.5px', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
              {verdictDesc}
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: SAVINGS GOAL PLANNER */}
      {activeTab === 'goal' && (
        <div>
          {/* Target Amount Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Target goal amount (e.g. Headphones, Trip, Gadget):
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontWeight: 700, fontSize: '15px' }}>
                {sym}
              </span>
              <input
                type="number"
                placeholder="Enter goal amount (e.g. 5000)..."
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px 12px 32px',
                  color: 'var(--text)',
                  fontSize: '15px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Cutback Chips */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
              Select daily cutback strategy:
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: 'Cut Delivery (-₹150/day)', val: 150 },
                { label: 'Skip Canteen (-₹60/day)', val: 60 },
                { label: 'Aggressive (-₹300/day)', val: 300 }
              ].map(chip => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setDailyCutback(chip.val)}
                  style={{
                    background: dailyCutback === chip.val ? 'rgba(197, 160, 89, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: dailyCutback === chip.val ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: dailyCutback === chip.val ? 'var(--accent)' : 'var(--text)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Projection Card */}
          <div style={{
            background: 'rgba(197, 160, 89, 0.06)',
            border: '1px solid rgba(197, 160, 89, 0.25)',
            borderRadius: '14px',
            padding: '16px',
            textAlign: 'center'
          }}>
            {targetGoalVal > 0 && daysToGoal > 0 ? (
              <>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)', fontWeight: 700 }}>
                  🎯 Projected Goal Target
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', margin: '6px 0 4px 0' }}>
                  {daysToGoal} Days <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>(by {goalTargetDate})</span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  By saving {cur(dailyCutback)}/day, you will reach your {cur(targetGoalVal)} goal comfortably!
                </p>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Enter a goal amount above to calculate your savings timeline!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
