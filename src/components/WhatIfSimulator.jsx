import React, { useState, useMemo } from 'react';
import { useStateContext } from '../contexts/StateContext';

export default function WhatIfSimulator() {
  const { state, updateSettings } = useStateContext();
  const { user, transactions = [], wallet = {} } = state;
  const sym = user?.currency || '₹';

  // Interactive slider states
  const [foodCutback, setFoodCutback] = useState(0); // 0 to 75%
  const [skipMicroRuns, setSkipMicroRuns] = useState(0); // 0 to 10 runs/week
  const [plannedPurchase, setPlannedPurchase] = useState(0); // 0 to 10000

  // Historical calculation
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

  // Filter expenses in current period
  const periodExpenses = useMemo(() => {
    return transactions.filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart);
  }, [transactions, periodStart]);

  const totalPeriodSpent = periodExpenses.reduce((s, t) => s + t.amount, 0);
  const periodIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const baseBudget = user.weeklyPocketMoney || 5000;
  const availableCash = Math.max(0, baseBudget + periodIncome - totalPeriodSpent);

  // Category specific spent
  const foodSpent = periodExpenses
    .filter(t => (t.category || '').toLowerCase().includes('food') || (t.description || '').toLowerCase().includes('swiggy') || (t.description || '').toLowerCase().includes('zomato'))
    .reduce((s, t) => s + t.amount, 0);

  const elapsedDays = Math.max(1, currentDay);
  const avgDailyFood = foodSpent / elapsedDays;
  const avgDailyTotal = totalPeriodSpent / elapsedDays;

  // Simulation Math
  const dailyFoodSavings = (avgDailyFood * (foodCutback / 100));
  const dailyMicroSavings = (skipMicroRuns * 80) / 7; // ~80 per micro run
  const dailyPurchaseCost = plannedPurchase / remainingDays;

  const simulatedDailySpend = Math.max(10, avgDailyTotal - dailyFoodSavings - dailyMicroSavings + dailyPurchaseCost);
  const baselineDailySpend = Math.max(10, avgDailyTotal);

  const baselineRunwayDays = Math.min(remainingDays, Math.floor(availableCash / baselineDailySpend));
  const simulatedRunwayDays = Math.min(remainingDays, Math.floor(availableCash / simulatedDailySpend));

  const daysGained = Math.max(0, simulatedRunwayDays - baselineRunwayDays);
  const netSavingsAtEnd = Math.max(0, availableCash - (simulatedDailySpend * remainingDays));

  // Build SVG Points for Chart
  const svgWidth = 400;
  const svgHeight = 120;
  const maxVal = Math.max(100, availableCash);

  const baselinePoints = [];
  const simulatedPoints = [];

  for (let i = 0; i <= remainingDays; i++) {
    const x = (i / remainingDays) * svgWidth;
    
    const baseRemaining = Math.max(0, availableCash - (baselineDailySpend * i));
    const baseY = svgHeight - ((baseRemaining / maxVal) * (svgHeight - 20) + 10);
    baselinePoints.push(`${x},${baseY}`);

    const simRemaining = Math.max(0, availableCash - (simulatedDailySpend * i));
    const simY = svgHeight - ((simRemaining / maxVal) * (svgHeight - 20) + 10);
    simulatedPoints.push(`${x},${simY}`);
  }

  const applyTargetAsBudget = () => {
    const newSuggestedBudget = Math.round((simulatedDailySpend * 30));
    updateSettings({ weeklyPocketMoney: newSuggestedBudget });
    if (window.toast) window.toast(`Updated budget allowance to ${sym}${newSuggestedBudget}!`);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20, 18, 15, 0.9), rgba(12, 10, 8, 0.95))',
      border: '1px solid rgba(197, 160, 89, 0.3)',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      color: '#f5f0e8',
      marginBottom: '24px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #c5a059)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Interactive "What-If" Financial Simulator</h3>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.6 }}>
            Pure mathematical trajectory model • Simulate savings & planned purchases
          </p>
        </div>

        {daysGained > 0 && (
          <span style={{
            background: 'rgba(76, 175, 80, 0.15)',
            color: '#4caf50',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            padding: '4px 10px',
            borderRadius: '99px',
            fontSize: '12px',
            fontWeight: 700
          }}>
            +{daysGained} Days Extra Runway! 🎉
          </span>
        )}
      </div>

      {/* Trajectory Graph (SVG) */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        padding: '12px 16px',
        marginBottom: '20px',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
          <span>Today ({sym}{availableCash.toLocaleString()})</span>
          <span>End of Month ({remainingDays}d remaining)</span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '110px', overflow: 'visible' }}>
          {/* Grid lines */}
          <line x1="0" y1={svgHeight - 10} x2={svgWidth} y2={svgHeight - 10} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
          
          {/* Baseline Curve (Red/Orange) */}
          <polyline
            fill="none"
            stroke="rgba(239, 83, 80, 0.7)"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            points={baselinePoints.join(' ')}
          />

          {/* Simulated Curve (Gold/Green) */}
          <polyline
            fill="none"
            stroke="var(--accent, #c5a059)"
            strokeWidth="3"
            points={simulatedPoints.join(' ')}
          />
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginTop: '8px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(239, 83, 80, 0.9)' }}>
            <span style={{ width: '12px', height: '3px', background: '#ef5350', borderRadius: '2px', display: 'inline-block' }} />
            Baseline Pace ({sym}{Math.round(baselineDailySpend)}/day)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent, #c5a059)' }}>
            <span style={{ width: '12px', height: '3px', background: 'var(--accent, #c5a059)', borderRadius: '2px', display: 'inline-block' }} />
            Simulated Target ({sym}{Math.round(simulatedDailySpend)}/day)
          </div>
        </div>
      </div>

      {/* Sliders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Slider 1: Food Delivery Cutback */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            <span>Cut Food Delivery Spending</span>
            <span style={{ color: 'var(--accent, #c5a059)' }}>{foodCutback}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="75"
            step="5"
            value={foodCutback}
            onChange={(e) => setFoodCutback(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent, #c5a059)', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            Saves ~{sym}{Math.round(dailyFoodSavings * remainingDays)} this month
          </div>
        </div>

        {/* Slider 2: Skip Micro Canteen Runs */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            <span>Skip Canteen Runs / Week</span>
            <span style={{ color: 'var(--accent, #c5a059)' }}>{skipMicroRuns} runs</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={skipMicroRuns}
            onChange={(e) => setSkipMicroRuns(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent, #c5a059)', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            Saves ~{sym}{Math.round(dailyMicroSavings * remainingDays)} this month
          </div>
        </div>

        {/* Slider 3: Planned One-Off Purchase */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            <span>Test Major Purchase</span>
            <span style={{ color: plannedPurchase > 0 ? '#ef5350' : 'rgba(255,255,255,0.5)' }}>{sym}{plannedPurchase}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="250"
            value={plannedPurchase}
            onChange={(e) => setPlannedPurchase(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ef5350', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {plannedPurchase > 0 ? `Impact: +${sym}${Math.round(dailyPurchaseCost)}/day cost` : 'No upcoming purchase'}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(197, 160, 89, 0.08)',
        border: '1px solid rgba(197, 160, 89, 0.2)',
        borderRadius: '12px',
        padding: '12px 16px'
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            Simulated End Balance: <span style={{ color: 'var(--accent, #c5a059)' }}>{sym}{Math.round(netSavingsAtEnd).toLocaleString()}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            Safe daily target limit: {sym}{Math.round(simulatedDailySpend)}/day
          </div>
        </div>

        <button
          onClick={applyTargetAsBudget}
          style={{
            background: 'var(--accent-gradient, linear-gradient(135deg, #c5a059, #dfb76c))',
            color: '#0d1a15',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)'
          }}
        >
          Set Simulated Budget Limit Target 🎯
        </button>
      </div>
    </div>
  );
}
