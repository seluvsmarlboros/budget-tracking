import React, { useState, useMemo } from 'react';
import { useStateContext } from '../contexts/StateContext';

export default function FinancialRadar() {
  const { state, addSpike } = useStateContext();
  const { transactions = [], user = {} } = state;
  const sym = user?.currency || '₹';
  const [dismissed, setDismissed] = useState([]);

  // 1. Detect Subscriptions & Recurring Bills
  const recurringItems = useMemo(() => {
    const counts = {};
    const knownSubs = ['netflix', 'spotify', 'recharge', 'wifi', 'wi-fi', 'rent', 'icloud', 'youtube', 'prime', 'canteen pass', 'gym'];
    
    transactions.forEach(t => {
      const desc = (t.description || t.category || '').toLowerCase();
      const match = knownSubs.find(s => desc.includes(s));
      if (match) {
        if (!counts[match]) {
          counts[match] = { name: t.description || t.category, amount: t.amount, count: 1, lastDate: t.date };
        } else {
          counts[match].count += 1;
          counts[match].amount = t.amount;
          counts[match].lastDate = t.date;
        }
      }
    });

    return Object.values(counts);
  }, [transactions]);

  // 2. Detect Spending Outliers (>2.5x average category spend)
  const categoryAverages = useMemo(() => {
    const totals = {};
    const counts = {};
    transactions.forEach(t => {
      if (t.type === 'expense') {
        totals[t.category] = (totals[t.category] || 0) + t.amount;
        counts[t.category] = (counts[t.category] || 0) + 1;
      }
    });
    const avgs = {};
    Object.keys(totals).forEach(cat => {
      avgs[cat] = totals[cat] / counts[cat];
    });
    return avgs;
  }, [transactions]);

  const spikeOutliers = useMemo(() => {
    const recent = transactions.slice(-15);
    return recent.filter(t => {
      if (t.type !== 'expense') return false;
      const avg = categoryAverages[t.category] || 0;
      return t.amount > 500 && t.amount > avg * 2.2;
    });
  }, [transactions, categoryAverages]);

  // 3. Detect Potential Duplicates
  const duplicates = useMemo(() => {
    const dupes = [];
    const seen = new Set();
    transactions.forEach(t => {
      const key = `${t.date}_${t.amount}_${t.category}_${t.description}`;
      if (seen.has(key)) {
        dupes.push(t);
      } else {
        seen.add(key);
      }
    });
    return dupes;
  }, [transactions]);

  const totalRecurringMonthly = recurringItems.reduce((s, item) => s + item.amount, 0);

  const handleDismiss = (id) => {
    setDismissed(prev => [...prev, id]);
  };

  const handleAddToSpikes = (item) => {
    addSpike({
      title: item.name,
      amount: item.amount,
      date: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]
    });
    if (window.toast) window.toast(`Added ${item.name} (${sym}${item.amount}) to recurring bills!`);
  };

  return (
    <div style={{
      background: 'rgba(18, 16, 14, 0.85)',
      border: '1px solid rgba(197, 160, 89, 0.25)',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      color: '#f5f0e8',
      marginBottom: '24px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #c5a059)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Financial Anomaly & Subscriptions Radar</h3>
        </div>

        {totalRecurringMonthly > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent, #c5a059)', background: 'rgba(197, 160, 89, 0.1)', padding: '4px 10px', borderRadius: '8px' }}>
            {sym}{totalRecurringMonthly.toLocaleString()}/mo Committed
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Section A: Subscriptions */}
        {recurringItems.map((sub, idx) => {
          const id = `sub_${sub.name}_${idx}`;
          if (dismissed.includes(id)) return null;

          return (
            <div key={id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent, #c5a059)', textTransform: 'uppercase' }}>
                    🔄 Auto-Detected Subscription
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>
                  {sub.name} • <span style={{ color: 'var(--accent, #c5a059)' }}>{sym}{sub.amount}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  Logged {sub.count} times • Last active {sub.lastDate}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleAddToSpikes(sub)}
                  style={{
                    background: 'rgba(197,160,89,0.15)',
                    color: 'var(--accent, #c5a059)',
                    border: '1px solid rgba(197,160,89,0.3)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Track Bill
                </button>
                <button
                  onClick={() => handleDismiss(id)}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.4)',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}

        {/* Section B: Outlier Spending Spikes */}
        {spikeOutliers.map((spike) => {
          const id = `spike_${spike.id}`;
          if (dismissed.includes(id)) return null;

          return (
            <div key={id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(239, 83, 80, 0.08)',
              border: '1px solid rgba(239, 83, 80, 0.25)',
              borderRadius: '12px'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef5350', textTransform: 'uppercase' }}>
                  ⚠️ Spending Spike Outlier
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>
                  {spike.description || spike.category} • <span style={{ color: '#ef5350' }}>{sym}{spike.amount}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                  This purchase is &gt;2.2x higher than your average {spike.category} expense
                </div>
              </div>

              <button
                onClick={() => handleDismiss(id)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Acknowledge
              </button>
            </div>
          );
        })}

        {recurringItems.length === 0 && spikeOutliers.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            ✨ All spending radar scans clear. No unusual spikes or untracked subscriptions detected!
          </div>
        )}
      </div>
    </div>
  );
}
