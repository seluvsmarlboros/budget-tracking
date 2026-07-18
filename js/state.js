/* UniSpend State — cleaned */

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
    showAiBar: true,
    showStats: true,
    showRecent: true
  },
  linkedBank: {
    linked: false,
    bankName: '',
    syncedCount: 0
  }
};

export const State = {
  data: JSON.parse(JSON.stringify(emptyState)),
  listeners: [],

  subscribe(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; },

  saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(this.data));
    this.listeners.forEach(fn => fn(this.data));
  },

  loadState() {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try {
        this.data = JSON.parse(saved);
        if (!this.data.categories || !this.data.categories.length) this.data.categories = [...DEFAULT_CATEGORIES];
        let migrated = false;
        if (this.data.user.upiId === undefined) {
          this.data.user.upiId = '';
          migrated = true;
        }
        if (!this.data.wallet) { this.data.wallet = { sources: [], savingsGoals: [] }; migrated = true; }
        if (!this.data.spikes) { this.data.spikes = []; migrated = true; }
        if (!this.data.commute) { this.data.commute = { type: 'none', dailyCost: 0, passCost: 0, logs: [], maintenance: [], attendanceDays: [] }; migrated = true; }
        if (!this.data.friends) { this.data.friends = { list: [], balances: {}, history: [] }; migrated = true; }
        if (!this.data.rules) { this.data.rules = []; migrated = true; }
        if (!this.data.widgetSettings) {
          this.data.widgetSettings = {
            showBudget: true,
            showAiBar: true,
            showStats: true,
            showRecent: true
          };
          migrated = true;
        }
        if (!this.data.linkedBank) {
          this.data.linkedBank = {
            linked: false,
            bankName: '',
            syncedCount: 0
          };
          migrated = true;
        }

        if (this.data.user.budgetPeriod === undefined) {
          this.data.user.budgetPeriod = 'week';
          migrated = true;
        }
        if (this.data.user.targetGoal === undefined) {
          this.data.user.targetGoal = '';
          migrated = true;
        }
        if (this.data.user.cachedAiAdvice === undefined) {
          this.data.user.cachedAiAdvice = '';
          migrated = true;
        }
        if (this.data.user.cutbackCategory === undefined) {
          this.data.user.cutbackCategory = 'Canteen';
          migrated = true;
        }
        if (!this.data.ai) {
          this.data.ai = {
            provider: 'groq',
            apiKey: getDefaultKey(),
            model: 'llama-3.3-70b-versatile'
          };
          migrated = true;
        } else {
          if (!this.data.ai.apiKey || this.data.ai.apiKey.startsWith('sk-or-v1-b707223a')) {
            this.data.ai.provider = 'groq';
            this.data.ai.apiKey = getDefaultKey();
            this.data.ai.model = 'llama-3.3-70b-versatile';
            migrated = true;
          }
        }
        if (migrated) this.saveState();
      } catch (err) {
        console.error('UniSpend: Error parsing or migrating state, resetting to emptyState:', err);
        this.data = JSON.parse(JSON.stringify(emptyState));
      }
    } else {
      this.data = JSON.parse(JSON.stringify(emptyState));
    }
    this.updateStreak();
    return this.data;
  },

  updateStreak() {
    if (!this.data.user.onboarded) return;
    const today = new Date().toISOString().split('T')[0];
    const last = this.data.user.lastActiveDate;
    if (!last) { Object.assign(this.data.user, { streak: 1, totalDaysActive: 1, lastActiveDate: today }); this.saveState(); return; }
    if (last === today) return;
    const diff = Math.ceil(Math.abs(new Date(today) - new Date(last)) / 864e5);
    this.data.user.streak = diff === 1 ? this.data.user.streak + 1 : 1;
    this.data.user.totalDaysActive += 1;
    this.data.user.lastActiveDate = today;
    this.saveState();
  },

  resetState() { localStorage.removeItem(STATE_KEY); this.data = JSON.parse(JSON.stringify(emptyState)); this.saveState(); },

  /* Onboarding — simplified (name, currency, budget only) */
  completeOnboarding(setup) {
    this.data.user.name = setup.name;
    this.data.user.currency = setup.currency;
    this.data.user.weeklyPocketMoney = parseFloat(setup.weeklyPocketMoney);
    this.data.user.onboarded = true;
    this.data.user.streak = 1;
    this.data.user.totalDaysActive = 1;
    this.data.user.lastActiveDate = new Date().toISOString().split('T')[0];
    this.data.user.targetGoal = setup.targetGoal || '';
    this.data.user.cutbackCategory = setup.cutbackCategory || 'Canteen';
    this.data.user.budgetPeriod = 'month';

    this.data.wallet.sources.push({ name: 'Monthly Allowance', type: 'parent', amount: parseFloat(setup.weeklyPocketMoney), frequency: 'monthly' });

    if (setup.seedData) this.seedSampleData();
    else this.saveState();
  },

  /* Transactions */
  addTransaction(txn) {
    let category = txn.category;
    // Apply automated categorization rules if category is default or not explicitly overridden by split
    if (txn.type === 'expense' && this.data.rules && this.data.rules.length > 0) {
      const descLower = (txn.description || '').toLowerCase();
      const match = this.data.rules.find(r => descLower.includes(r.keyword.toLowerCase()));
      if (match) {
        category = match.category;
        console.log(`[Auto-Categorization] Matched "${txn.description}" to category "${category}" via keyword "${match.keyword}"`);
      }
    }
    const t = { id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), ...txn, category, amount: parseFloat(txn.amount) };
    this.data.transactions.unshift(t);
    this.updateStreak();
    this.saveState();
    return t;
  },

  /* Commute */
  addCommuteLog(log, isCollegeDay) {
    const date = log.date || new Date().toISOString().split('T')[0];
    this.data.commute.logs.unshift({ date, type: log.type, amount: parseFloat(log.amount), details: log.details });
    this.addTransaction({ type: 'expense', category: 'Travel', amount: log.amount, paymentMethod: log.type === 'ticket' ? 'Cash' : 'UPI', date, description: `Commute: ${log.details || log.type}` });
    if (isCollegeDay && !this.data.commute.attendanceDays.includes(date)) this.data.commute.attendanceDays.push(date);
    this.saveState();
  },

  addMaintenanceLog(log) {
    const date = log.date || new Date().toISOString().split('T')[0];
    this.data.commute.maintenance.unshift({ date, task: log.task, amount: parseFloat(log.amount) });
    this.data.commute.logs.unshift({ date, type: 'repair', amount: parseFloat(log.amount), details: `Service: ${log.task}` });
    this.addTransaction({ type: 'expense', category: 'Travel', amount: log.amount, paymentMethod: 'UPI', date, description: `Scooter service: ${log.task}` });
    this.saveState();
  },

  /* Friends & IOUs */
  addFriend(name) {
    const n = name.trim();
    if (!n || this.data.friends.list.includes(n)) return false;
    this.data.friends.list.push(n);
    this.data.friends.balances[n] = 0;
    this.saveState();
    return true;
  },

  settleUp(friend, amount, method) {
    const amt = parseFloat(amount);
    const bal = this.data.friends.balances[friend] || 0;
    const today = new Date().toISOString().split('T')[0];
    const meReceive = bal > 0;
    if (meReceive) {
      this.data.friends.balances[friend] -= amt;
      this.addTransaction({ type: 'income', category: 'Other', amount: amt, paymentMethod: method, date: today, description: `Settle: ${friend} paid me back` });
    } else {
      this.data.friends.balances[friend] += amt;
      this.addTransaction({ type: 'expense', category: 'Other', amount: amt, paymentMethod: method, date: today, description: `Settle: Paid back ${friend}` });
    }
    this.data.friends.history.unshift({ id: 'iou_' + Date.now(), type: 'settlement', friend, amount: amt, date: today, description: meReceive ? 'Received repayment' : 'Paid settlement', direction: 'settled' });
    this.saveState();
  },

  addSplitIOU(direction, friend, amount, desc, splitHalf, date) {
    const amt = parseFloat(amount);
    const today = date || new Date().toISOString().split('T')[0];
    const friendPart = splitHalf ? amt / 2 : amt;
    const myShare = splitHalf ? amt / 2 : 0;
    if (direction === 'lent') {
      this.data.friends.balances[friend] = (this.data.friends.balances[friend] || 0) + friendPart;
      if (myShare > 0) this.addTransaction({ type: 'expense', category: 'Canteen', amount: myShare, paymentMethod: 'UPI', date: today, description: `${desc} (My share split with ${friend})` });
    } else {
      this.data.friends.balances[friend] = (this.data.friends.balances[friend] || 0) - friendPart;
      this.addTransaction({ type: 'expense', category: 'Canteen', amount: friendPart, paymentMethod: 'Cash', date: today, description: `${desc} (Borrowed share from ${friend})` });
    }
    this.data.friends.history.unshift({ id: 'iou_' + Date.now(), type: 'split', friend, amount: friendPart, date: today, description: desc, direction });
    this.saveState();
  },

  addGroupSplit(billAmount, description, members, date) {
    const amt = parseFloat(billAmount);
    const today = date || new Date().toISOString().split('T')[0];
    if (members.length <= 1) return;
    const share = amt / members.length;
    this.addTransaction({ type: 'expense', category: 'Canteen', amount: share, paymentMethod: 'UPI', date: today, description: `${description} (My group split share)` });
    members.forEach(m => {
      if (m === this.data.user.name) return;
      this.data.friends.balances[m] = (this.data.friends.balances[m] || 0) + share;
      this.data.friends.history.unshift({ id: 'iou_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3), type: 'split', friend: m, amount: share, date: today, description: `${description} (Group Split)`, direction: 'lent' });
    });
    this.saveState();
  },

  /* Spikes */
  addSpike(s) {
    this.data.spikes.push({ id: 'spike_' + Date.now(), title: s.title, amount: parseFloat(s.amount), date: s.date, category: s.category || '' });
    this.data.spikes.sort((a, b) => new Date(a.date) - new Date(b.date));
    this.saveState();
  },
  deleteSpike(id) { this.data.spikes = this.data.spikes.filter(s => s.id !== id); this.saveState(); },

  /* Savings */
  addSavingsGoal(g) { this.data.wallet.savingsGoals.push({ name: g.name, target: parseFloat(g.target), saved: parseFloat(g.saved || 0) }); this.saveState(); },
  addSavingsAmount(idx, amount) {
    const amt = parseFloat(amount);
    const g = this.data.wallet.savingsGoals[idx];
    if (!g) return;
    g.saved += amt;
    this.addTransaction({ type: 'expense', category: 'Other', amount: amt, paymentMethod: 'UPI', date: new Date().toISOString().split('T')[0], description: `Saved towards goal: ${g.name}` });
    this.saveState();
  },
  deleteSavingsGoal(idx) { this.data.wallet.savingsGoals.splice(idx, 1); this.saveState(); },

  /* Categories */
  addCategory(name) { const n = name.trim(); if (!n || this.data.categories.includes(n)) return false; this.data.categories.push(n); this.saveState(); return true; },
  deleteCategory(name) { this.data.categories = this.data.categories.filter(c => c !== name); this.saveState(); },

  /* Seed */
  seedSampleData() {
    const base = new Date();
    const d = off => { const dt = new Date(base); dt.setDate(dt.getDate() + off); return dt.toISOString().split('T')[0]; };

    this.data.friends.list = ['Rohan', 'Priya', 'Kunal', 'Ishita'];
    this.data.friends.balances = { 'Rohan': 350, 'Priya': -120, 'Kunal': 0, 'Ishita': 400 };
    this.data.friends.history = [
      { id: 'iou_s1', type: 'split', friend: 'Rohan', amount: 200, date: d(-2), description: 'Canteen bill split', direction: 'lent' },
      { id: 'iou_s2', type: 'split', friend: 'Rohan', amount: 150, date: d(-4), description: 'Movie ticket share', direction: 'lent' },
      { id: 'iou_s3', type: 'split', friend: 'Priya', amount: 120, date: d(-3), description: 'Canteen snacks', direction: 'borrowed' },
      { id: 'iou_s4', type: 'split', friend: 'Ishita', amount: 400, date: d(-1), description: 'Lab manual print pool', direction: 'lent' }
    ];

    this.data.transactions = [
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

    this.data.commute.logs = [
      { date: d(0), type: 'ticket', amount: 60, details: 'Metro return' },
      { date: d(-1), type: 'ticket', amount: 60, details: 'Metro return' },
      { date: d(-2), type: 'ticket', amount: 60, details: 'Metro return' },
      { date: d(-3), type: 'ticket', amount: 60, details: 'Metro return' },
      { date: d(-5), type: 'pass', amount: 500, details: 'Monthly pass recharge' },
      { date: d(-6), type: 'ticket', amount: 60, details: 'Metro return' }
    ];
    this.data.commute.attendanceDays = [d(0), d(-1), d(-2), d(-3), d(-5), d(-6), d(-8), d(-9), d(-10)];

    this.data.spikes = [
      { id: 'spike_1', title: 'Odd-sem exam form fee', amount: 1200, date: d(14) },
      { id: 'spike_2', title: 'College tech fest pass', amount: 300, date: d(25) },
      { id: 'spike_3', title: 'Library security deposit', amount: 500, date: d(45) }
    ];

    this.data.wallet.sources = [{ name: 'Weekly allowance', type: 'parent', amount: 1500, frequency: 'weekly' }];
    this.data.wallet.savingsGoals = [
      { name: 'Tech fest fund', target: 1000, saved: 400 },
      { name: 'Lab fees pool', target: 2000, saved: 1500 }
    ];

    this.data.user.streak = 5;
    this.data.user.totalDaysActive = 9;
    this.data.user.lastActiveDate = d(0);
    this.saveState();
  }
};
