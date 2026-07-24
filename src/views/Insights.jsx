import React, { useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';
import WhatIfSimulator from '../components/WhatIfSimulator';
import FinancialRadar from '../components/FinancialRadar';

const FOREST_PALETTE = [
  '#4ADE80', // Spring Mint
  '#22C55E', // Forest Green
  '#166534', // Deep Green
  '#86EFAC', // Light Mint
  '#14532D', // Darkest Pine
  '#BBF7D0'  // Pale Mint
];

export default function Insights() {
  const { state, updateCategoryLimit } = useStateContext();
  const { transactions, user, commute, categoryLimits = {}, categories = [] } = state;
  const sym = user.currency || '₹';

  const cur = (amount) => {
    return sym + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  // 1. DATE PREPARATION
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // 2. MONTHLY EXPENSES COMPUTATIONS
  const thisMonthExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thisMonthStart)
    .reduce((s, t) => s + t.amount, 0);

  const lastMonthExpenses = transactions
    .filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return t.type === 'expense' && d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((s, t) => s + t.amount, 0);

  // Month-over-Month Delta
  let deltaText = '—';
  let deltaClass = 'muted';
  if (lastMonthExpenses > 0) {
    const pct = Math.round(((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100);
    deltaText = (pct >= 0 ? '↑' : '↓') + Math.abs(pct) + '%';
    deltaClass = pct > 0 ? 'red' : 'green';
  }

  // 3. CATEGORY BREAKDOWN (This Month Expenses)
  const byCategory = {};
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thisMonthStart)
    .forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });

  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const catTotal = catEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // 4. PAYMENT METHODS (UPI vs Cash)
  let upiAmt = 0;
  let cashAmt = 0;
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thisMonthStart)
    .forEach(t => {
      if (t.paymentMethod === 'Cash') {
        cashAmt += t.amount;
      } else {
        upiAmt += t.amount;
      }
    });
  const methodTotal = upiAmt + cashAmt || 1;
  const upiPct = Math.round((upiAmt / methodTotal) * 100);
  const cashPct = Math.round((cashAmt / methodTotal) * 100);

  // 5. TRAVEL BREAKDOWN (Commute ticket fares, fuel recharges, repairs)
  let travelTicketFares = 0;
  let travelFuelFares = 0;
  let travelRepairFares = 0;
  const commuteLogs = commute?.logs || [];
  commuteLogs.forEach(l => {
    const d = new Date(l.date + 'T00:00:00');
    if (d < thisMonthStart) return;
    if (l.type === 'ticket' || l.type === 'pass') {
      travelTicketFares += l.amount;
    } else if (l.type === 'fuel') {
      travelFuelFares += l.amount;
    } else if (l.type === 'repair') {
      travelRepairFares += l.amount;
    }
  });

  return (
    <section id="view-insights" className="view active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Analytics & Insights</h1>
      </div>

      {/* Interactive What-If Simulator */}
      <WhatIfSimulator />

      {/* Financial Anomaly Radar */}
      <FinancialRadar />


      {/* Month-over-Month Cards */}
      <div className="stat-row" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <span className="stat-label">Spent This Month</span>
          <span className="stat-value" id="ins-this-month">{cur(thisMonthExpenses)}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Spent Last Month</span>
          <span className="stat-value" id="ins-last-month">{cur(lastMonthExpenses)}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Month-over-Month Delta</span>
          <span className={`stat-value ${deltaClass}`} id="ins-delta">{deltaText}</span>
        </div>
      </div>

      {/* Category Breakdown Bar widget */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '14px' }}>Category Breakdown (This Month)</h3>
        
        {catEntries.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <span className="muted" style={{ fontSize: '13px' }}>No expenses logged this month</span>
          </div>
        ) : (
          <div>
            {/* Visual Segments Bar */}
            <div
              id="cat-bar"
              style={{
                height: '16px',
                width: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                background: 'rgba(255,255,255,0.03)',
                marginBottom: '20px'
              }}
            >
              {catEntries.map(([cat, amt], i) => {
                const pct = (amt / catTotal) * 100;
                const color = FOREST_PALETTE[i % FOREST_PALETTE.length];
                return (
                  <div
                    key={cat}
                    style={{ width: `${pct}%`, background: color }}
                    title={`${cat}: ${cur(amt)} (${Math.round(pct)}%)`}
                  ></div>
                );
              })}
            </div>

            {/* Custom Grid Legend */}
            <div
              id="cat-legend"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                borderTop: '1px solid var(--border)',
                paddingTop: '16px'
              }}
            >
              {catEntries.map(([cat, amt], i) => {
                const color = FOREST_PALETTE[i % FOREST_PALETTE.length];
                const pct = Math.round((amt / catTotal) * 100);
                return (
                  <div
                    key={cat}
                    className="legend-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}
                  >
                    <span
                      className="legend-dot"
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: color,
                        display: 'inline-block',
                        flexShrink: 0
                      }}
                    ></span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cat}: <strong>{cur(amt)}</strong> ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY BUDGETS & SOFT CAPS WIDGET */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Category Budgets & Soft Caps</h3>
            <span className="muted" style={{ fontSize: '12px' }}>Set monthly spending caps per category with automatic visual alerts</span>
          </div>
          <span className="badge badge-mint" style={{ fontSize: '11px', padding: '4px 10px' }}>Real-time Soft Caps</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {categories.map(cat => {
            const spent = byCategory[cat] || 0;
            const cap = categoryLimits[cat] !== undefined ? categoryLimits[cat] : 1500;
            const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
            
            let statusText = 'Cruising';
            let statusBg = 'rgba(74, 222, 128, 0.15)';
            let statusColor = '#4ade80';
            let barColor = 'var(--emerald, #4ade80)';

            if (spent > cap && cap > 0) {
              statusText = 'Cap Exceeded!';
              statusBg = 'rgba(239, 68, 68, 0.15)';
              statusColor = '#ef4444';
              barColor = '#ef4444';
            } else if (pct >= 80) {
              statusText = `Approaching (${pct}%)`;
              statusBg = 'rgba(245, 158, 11, 0.15)';
              statusColor = '#f59e0b';
              barColor = '#f59e0b';
            }

            return (
              <div
                key={cat}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border, rgba(255,255,255,0.08))',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{cat}</span>
                  <span
                    style={{
                      background: statusBg,
                      color: statusColor,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                  >
                    {statusText}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
                  <span>
                    Spent: <strong style={{ color: 'var(--text-main)' }}>{cur(spent)}</strong>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="muted" style={{ fontSize: '11px' }}>Cap: {sym}</span>
                    <input
                      type="number"
                      defaultValue={cap}
                      onBlur={(e) => updateCategoryLimit(cat, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateCategoryLimit(cat, e.target.value); }}
                      style={{
                        width: '70px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-main)',
                        padding: '2px 6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'right'
                      }}
                    />
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: barColor,
                      borderRadius: '99px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="field-row">
        {/* Payment Methods */}
        <div className="card">
          <h3 style={{ marginBottom: '14px' }}>Payment Mode Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>UPI / NetBanking</span>
                <strong id="ins-upi">{cur(upiAmt)} ({upiPct}%)</strong>
              </div>
              <div className="progress-track" style={{ height: '6px' }}>
                <div className="progress-fill" style={{ width: `${upiPct}%` }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>Cash Payments</span>
                <strong id="ins-cash">{cur(cashAmt)} ({cashPct}%)</strong>
              </div>
              <div className="progress-track" style={{ height: '6px' }}>
                <div className="progress-fill" style={{ width: `${cashPct}%`, background: 'var(--text-muted)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Commuter breakdown */}
        <div className="card">
          <h3 style={{ marginBottom: '14px' }}>Commute Cost Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed var(--border)' }}>
              <span className="muted">Tickets & Transit Passes</span>
              <strong id="ins-fares">{cur(travelTicketFares)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed var(--border)' }}>
              <span className="muted">Vehicle Fuel (Petrol)</span>
              <strong id="ins-fuel">{cur(travelFuelFares)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Maintenance & Repairs</span>
              <strong id="ins-repair">{cur(travelRepairFares)}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
