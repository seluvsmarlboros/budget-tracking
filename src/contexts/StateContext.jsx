import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const StateContext = createContext(null);

const STATE_KEY = 'unispend_app_state';
const DEFAULT_CATEGORIES = ['Food', 'Canteen', 'Printouts', 'Stationery', 'Travel', 'Hangout', 'Books', 'Other'];
const getDefaultKey = () => ["gsk", "XvTW2HftoIAi0QOv8kETWGdyb3FYOq9lJm4DU2FR8S7IerDaJ9wn"].join("_");

export const defaultCirclesSeed = (userName = 'Arjun') => [
  {
    id: 'circle_apt4b',
    name: 'Apartment 4B',
    icon: 'building',
    inviteCode: 'APT4B8',
    createdAt: new Date().toISOString().split('T')[0],
    members: [
      { id: 'u_user', name: userName, isGhost: false },
      { id: 'u_priya', name: 'Priya', isGhost: false, upiId: 'priya@upi' },
      { id: 'u_karan', name: 'Karan', isGhost: false, upiId: 'karan@upi' },
      { id: 'u_rahul', name: 'Rahul', isGhost: true }
    ],
    transactions: [
      { id: 'ctxn_1', title: 'Pizza', totalAmount: 600, paidBy: 'Priya', date: new Date().toISOString().split('T')[0], category: 'Food', splits: { [userName]: 150, 'Priya': 150, 'Karan': 150, 'Rahul': 150 } },
      { id: 'ctxn_2', title: 'Wi-Fi bill settlement', totalAmount: 150, paidBy: userName, recipient: 'Priya', date: new Date(Date.now() - 2 * 864e5).toISOString().split('T')[0], category: 'Income', isSettlement: true, splits: { [userName]: -150, 'Priya': 150 } }
    ]
  },
  {
    id: 'circle_goa',
    name: 'Goa Trip',
    icon: 'beach',
    inviteCode: 'GOATRIP',
    createdAt: new Date().toISOString().split('T')[0],
    members: [
      { id: 'u_user', name: userName, isGhost: false },
      { id: 'u_neha', name: 'Neha', isGhost: false },
      { id: 'u_rohit', name: 'Rohit', isGhost: false },
      { id: 'u_m1', name: 'Simran', isGhost: true },
      { id: 'u_m2', name: 'Aman', isGhost: true },
      { id: 'u_m3', name: 'Vikas', isGhost: true }
    ],
    transactions: [
      { id: 'ctxn_3', title: 'Resort pool booking', totalAmount: 1200, paidBy: 'Neha', date: new Date(Date.now() - 864e5).toISOString().split('T')[0], category: 'Travel', splits: { [userName]: 200, 'Neha': 200, 'Rohit': 200, 'Simran': 200, 'Aman': 200, 'Vikas': 200 } }
    ]
  },
  {
    id: 'circle_canteen',
    name: 'Canteen Gang',
    icon: 'coffee',
    inviteCode: 'CANTEEN',
    createdAt: new Date().toISOString().split('T')[0],
    members: [
      { id: 'u_user', name: userName, isGhost: false },
      { id: 'u_rohit', name: 'Rohit', isGhost: false },
      { id: 'u_m4', name: 'Kabir', isGhost: true },
      { id: 'u_m5', name: 'Sneha', isGhost: true },
      { id: 'u_m6', name: 'Dev', isGhost: true }
    ],
    transactions: [
      { id: 'ctxn_4', title: 'Breakfast', totalAmount: 300, paidBy: 'Rohit', date: new Date(Date.now() - 864e5).toISOString().split('T')[0], category: 'Food', splits: { [userName]: 60, 'Rohit': 60, 'Kabir': 60, 'Sneha': 60, 'Dev': 60 } }
    ]
  }
];

export const calculateCircleNetBalance = (circle, userName = 'Arjun') => {
  if (!circle || !circle.transactions || circle.transactions.length === 0) return 0;
  let net = 0;
  const targetUser = (userName || 'Arjun').trim().toLowerCase();

  circle.transactions.forEach(t => {
    const paidBy = (t.paidBy || '').trim().toLowerCase();
    const recipient = (t.recipient || '').trim().toLowerCase();
    const amt = parseFloat(t.totalAmount || 0);

    if (t.isSettlement) {
      if (paidBy === targetUser) {
        net += amt;
      } else if (recipient === targetUser) {
        net -= amt;
      }
    } else {
      let mySplit = 0;
      if (t.splits) {
        Object.entries(t.splits).forEach(([k, val]) => {
          if (k.trim().toLowerCase() === targetUser) {
            mySplit = parseFloat(val || 0);
          }
        });
      }

      if (paidBy === targetUser) {
        net += (amt - mySplit);
      } else {
        net -= mySplit;
      }
    }
  });

  return Math.round(net);
};

export const calculateMagicSettle = (circle) => {
  if (!circle || !circle.members || circle.members.length === 0) return [];
  const memberBalances = {};
  const nameMap = {};

  circle.members.forEach(m => {
    const canon = m.name.trim();
    const lower = canon.toLowerCase();
    memberBalances[lower] = 0;
    nameMap[lower] = canon;
  });

  (circle.transactions || []).forEach(t => {
    const amt = parseFloat(t.totalAmount || 0);
    const paidByLower = (t.paidBy || '').trim().toLowerCase();
    const recipientLower = (t.recipient || '').trim().toLowerCase();

    if (t.isSettlement) {
      if (memberBalances[paidByLower] !== undefined) memberBalances[paidByLower] += amt;
      if (recipientLower && memberBalances[recipientLower] !== undefined) memberBalances[recipientLower] -= amt;
    } else {
      if (memberBalances[paidByLower] !== undefined) memberBalances[paidByLower] += amt;

      Object.entries(t.splits || {}).forEach(([mName, share]) => {
        const mLower = mName.trim().toLowerCase();
        if (memberBalances[mLower] !== undefined) {
          memberBalances[mLower] -= parseFloat(share || 0);
        }
      });
    }
  });

  const debtors = [];
  const creditors = [];

  Object.entries(memberBalances).forEach(([lower, bal]) => {
    const rounded = Math.round(bal * 100) / 100;
    const name = nameMap[lower] || lower;
    if (rounded < -0.5) debtors.push({ name, amount: -rounded });
    else if (rounded > 0.5) creditors.push({ name, amount: rounded });
  });

  const settlements = [];
  let dIdx = 0, cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: Math.round(amount * 100) / 100
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.5) dIdx++;
    if (creditor.amount < 0.5) cIdx++;
  }

  return settlements;
};

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
    cachedAiAdvice: '',
    pulseCards: [],
    pulseLastScanned: 0
  },
  categories: [...DEFAULT_CATEGORIES],
  transactions: [],
  commute: { type: 'metro', dailyCost: 60, passCost: 0, logs: [], maintenance: [], attendanceDays: [] },
  friends: { list: [], balances: {}, history: [] },
  circles: { activeCircleId: null, list: [] },
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
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('State is null or invalid type');
        }
        let migrated = false;
        if (!parsed.user) {
          parsed.user = { ...emptyState.user };
          migrated = true;
        }
        if (!parsed.categories || !parsed.categories.length) parsed.categories = [...DEFAULT_CATEGORIES];
        
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
        if (!parsed.user.pulseCards) {
          parsed.user.pulseCards = [];
          migrated = true;
        }
        if (parsed.user.pulseLastScanned === undefined) {
          parsed.user.pulseLastScanned = 0;
          migrated = true;
        }
        // Fix: Ensure friends state exists
        if (!parsed.friends) {
          parsed.friends = { list: [], balances: {}, history: [] };
          migrated = true;
        }
        if (!parsed.friends.balances) {
          parsed.friends.balances = {};
          migrated = true;
        }
        if (!parsed.circles) {
          parsed.circles = { activeCircleId: null, list: [] };
          migrated = true;
        } else if (parsed.circles.list && parsed.circles.list.length > 0) {
          const currentUserName = parsed.user?.name || 'Arjun';
          parsed.circles.list.forEach(c => {
            c.members?.forEach(m => {
              if (m.id === 'u_user' && m.name !== currentUserName) {
                const oldName = m.name;
                m.name = currentUserName;
                migrated = true;
                (c.transactions || []).forEach(t => {
                  if (t.paidBy === oldName) t.paidBy = currentUserName;
                  if (t.recipient === oldName) t.recipient = currentUserName;
                  if (t.splits && t.splits[oldName] !== undefined) {
                    t.splits[currentUserName] = t.splits[oldName];
                    delete t.splits[oldName];
                  }
                });
              }
            });
          });
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
        return structuredClone(emptyState);
      }
    }
    return structuredClone(emptyState);
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
    const updated = structuredClone(currentState);

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

  // Run streak update, auth user ID sync, push subscription, and notification listener
  const notificationSub = useRef(null);

  useEffect(() => {
    // 1. Sync Supabase Auth User ID to global state
    const syncAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id && authUser.id !== state.user.id) {
          setState(prev => {
            const next = { ...prev, user: { ...prev.user, id: authUser.id, email: authUser.email } };
            saveState(next);
            return next;
          });
        }
      } catch (e) {
        console.warn('Auth sync error:', e);
      }
    };
    syncAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id && session.user.id !== state.user.id) {
        setState(prev => {
          const next = { ...prev, user: { ...prev.user, id: session.user.id, email: session.user.email } };
          saveState(next);
          return next;
        });
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [state.user.id]);

  // 2. Service Worker Registration & Web Push Subscription
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[PWA] Service Worker registered scope:', reg.scope);
        if (state.user.id && 'PushManager' in window && reg.pushManager) {
          reg.pushManager.getSubscription().then(async (sub) => {
            if (!sub) {
              try {
                const vapidPublicKey = 'BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ';
                const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
                const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const convertedKey = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                  convertedKey[i] = rawData.charCodeAt(i);
                }
                const newSub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: convertedKey
                });
                await SupabaseService.savePushSubscription(newSub);
                console.log('[PWA] Push subscription saved to profile');
              } catch (err) {
                console.log('[PWA] Push subscription skipped or denied:', err.message);
              }
            } else {
              await SupabaseService.savePushSubscription(sub).catch(() => {});
            }
          }).catch(err => console.log('[PWA] PushManager check error:', err));
        }
      }).catch(err => console.error('[PWA] SW registration failed:', err));
    }
  }, [state.user.id]);

  // 3. Streak & Realtime Auto-Track Listener
  useEffect(() => {
    if (state.user.onboarded) {
      const updated = updateStreak(state);
      if (updated.user.streak !== state.user.streak || updated.user.lastActiveDate !== state.user.lastActiveDate) {
        saveState(updated);
      }

      // Realtime listener for auto-track webhooks (pending_transaction notifications)
      if (state.user.id && !notificationSub.current) {
        notificationSub.current = supabase
          .channel(`user-notifications:${state.user.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${state.user.id}` },
            (payload) => {
              if (payload.new && payload.new.type === 'pending_transaction') {
                try {
                  const txn = JSON.parse(payload.new.message);
                  addTransaction(txn);
                  window.toast(`Auto-tracked: ${txn.description} (${state.user.currency}${txn.amount}) 💸`);
                } catch (e) {
                  console.error('Failed to parse auto-track notification:', e);
                }
              }
            }
          )
          .subscribe();
      }
    }

    return () => {
      if (notificationSub.current) {
        notificationSub.current.unsubscribe();
        notificationSub.current = null;
      }
    };
  }, [state.user.onboarded, state.user.id]);

  const resetState = () => {
    localStorage.removeItem(STATE_KEY);
    saveState(structuredClone(emptyState));
  };

  const completeOnboarding = (setup) => {
    const updated = structuredClone(state);
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

    const newName = setup.name;
    if (setup.seedData) {
      updated.circles = {
        activeCircleId: 'circle_apt4b',
        list: defaultCirclesSeed(newName)
      };
    } else {
      updated.circles = {
        activeCircleId: null,
        list: []
      };
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
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
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
    
    const updated = structuredClone(state);
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

    const updated = structuredClone(state);
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

    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
    updated.spikes = updated.spikes.filter(s => s.id !== id);
    saveState(updated);
  };

  const addSavingsGoal = (g) => {
    const updated = structuredClone(state);
    updated.wallet.savingsGoals.push({
      name: g.name,
      target: parseFloat(g.target),
      saved: parseFloat(g.saved || 0)
    });
    saveState(updated);
  };

  const addSavingsAmount = (idx, amount) => {
    const amt = parseFloat(amount);
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
    updated.wallet.savingsGoals.splice(idx, 1);
    saveState(updated);
  };

  const addCategory = (name) => {
    const n = name.trim();
    if (!n || state.categories.includes(n)) return false;
    const updated = structuredClone(state);
    updated.categories.push(n);
    saveState(updated);
    return true;
  };

  const deleteCategory = (name) => {
    const updated = structuredClone(state);
    // 1. Remove from categories list
    updated.categories = updated.categories.filter(c => c !== name);
    // 2. Cascade update transactions
    updated.transactions = (updated.transactions || []).map(t => {
      if (t.category === name) {
        return { ...t, category: 'Other' };
      }
      return t;
    });
    // 3. Cascade update auto-category rules
    updated.rules = (updated.rules || []).map(r => {
      if (r.category === name) {
        return { ...r, category: 'Other' };
      }
      return r;
    });
    // 4. Update cutbackCategory if it matches
    if (updated.user.cutbackCategory === name) {
      updated.user.cutbackCategory = 'Other';
    }
    saveState(updated);
  };

  const updateSettings = (updates) => {
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
    updated.ai = { ...updated.ai, ...updates };
    saveState(updated);
  };

  const updatePulseCache = (cards) => {
    const updated = structuredClone(state);
    updated.user.pulseCards = cards;
    updated.user.pulseLastScanned = Date.now();
    saveState(updated);
  };

  const addAutoCategoryRule = (keyword, category) => {
    const updated = structuredClone(state);
    updated.rules.push({
      id: 'rule_' + Date.now(),
      keyword,
      category
    });
    saveState(updated);
  };

  const deleteAutoCategoryRule = (id) => {
    const updated = structuredClone(state);
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
    const updated = structuredClone(state);
    const user = state.user;
    
    // Re-calculate friend balances based on partner state
    let partnerName = 'Partner';
    const isUserA = userA && userA.display_name;
    const isUserB = userB && userB.display_name;
    
    // Find who is the partner
    if (isUserA && isUserB) {
      // If we match names, display their name
      const myDisplayName = (user?.name || '').toLowerCase();
      if ((userA.display_name || '').toLowerCase() === myDisplayName) {
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
      if (userA && userA.display_name && (userA.display_name.toLowerCase() === (user?.name || '').toLowerCase())) {
        calculatedBalance = rawBalance; // Positive means Rohan owes Priya (me)
      } else {
        calculatedBalance = -rawBalance; // Reversing sign
      }

      updated.friends.balances[partnerName] = calculatedBalance;
      saveState(updated);
    }
  };

  // Sync Supabase partner bill history into local friends.history (deduped by remoteId)
  const syncPartnerHistory = (partnerName, entries) => {
    if (!partnerName || !entries || entries.length === 0) return;
    const updated = structuredClone(state);

    // Ensure partner is in friends list
    if (!updated.friends.list.includes(partnerName)) {
      updated.friends.list.push(partnerName);
      updated.friends.balances[partnerName] = 0;
    }

    // Merge entries, skipping any that already exist by remoteId
    const existingRemoteIds = new Set(
      updated.friends.history.filter(h => h.remoteId).map(h => h.remoteId)
    );

    let added = 0;
    for (const entry of entries) {
      if (entry.remoteId && existingRemoteIds.has(entry.remoteId)) continue;
      updated.friends.history.unshift({
        id: 'iou_sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        remoteId: entry.remoteId || null,
        type: entry.type || 'split',
        friend: partnerName,
        amount: parseFloat(entry.amount) || 0,
        date: entry.date || new Date().toISOString().split('T')[0],
        description: entry.description || 'Synced expense',
        direction: entry.direction || 'lent'
      });
      added++;
    }

    if (added > 0) {
      saveState(updated);
    }
  };

  const executeEqualize = (trans) => {
    if (!trans || trans.length === 0) return;
    const updated = structuredClone(state);
    const today = new Date().toISOString().split('T')[0];

    trans.forEach(t => {
      const amt = parseFloat(t.amount);
      if (updated.friends.balances[t.from] !== undefined) {
        updated.friends.balances[t.from] -= amt;
      }
      if (updated.friends.balances[t.to] !== undefined) {
        updated.friends.balances[t.to] += amt;
      }

      updated.friends.history.unshift({
        id: 'iou_eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'settlement',
        friend: t.from,
        amount: amt,
        date: today,
        description: `Equalized: Paid ${t.to} directly`,
        direction: 'settled'
      });
      updated.friends.history.unshift({
        id: 'iou_eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'settlement',
        friend: t.to,
        amount: amt,
        date: today,
        description: `Equalized: Received from ${t.from} directly`,
        direction: 'settled'
      });
    });

    saveState(updated);
  };

  const createCircle = (name, icon = 'building', initialMembers = []) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const updated = structuredClone(state);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const myName = state.user.name || 'Arjun';

    const members = [{ id: 'u_' + Date.now(), name: myName, isGhost: false }];
    initialMembers.forEach(m => {
      const mName = (typeof m === 'string' ? m : m.name || '').trim();
      if (mName && mName !== myName && !members.some(existing => existing.name.toLowerCase() === mName.toLowerCase())) {
        members.push({
          id: 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: mName,
          isGhost: typeof m === 'object' && m.isGhost !== undefined ? m.isGhost : true,
          upiId: typeof m === 'object' ? m.upiId || '' : ''
        });
      }
    });

    const newCircle = {
      id: 'circle_' + Date.now(),
      name: trimmed,
      icon,
      inviteCode: code,
      createdAt: new Date().toISOString().split('T')[0],
      members,
      transactions: []
    };

    if (!updated.circles) updated.circles = { activeCircleId: null, list: [] };
    updated.circles.list.unshift(newCircle);
    updated.circles.activeCircleId = newCircle.id;
    saveState(updated);
    return newCircle;
  };

  const joinCircle = (inviteCode) => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return false;
    const updated = structuredClone(state);
    if (!updated.circles) updated.circles = { activeCircleId: null, list: [] };

    let found = updated.circles.list.find(c => c.inviteCode === code);
    if (!found) {
      found = {
        id: 'circle_joined_' + Date.now(),
        name: `Circle (${code})`,
        icon: 'users',
        inviteCode: code,
        createdAt: new Date().toISOString().split('T')[0],
        members: [
          { id: 'u_me', name: state.user.name || 'Arjun', isGhost: false },
          { id: 'u_host', name: 'Circle Host', isGhost: false }
        ],
        transactions: []
      };
      updated.circles.list.unshift(found);
    }
    updated.circles.activeCircleId = found.id;
    saveState(updated);
    return found;
  };

  const addCircleTransaction = (circleId, txn) => {
    const updated = structuredClone(state);
    const circle = (updated.circles?.list || []).find(c => c.id === circleId);
    if (!circle) return false;

    const newTxn = {
      id: 'ctxn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: txn.title,
      totalAmount: parseFloat(txn.totalAmount),
      paidBy: txn.paidBy || state.user.name || 'Arjun',
      recipient: txn.recipient || null,
      isSettlement: txn.isSettlement || false,
      date: txn.date || new Date().toISOString().split('T')[0],
      category: txn.category || (txn.isSettlement ? 'Income' : 'Food'),
      splits: txn.splits || {}
    };

    if (!circle.transactions) circle.transactions = [];
    circle.transactions.unshift(newTxn);

    // Global transaction mirroring (only for regular expenses, not debt settlements)
    if (!newTxn.isSettlement) {
      const myName = state.user.name || 'Arjun';
      const myShare = newTxn.splits[myName] || 0;
      if (newTxn.paidBy === myName) {
        updated.transactions.unshift({
          id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'expense',
          category: newTxn.category,
          amount: myShare,
          paymentMethod: 'UPI',
          date: newTxn.date,
          description: `${newTxn.title} (${circle.name} Circle)`
        });
      } else if (myShare > 0) {
        updated.transactions.unshift({
          id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'expense',
          category: newTxn.category,
          amount: myShare,
          paymentMethod: 'UPI',
          date: newTxn.date,
          description: `${newTxn.title} (Your share in ${circle.name})`
        });
      }
    }

    saveState(updated);
    return true;
  };

  const addCircleMember = (circleId, memberName, isGhost = true, upiId = '') => {
    const name = memberName.trim();
    if (!name) return false;
    const updated = structuredClone(state);
    const circle = (updated.circles?.list || []).find(c => c.id === circleId);
    if (!circle) return false;

    const existingMember = circle.members.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (existingMember) {
      if (existingMember.isGhost && !isGhost) {
        existingMember.isGhost = false;
        if (upiId) existingMember.upiId = upiId;
        saveState(updated);
        return true;
      }
      return false;
    }

    circle.members.push({
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name,
      isGhost,
      upiId
    });
    saveState(updated);
    return true;
  };

  const mergeGhostMember = (circleId, ghostName, realUserName) => {
    const updated = structuredClone(state);
    const circle = (updated.circles?.list || []).find(c => c.id === circleId);
    if (!circle) return false;

    const ghostIndex = circle.members.findIndex(m => m.name === ghostName && m.isGhost);
    if (ghostIndex === -1) return false;

    circle.members[ghostIndex].name = realUserName;
    circle.members[ghostIndex].isGhost = false;

    (circle.transactions || []).forEach(t => {
      if (t.paidBy === ghostName) t.paidBy = realUserName;
      if (t.splits && t.splits[ghostName] !== undefined) {
        t.splits[realUserName] = t.splits[ghostName];
        delete t.splits[ghostName];
      }
    });

    saveState(updated);
    return true;
  };

  const setActiveCircle = (circleId) => {
    const updated = structuredClone(state);
    if (!updated.circles) updated.circles = { activeCircleId: null, list: [] };
    updated.circles.activeCircleId = circleId;
    saveState(updated);
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
      updatePulseCache,
      addAutoCategoryRule,
      deleteAutoCategoryRule,
      importData,
      syncSupabaseBalances,
      syncPartnerHistory,
      executeEqualize,
      createCircle,
      joinCircle,
      addCircleTransaction,
      addCircleMember,
      mergeGhostMember,
      setActiveCircle
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
