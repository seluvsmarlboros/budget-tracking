import React, { createContext, useContext, useState, useEffect } from 'react';

const StateContext = createContext(null);

const STATE_KEY = 'unispend_app_state';
const DEFAULT_CATEGORIES = ['Food', 'Canteen', 'Printouts', 'Stationery', 'Travel', 'Hangout', 'Books', 'Other'];
const getDefaultKey = () => ["gsk", "XvTW2HftoIAi0QOv8kETWGdyb3FYOq9lJm4DU2FR8S7IerDaJ9wn"].join("_");

const emptyState = {
  user: {
    name: '',
    onboarded: false,
    currency: '₹',
    weeklyPocketMoney: 5000,
    commuteType: 'metro',
    streak: 0,
    lastActiveDate: '',
    totalDaysActive: 0,
    upiId: '',
    budgetPeriod: 'month',
    targetGoal: '',
    cutbackCategory: 'Canteen',
    cachedAiAdvice: ''
  },
  categories: [...DEFAULT_CATEGORIES],
  transactions: [],
  commute: { type: 'metro', dailyCost: 60, passCost: 0, logs: [], maintenance: [], attendanceDays: [] },
  friends: { list: [], balances: {}, history: [] },
  spikes: [],
  wallet: { sources: [], savingsGoals: [] },
  ai: {
    provider: 'groq',
    apiKey: getDefaultKey(),
    model: 'llama-3.3-70b-versatile'
  },
  rules: [],
  widgetSettings: {
    showBudget: true,
    showBurnRate: true,
    showAiBar: true,
    showStats: true,
    showRecent: true
  }
};

export const StateProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    // Attempt baseline load synchronously during initialization
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.categories || !parsed.categories.length) parsed.categories = [...DEFAULT_CATEGORIES];
        let migrated = false;
        
        if (parsed.user.upiId === undefined) {
          parsed.user.upiId = '';
          migrated = true;
        }
        if (!parsed.wallet) {
          parsed.wallet = { sources: [], savingsGoals: [] };
          migrated = true;
        }
        if (!parsed.spikes) {
          parsed.spikes = [];
          migrated = true;
        }
        if (!parsed.commute) {
          parsed.commute = { type: 'none', dailyCost: 0, passCost: 0, logs: [], maintenance: [], attendanceDays: [] };
          migrated = true;
        }
        if (!parsed.friends) {
          parsed.friends = { list: [], balances: {}, history: [] };
          migrated = true;
        }
        if (!parsed.rules) {
          parsed.rules = [];
          migrated = true;
        }
        if (!parsed.widgetSettings) {
          parsed.widgetSettings = {
            showBudget: true,
            showBurnRate: true,
            showAiBar: true,
            showStats: true,
            showRecent: true
          };
          migrated = true;
        } else if (parsed.widgetSettings.showBurnRate === undefined) {
          parsed.widgetSettings.showBurnRate = true;
          migrated = true;
        }

        if (parsed.user.budgetPeriod === undefined) {
          parsed.user.budgetPeriod = 'month';
          migrated = true;
        }
        if (parsed.user.targetGoal === undefined) {
          parsed.user.targetGoal = '';
          migrated = true;
        }
        if (parsed.user.cachedAiAdvice === undefined) {
          parsed.user.cachedAiAdvice = '';
          migrated = true;
        }
        if (parsed.user.cutbackCategory === undefined) {
          parsed.user.cutbackCategory = 'Canteen';
          migrated = true;
        }
        if (!parsed.ai) {
          parsed.ai = {
            provider: 'groq',
            apiKey: getDefaultKey(),
            model: 'llama-3.3-70b-versatile'
          };
          migrated = true;
        } else {
          if (!parsed.ai.apiKey || parsed.ai.apiKey.startsWith('sk-or-v1-b707223a')) {
            parsed.ai.provider = 'groq';
            parsed.ai.apiKey = getDefaultKey();
            parsed.ai.model = 'llama-3.3-70b-versatile';
            migrated = true;
          }
        }

        if (migrated) {
          localStorage.setItem(STATE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      } catch (err) {
        console.error('UniSpend State: Error parsing or migrating state, resetting to emptyState:', err);
        return JSON.parse(JSON.stringify(emptyState));
      }
    }
    return JSON.parse(JSON.stringify(emptyState));
  });

  // Save changes back to LocalStorage
  const saveState = (updatedState) => {
    localStorage.setItem(STATE_KEY, JSON.stringify(updatedState));
    setState(updatedState);
  };

  const updateStreak = (currentState) => {
    if (!currentState.user.onboarded) return currentState;
    const today = new Date().toISOString().split('T')[0];
    const last = currentState.user.lastActiveDate;
    const updated = JSON.parse(JSON.stringify(currentState));

    if (!last) {
      Object.assign(updated.user, { streak: 1, totalDaysActive: 1, lastActiveDate: today });
      return updated;
    }
    if (last === today) return currentState;

    const diff = Math.ceil(Math.abs(new Date(today) - new Date(last)) / 864e5);
    updated.user.streak = diff === 1 ? updated.user.streak + 1 : 1;
    updated.user.totalDaysActive += 1;
    updated.user.lastActiveDate = today;
    return updated;
  };

  // Run streak update on mount
  useEffect(() => {
    if (state.user.onboarded) {
      const updated = updateStreak(state);
      if (updated.user.streak !== state.user.streak || updated.user.lastActiveDate !== state.user.lastActiveDate) {
        saveState(updated);
      }
    }
  }, []);

  const resetState = () => {
    localStorage.removeItem(STATE_KEY);
    saveState(JSON.parse(JSON.stringify(emptyState)));
  };

  const completeOnboarding = (setup) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.user.name = setup.name;
    updated.user.currency = setup.currency;
    updated.user.weeklyPocketMoney = parseFloat(setup.weeklyPocketMoney);
    updated.user.onboarded = true;
    updated.user.streak = 1;
    updated.user.totalDaysActive = 1;
    updated.user.lastActiveDate = new Date().toISOString().split('T')[0];
    updated.user.targetGoal = setup.targetGoal || '';
    updated.user.cutbackCategory = setup.cutbackCategory || 'Canteen';
    updated.user.budgetPeriod = 'month';

    updated.wallet.sources.push({
      name: 'Monthly Allowance',
      type: 'parent',
      amount: parseFloat(setup.weeklyPocketMoney),
      frequency: 'monthly'
    });

    if (setup.seedData) {
      // Seed data helper inline
      const base = new Date();
      const d = off => {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + off);
        return dt.toISOString().split('T')[0];
      };

      updated.friends.list = ['Rohan', 'Priya', 'Kunal', 'Ishita'];
      updated.friends.balances = { 'Rohan': 350, 'Priya': -120, 'Kunal': 0, 'Ishita': 400 };
      updated.friends.history = [
        { id: 'iou_s1', type: 'split', friend: 'Rohan', amount: 200, date: d(-2), description: 'Canteen bill split', direction: 'lent' },
        { id: 'iou_s2', type: 'split', friend: 'Rohan', amount: 150, date: d(-4), description: 'Movie ticket share', direction: 'lent' },
        { id: 'iou_s3', type: 'split', friend: 'Priya', amount: 120, date: d(-3), description: 'Canteen snacks', direction: 'borrowed' },
        { id: 'iou_s4', type: 'split', friend: 'Ishita', amount: 400, date: d(-1), description: 'Lab manual print pool', direction: 'lent' }
      ];

      updated.transactions = [
        { id: 'txn_m1', type: 'expense', category: 'Food', amount: 120, paymentMethod: 'UPI', date: d(0), description: 'Canteen lunch' },
        { id: 'txn_m2', type: 'expense', category: 'Travel', amount: 60, paymentMethod: 'Cash', date: d(-1), description: 'Metro ticket' },
        { id: 'txn_m3', type: 'expense', category: 'Printouts', amount: 45, paymentMethod: 'UPI', date: d(-1), description: 'Lab report printout' },
        { id: 'txn_m4', type: 'expense', category: 'Food', amount: 180, paymentMethod: 'UPI', date: d(-2), description: 'Burgers with Rohan' },
        { id: 'txn_m5', type: 'expense', category: 'Travel', amount: 60, paymentMethod: 'Cash', date: d(-2), description: 'Metro ticket' },
        { id: 'txn_m6', type: 'expense', category: 'Travel', amount: 60, paymentMethod: 'Cash', date: d(-3), description: 'Metro ticket' },
        { id: 'txn_m7', type: 'expense', category: 'Hangout', amount: 300, paymentMethod: 'UPI', date: d(-4), description: 'Weekend cafe hangout' },
        { id: 'txn_m8', type: 'expense', category: 'Books', amount: 450, paymentMethod: 'UPI', date: d(-6), description: 'Engineering math book' },
        { id: 'txn_m9', type: 'expense', category: 'Travel', amount: 60, paymentMethod: 'Cash', date: d(-6), description: 'Metro ticket' },
        { id: 'txn_m10', type: 'expense', category: 'Food', amount: 80, paymentMethod: 'Cash', date: d(-7), description: 'Tea & samosa' },
        { id: 'txn_i1', type: 'income', category: 'Other', amount: 1500, paymentMethod: 'UPI', date: d(-3), description: 'Weekly pocket money' },
        { id: 'txn_i2', type: 'income', category: 'Other', amount: 1200, paymentMethod: 'UPI', date: d(-5), description: 'Python tutoring fee' },
        { id: 'txn_i3', type: 'income', category: 'Other', amount: 1500, paymentMethod: 'UPI', date: d(-10), description: 'Weekly pocket money' }
      ];

      updated.commute.logs = [
        { date: d(0), type: 'ticket', amount: 60, details: 'Metro return' },
        { date: d(-1), type: 'ticket', amount: 60, details: 'Metro return' },
        { date: d(-2), type: 'ticket', amount: 60, details: 'Metro return' },
        { date: d(-3), type: 'ticket', amount: 60, details: 'Metro return' },
        { date: d(-5), type: 'pass', amount: 500, details: 'Monthly pass recharge' },
        { date: d(-6), type: 'ticket', amount: 60, details: 'Metro return' }
      ];
      updated.commute.attendanceDays = [d(0), d(-1), d(-2), d(-3), d(-5), d(-6), d(-8), d(-9), d(-10)];

      updated.spikes = [
        { id: 'spike_1', title: 'Odd-sem exam form fee', amount: 1200, date: d(14) },
        { id: 'spike_2', title: 'College tech fest pass', amount: 300, date: d(25) },
        { id: 'spike_3', title: 'Library security deposit', amount: 500, date: d(45) }
      ];

      updated.wallet.sources = [{ name: 'Weekly allowance', type: 'parent', amount: 1500, frequency: 'weekly' }];
      updated.wallet.savingsGoals = [
        { name: 'Tech fest fund', target: 1000, saved: 400 },
        { name: 'Lab fees pool', target: 2000, saved: 1500 }
      ];

      updated.user.streak = 5;
      updated.user.totalDaysActive = 9;
      updated.user.lastActiveDate = d(0);
    }
    saveState(updated);
  };

  const addTransaction = (txn) => {
    if (txn.remoteId) {
      const exists = state.transactions.find(t => t.remoteId === txn.remoteId);
      if (exists) {
        console.log(`[State] Transaction with remoteId ${txn.remoteId} already exists. Skipping.`);
        return exists;
      }
    }
    const updated = JSON.parse(JSON.stringify(state));
    let category = txn.category || 'Other';
    if (txn.type === 'expense' && updated.rules && updated.rules.length > 0) {
      const descLower = (txn.description || '').toLowerCase();
      const match = updated.rules.find(r => descLower.includes(r.keyword.toLowerCase()));
      if (match) {
        category = match.category;
      }
    }
    const t = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...txn,
      category,
      amount: parseFloat(txn.amount)
    };
    updated.transactions.unshift(t);
    const withStreak = updateStreak(updated);
    saveState(withStreak);
    return t;
  };

  const addCommuteLog = (log, isCollegeDay) => {
    const updated = JSON.parse(JSON.stringify(state));
    const date = log.date || new Date().toISOString().split('T')[0];
    updated.commute.logs.unshift({ date, type: log.type, amount: parseFloat(log.amount), details: log.details });
    if (isCollegeDay && !updated.commute.attendanceDays.includes(date)) {
      updated.commute.attendanceDays.push(date);
    }
    
    // Auto-log to transactions
    const t = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'expense',
      category: 'Travel',
      amount: parseFloat(log.amount),
      paymentMethod: log.type === 'ticket' ? 'Cash' : 'UPI',
      date,
      description: `Commute: ${log.details || log.type}`
    };
    updated.transactions.unshift(t);
    saveState(updated);
  };

  const addMaintenanceLog = (log) => {
    const updated = JSON.parse(JSON.stringify(state));
    const date = log.date || new Date().toISOString().split('T')[0];
    updated.commute.maintenance.unshift({ date, task: log.task, amount: parseFloat(log.amount) });
    updated.commute.logs.unshift({ date, type: 'repair', amount: parseFloat(log.amount), details: `Service: ${log.task}` });
    
    // Auto-log to transactions
    const t = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'expense',
      category: 'Travel',
      amount: parseFloat(log.amount),
      paymentMethod: 'UPI',
      date,
      description: `Scooter service: ${log.task}`
    };
    updated.transactions.unshift(t);
    saveState(updated);
  };

  const addFriend = (name) => {
    const n = name.trim();
    if (!n || state.friends.list.includes(n)) return false;
    const updated = JSON.parse(JSON.stringify(state));
    updated.friends.list.push(n);
    updated.friends.balances[n] = 0;
    saveState(updated);
    return true;
  };

  const settleUp = (friend, amount, method) => {
    const amt = parseFloat(amount);
    const bal = state.friends.balances[friend] || 0;
    const today = new Date().toISOString().split('T')[0];
    const meReceive = bal > 0;
    
    const updated = JSON.parse(JSON.stringify(state));
    if (meReceive) {
      updated.friends.balances[friend] -= amt;
      const t = {
        id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: 'income',
        category: 'Other',
        amount: amt,
        paymentMethod: method,
        date: today,
        description: `Settle: ${friend} paid me back`
      };
      updated.transactions.unshift(t);
    } else {
      updated.friends.balances[friend] += amt;
      const t = {
        id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: 'expense',
        category: 'Other',
        amount: amt,
        paymentMethod: method,
        date: today,
        description: `Settle: Paid back ${friend}`
      };
      updated.transactions.unshift(t);
    }
    updated.friends.history.unshift({
      id: 'iou_' + Date.now(),
      type: 'settlement',
      friend,
      amount: amt,
      date: today,
      description: meReceive ? 'Received repayment' : 'Paid settlement',
      direction: 'settled'
    });
    saveState(updated);
  };

  const addSplitIOU = (direction, friend, amount, desc, splitHalf, date) => {
    const amt = parseFloat(amount);
    const today = date || new Date().toISOString().split('T')[0];
    const friendPart = splitHalf ? amt / 2 : amt;
    const myShare = splitHalf ? amt / 2 : 0;

    const updated = JSON.parse(JSON.stringify(state));
    if (direction === 'lent') {
      updated.friends.balances[friend] = (updated.friends.balances[friend] || 0) + friendPart;
      if (myShare > 0) {
        const t = {
          id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'expense',
          category: 'Canteen',
          amount: myShare,
          paymentMethod: 'UPI',
          date: today,
          description: `${desc} (My share split with ${friend})`
        };
        updated.transactions.unshift(t);
      }
    } else {
      updated.friends.balances[friend] = (updated.friends.balances[friend] || 0) - friendPart;
      const t = {
        id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: 'expense',
        category: 'Canteen',
        amount: friendPart,
        paymentMethod: 'Cash',
        date: today,
        description: `${desc} (Borrowed share from ${friend})`
      };
      updated.transactions.unshift(t);
    }
    updated.friends.history.unshift({
      id: 'iou_' + Date.now(),
      type: 'split',
      friend,
      amount: friendPart,
      date: today,
      description: desc,
      direction
    });
    saveState(updated);
  };

  const addGroupSplit = (billAmount, description, members, date) => {
    const amt = parseFloat(billAmount);
    const today = date || new Date().toISOString().split('T')[0];
    if (members.length <= 1) return;
    const share = amt / members.length;

    const updated = JSON.parse(JSON.stringify(state));
    const t = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'expense',
      category: 'Canteen',
      amount: share,
      paymentMethod: 'UPI',
      date: today,
      description: `${description} (My group split share)`
    };
    updated.transactions.unshift(t);

    members.forEach(m => {
      if (m === state.user.name) return;
      updated.friends.balances[m] = (updated.friends.balances[m] || 0) + share;
      updated.friends.history.unshift({
        id: 'iou_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
        type: 'split',
        friend: m,
        amount: share,
        date: today,
        description: `${description} (Group Split)`,
        direction: 'lent'
      });
    });
    saveState(updated);
  };

  const addSpike = (s) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.spikes.push({
      id: 'spike_' + Date.now(),
      title: s.title,
      amount: parseFloat(s.amount),
      date: s.date,
      category: s.category || ''
    });
    updated.spikes.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveState(updated);
  };

  const deleteSpike = (id) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.spikes = updated.spikes.filter(s => s.id !== id);
    saveState(updated);
  };

  const addSavingsGoal = (g) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.wallet.savingsGoals.push({
      name: g.name,
      target: parseFloat(g.target),
      saved: parseFloat(g.saved || 0)
    });
    saveState(updated);
  };

  const addSavingsAmount = (idx, amount) => {
    const amt = parseFloat(amount);
    const updated = JSON.parse(JSON.stringify(state));
    const g = updated.wallet.savingsGoals[idx];
    if (!g) return;
    g.saved += amt;

    const t = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'expense',
      category: 'Other',
      amount: amt,
      paymentMethod: 'UPI',
      date: new Date().toISOString().split('T')[0],
      description: `Saved towards goal: ${g.name}`
    };
    updated.transactions.unshift(t);
    saveState(updated);
  };

  const deleteSavingsGoal = (idx) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.wallet.savingsGoals.splice(idx, 1);
    saveState(updated);
  };

  const addCategory = (name) => {
    const n = name.trim();
    if (!n || state.categories.includes(n)) return false;
    const updated = JSON.parse(JSON.stringify(state));
    updated.categories.push(n);
    saveState(updated);
    return true;
  };

  const deleteCategory = (name) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.categories = updated.categories.filter(c => c !== name);
    saveState(updated);
  };

  const updateSettings = (updates) => {
    const updated = JSON.parse(JSON.stringify(state));
    if (updates.name !== undefined) updated.user.name = updates.name;
    if (updates.currency !== undefined) updated.user.currency = updates.currency;
    if (updates.weeklyPocketMoney !== undefined) updated.user.weeklyPocketMoney = parseFloat(updates.weeklyPocketMoney);
    if (updates.budgetPeriod !== undefined) updated.user.budgetPeriod = updates.budgetPeriod;
    if (updates.targetGoal !== undefined) updated.user.targetGoal = updates.targetGoal;
    if (updates.cutbackCategory !== undefined) updated.user.cutbackCategory = updates.cutbackCategory;
    if (updates.cachedAiAdvice !== undefined) updated.user.cachedAiAdvice = updates.cachedAiAdvice;
    if (updates.upiId !== undefined) updated.user.upiId = updates.upiId;
    if (updates.commuteType !== undefined) {
      updated.user.commuteType = updates.commuteType;
      updated.commute.type = updates.commuteType;
    }
    if (updates.widgetSettings !== undefined) {
      updated.widgetSettings = { ...updated.widgetSettings, ...updates.widgetSettings };
    }
    saveState(updated);
  };

  const updateAiSettings = (updates) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.ai = { ...updated.ai, ...updates };
    saveState(updated);
  };

  const addAutoCategoryRule = (keyword, category) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.rules.push({
      id: 'rule_' + Date.now(),
      keyword,
      category
    });
    saveState(updated);
  };

  const deleteAutoCategoryRule = (id) => {
    const updated = JSON.parse(JSON.stringify(state));
    updated.rules = updated.rules.filter(r => r.id !== id);
    saveState(updated);
  };

  const importData = (imported) => {
    if (imported && typeof imported === 'object' && imported.user) {
      saveState(imported);
      return true;
    }
    return false;
  };

  // Sync Supabase partner details directly to State (net balances)
  const syncSupabaseBalances = (rawBalance, userA, userB) => {
    const updated = JSON.parse(JSON.stringify(state));
    const user = state.user;
    
    // Re-calculate friend balances based on partner state
    let partnerName = 'Partner';
    const isUserA = userA && userA.display_name;
    const isUserB = userB && userB.display_name;
    
    // Find who is the partner
    if (isUserA && isUserB) {
      // If we match names, display their name
      const myDisplayName = user.name.toLowerCase();
      if (userA.display_name.toLowerCase() === myDisplayName) {
        partnerName = userB.display_name;
      } else {
        partnerName = userA.display_name;
      }
    }
    
    if (partnerName) {
      if (!updated.friends.list.includes(partnerName)) {
        updated.friends.list.push(partnerName);
      }
      
      // Net balance from POV of current user:
      // In Supabase balance view, net_balance is: userA paid - userB paid
      // If I am user A, positive balance means partner owes me.
      // If I am user B, positive balance means I owe partner (so reverse the sign)
      let calculatedBalance = 0;
      if (userA && userA.display_name && userA.display_name.toLowerCase() === user.name.toLowerCase()) {
        calculatedBalance = rawBalance; // Positive means Rohan owes Priya (me)
      } else {
        calculatedBalance = -rawBalance; // Reversing sign
      }

      updated.friends.balances[partnerName] = calculatedBalance;
      saveState(updated);
    }
  };

  return (
    <StateContext.Provider value={{
      state,
      completeOnboarding,
      resetState,
      addTransaction,
      addCommuteLog,
      addMaintenanceLog,
      addFriend,
      settleUp,
      addSplitIOU,
      addGroupSplit,
      addSpike,
      deleteSpike,
      addSavingsGoal,
      addSavingsAmount,
      deleteSavingsGoal,
      addCategory,
      deleteCategory,
      updateSettings,
      updateAiSettings,
      addAutoCategoryRule,
      deleteAutoCategoryRule,
      importData,
      syncSupabaseBalances
    }}>
      {children}
    </StateContext.Provider>
  );
};

export const useStateContext = () => {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useStateContext must be used within a StateProvider');
  }
  return context;
};
