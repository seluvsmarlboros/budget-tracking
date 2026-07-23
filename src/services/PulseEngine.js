/**
 * PulseEngine.js — Deterministic proactive insight generator for UniSpend.
 * Scans app state and returns an array of PulseCard objects.
 * No API calls — runs instantly from local state.
 */

import { calculateCircleNetBalance } from '../contexts/StateContext';

/**
 * @param {object} state — full UniSpend state
 * @returns {Array<PulseCard>}
 */
export function generatePulseCards(state) {
  const cards = [];
  const { user, transactions = [], spikes = [], friends, wallet } = state;
  const sym = user?.currency || '₹';
  const now = new Date();

  // ── Budget period setup ──────────────────────────────────────────────────
  const period = user?.budgetPeriod || 'month';
  let periodStart;
  if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    const dow = now.getDay() || 7;
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1, 0, 0, 0, 0);
  }

  const totalDaysInPeriod = period === 'month'
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    : 7;

  const msElapsed = now - periodStart;
  const daysElapsed = Math.max(1, msElapsed / 864e5);
  const pctTimeElapsed = daysElapsed / totalDaysInPeriod;

  const periodExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const budget = (user?.weeklyPocketMoney || 0);
  const pctBudgetSpent = budget > 0 ? periodExpenses / budget : 0;

  // ── 1. BURN RATE ─────────────────────────────────────────────────────────
  // Trigger: >30% budget spent in <15% of period time
  if (pctBudgetSpent > 0.30 && pctTimeElapsed < 0.15 && budget > 0) {
    const remaining = budget - periodExpenses;
    cards.push({
      id: 'pulse_burn',
      type: 'burn_rate',
      icon: '',
      title: 'Heads up — burning fast',
      body: `You've spent ${sym}${Math.round(periodExpenses).toLocaleString('en-IN')} (${Math.round(pctBudgetSpent * 100)}% of budget) in just ${Math.round(pctTimeElapsed * 100)}% of the ${period}. Slow down or you'll run dry early.`,
      action: { label: 'Review Budget', target: '#home' }
    });
  }

  // ── 2. VAMPIRE CHARGES ───────────────────────────────────────────────────
  // Trigger: ≥2 transactions with same amount in same category within 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);
  const recentExpenses = transactions.filter(
    t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= thirtyDaysAgo
  );

  const vampireMap = {};
  recentExpenses.forEach(t => {
    const key = `${t.category}|${t.amount}`;
    vampireMap[key] = (vampireMap[key] || []);
    vampireMap[key].push(t);
  });

  const vampireHits = Object.entries(vampireMap).filter(([, txns]) => txns.length >= 2);
  if (vampireHits.length > 0 && cards.length < 4) {
    const [key, txns] = vampireHits[0];
    const [category, amount] = key.split('|');
    cards.push({
      id: 'pulse_vampire',
      type: 'vampire',
      icon: '',
      title: 'Recurring charge spotted',
      body: `${sym}${parseFloat(amount).toLocaleString('en-IN')} has hit your ${category} ${txns.length}× in the last 30 days. Could be a subscription draining you silently — worth a check.`,
      action: { label: 'View Activity', target: '#activity' }
    });
  }

  // ── 3. CIRCLE & FRIEND RECEIVABLE ───────────────────────────────────────
  // Trigger: any circle net balance < -100 or > 100
  const circlesList = state?.circles?.list || [];
  circlesList.forEach(circle => {
    const circleNet = calculateCircleNetBalance(circle, user?.name || 'Arjun');

    if (circleNet < -100 && cards.length < 4) {
      cards.push({
        id: `pulse_circle_owe_${circle.id}`,
        type: 'circle_owe',
        icon: '',
        title: `You owe ${sym}${Math.abs(Math.round(circleNet))} in ${circle.name}`,
        body: `Use Magic Settle to clear your share with minimum transfers across ${circle.members?.length || 0} group members.`,
        action: { label: `Settle ${circle.name}`, target: '#partner' }
      });
    } else if (circleNet > 100 && cards.length < 4) {
      cards.push({
        id: `pulse_circle_owed_${circle.id}`,
        type: 'circle_owed',
        icon: '',
        title: `You are owed ${sym}${Math.round(circleNet)} in ${circle.name}`,
        body: `Group members have outstanding splits in ${circle.name}. Run Magic Settle to trigger one-click settlements.`,
        action: { label: `View ${circle.name}`, target: '#partner' }
      });
    }
  });

  const friendBalances = friends?.balances || {};
  const bigDebts = Object.entries(friendBalances).filter(([, b]) => b > 500);
  if (bigDebts.length > 0 && cards.length < 4) {
    const [name, amount] = bigDebts[0];
    cards.push({
      id: `pulse_friend_${name}`,
      type: 'friend_receivable',
      icon: '',
      title: `${name} owes you ${sym}${Math.round(amount).toLocaleString('en-IN')}`,
      body: `That's real money sitting uncollected. Nudge ${name} to settle — use the QR in Circles to make it frictionless.`,
      action: { label: `Remind ${name}`, target: '#partner' }
    });
  }

  // ── 4. SPIKE WARNING ─────────────────────────────────────────────────────
  // Trigger: any spike date within 5 days
  const fiveDaysLater = new Date(now.getTime() + 5 * 864e5);
  const urgentSpikes = (spikes || []).filter(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d >= now && d <= fiveDaysLater;
  });

  if (urgentSpikes.length > 0 && cards.length < 4) {
    const spike = urgentSpikes[0];
    const daysUntil = Math.ceil((new Date(spike.date + 'T00:00:00') - now) / 864e5);
    const label = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
    cards.push({
      id: `pulse_spike_${spike.id || spike.title}`,
      type: 'spike_warning',
      icon: '',
      title: `${spike.title} ${label}`,
      body: `${sym}${Math.round(spike.amount).toLocaleString('en-IN')} is due ${label}. Make sure your balance can cover it — freeze discretionary spend today.`,
      action: { label: 'Plan for It', target: '#home' }
    });
  }

  // ── 5. SAVINGS NUDGE ─────────────────────────────────────────────────────
  // Trigger: period surplus > 0 AND at least one incomplete savings goal
  const savingsGoals = wallet?.savingsGoals || [];
  const incompleteGoals = savingsGoals.filter(g => (g.saved || 0) < (g.target || 1));
  const surplus = budget - periodExpenses;

  if (surplus > 100 && incompleteGoals.length > 0 && cards.length < 4) {
    const goal = incompleteGoals[0];
    const needed = (goal.target || 0) - (goal.saved || 0);
    const suggestAmt = Math.min(Math.round(surplus * 0.3), needed);
    cards.push({
      id: `pulse_savings_${goal.name}`,
      type: 'savings_nudge',
      icon: '',
      title: `You're crushing it — save for the ${goal.name}`,
      body: `You have a ${sym}${Math.round(surplus).toLocaleString('en-IN')} surplus this ${period}. Moving even ${sym}${suggestAmt.toLocaleString('en-IN')} toward "${goal.name}" gets you ${Math.round((suggestAmt / needed) * 100)}% closer.`,
      action: { label: 'Move to Savings', target: '#home' }
    });
  }

  return cards;
}
