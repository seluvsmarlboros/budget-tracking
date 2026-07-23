import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';
import { SupabaseService } from '../services/supabase';

const PROVIDER_MODELS = {
  openrouter: [
    { val: 'meta-llama/llama-3.3-70b-instruct:free', txt: 'meta-llama/llama-3.3-70b-instruct:free (Recommended - Free)' },
    { val: 'qwen/qwen3-coder:free', txt: 'qwen/qwen3-coder:free (Free)' },
    { val: 'qwen/qwen3-next-80b-a3b-instruct:free', txt: 'qwen/qwen3-next-80b-a3b-instruct:free (Free)' },
    { val: 'meta-llama/llama-3.2-3b-instruct:free', txt: 'meta-llama/llama-3.2-3b-instruct:free (Free)' }
  ],
  gemini: [
    { val: 'gemini-2.5-flash', txt: 'gemini-2.5-flash (Recommended - Free)' },
    { val: 'gemini-1.5-flash', txt: 'gemini-1.5-flash (Free)' },
    { val: 'gemini-2.5-flash-lite', txt: 'gemini-2.5-flash-lite' }
  ],
  groq: [
    { val: 'llama-3.3-70b-versatile', txt: 'llama-3.3-70b-versatile (Recommended - Free)' },
    { val: 'llama-3.1-8b-instant', txt: 'llama-3.1-8b-instant (Free)' },
    { val: 'gemma2-9b-it', txt: 'gemma2-9b-it (Free)' }
  ]
};

export default function Settings() {
  const {
    state,
    updateSettings,
    updateAiSettings,
    addCategory,
    deleteCategory,
    addSavingsGoal,
    addSavingsAmount,
    deleteSavingsGoal,
    addAutoCategoryRule,
    deleteAutoCategoryRule,
    resetState,
    importData
  } = useStateContext();

  const { user, categories, wallet, ai, rules, widgetSettings } = state;
  const sym = user?.currency || '₹';

  // Active tab state
  const [activeTab, setActiveTab] = useState('profile');

  // Modal Visibility States
  const [showCatModal, setShowCatModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [showDeleteGoalModal, setShowDeleteGoalModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Goal & funds selected indexes
  const [selectedGoalIdx, setSelectedGoalIdx] = useState(null);
  const [selectedGoalName, setSelectedGoalName] = useState('');
  const [fundsAmount, setFundsAmount] = useState('');

  // Profile Settings Form State
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || '₹');
  const [pocketMoney, setPocketMoney] = useState(user?.weeklyPocketMoney || '');
  const [commuteType, setCommuteType] = useState(user?.commuteType || 'metro');
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [budgetPeriod, setBudgetPeriod] = useState(user?.budgetPeriod || 'week');
  const [targetGoal, setTargetGoal] = useState(user?.targetGoal || '');
  const [cutbackCategory, setCutbackCategory] = useState(user?.cutbackCategory || 'Canteen');

  // AI Settings Form State
  const [aiProvider, setAiProvider] = useState(ai?.provider || 'groq');
  const [aiKey, setAiKey] = useState(ai?.apiKey || '');
  const [aiModel, setAiModel] = useState(ai?.model || 'llama-3.3-70b-versatile');

  // Sync state values on load or context updates
  useEffect(() => {
    setName(user?.name || '');
    setCurrency(user?.currency || '₹');
    setPocketMoney(user?.weeklyPocketMoney || '');
    setCommuteType(user?.commuteType || 'metro');
    setUpiId(user?.upiId || '');
    setBudgetPeriod(user?.budgetPeriod || 'week');
    setTargetGoal(user?.targetGoal || '');
    setCutbackCategory(user?.cutbackCategory || 'Canteen');

    setAiProvider(ai?.provider || 'groq');
    setAiKey(ai?.apiKey || '');
    setAiModel(ai?.model || 'llama-3.3-70b-versatile');
  }, [state]);

  // Dark mode toggle status
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('unispend_dark') !== '0');

  const handleThemeToggleChange = (e) => {
    const checked = e.target.checked;
    setIsDarkMode(checked);
    if (checked) {
      document.body.classList.remove('light');
      localStorage.setItem('unispend_dark', '1');
    } else {
      document.body.classList.add('light');
      localStorage.setItem('unispend_dark', '0');
    }
  };

  // Sync Supabase user email label and dynamic webhook URL
  const [supabaseEmail, setSupabaseEmail] = useState('');
  const activeUserId = user?.id || '';
  const currentWebhookUrl = `https://${window.location.host}/api/sms-log?userId=${activeUserId || 'local'}`;

  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const handleActivatePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      window.toast('Web Push is not supported in this browser environment.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushStatus(perm);
      if (perm !== 'granted') {
        window.toast('Notification permission was denied in browser settings.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const vapidPublicKey = 'BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ';
      const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
      const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const convertedKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        convertedKey[i] = rawData.charCodeAt(i);
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }
      if (user?.id) {
        await SupabaseService.savePushSubscription(sub);
      }
      window.toast('Web Push Notifications Activated Successfully!');
    } catch (err) {
      console.error(err);
      window.toast(`Push activation error: ${err.message}`);
    }
  };

  const handleTestWebhook = async () => {
    if (!user?.id) {
      window.toast('Please sign in to Supabase first to activate personalized auto-tracking.');
      return;
    }

    // Auto-sync push subscription if permission is granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            const vapidPublicKey = 'BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ';
            const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
            const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const convertedKey = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              convertedKey[i] = rawData.charCodeAt(i);
            }
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey
            });
          }
          if (sub) {
            await SupabaseService.savePushSubscription(sub);
          }
        }
      } catch (subErr) {
        console.warn('Auto-sync push on test webhook warning:', subErr);
      }
    }

    try {
      const res = await fetch(`/api/sms-log?userId=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Rs.150 debited via UPI paid to Canteen Cafe' })
      });
      const text = await res.text();
      if (res.ok) {
        window.toast(`Webhook Test Success: ${text}`);
      } else {
        window.toast(`Webhook Test Response: ${text}`);
      }
    } catch (err) {
      window.toast(`Webhook Test Error: ${err.message}`);
    }
  };

  useEffect(() => {
    const fetchUserEmail = async () => {
      try {
        const u = await SupabaseService.getCurrentUser();
        if (u && u.email) {
          setSupabaseEmail(u.email);
        } else {
          setSupabaseEmail('');
        }
      } catch {
        setSupabaseEmail('');
      }
    };
    fetchUserEmail();
  }, []);

  // Form submit handles
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateSettings({
      name,
      currency,
      weeklyPocketMoney: parseFloat(pocketMoney),
      commuteType,
      upiId,
      budgetPeriod,
      targetGoal,
      cutbackCategory
    });
    window.toast('Profile settings saved.');
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    updateAiSettings({
      provider: aiProvider,
      apiKey: aiKey,
      model: aiModel
    });
    window.toast('AI configurations saved.');
  };

  const handleWidgetToggle = (widgetKey, checked) => {
    updateSettings({
      widgetSettings: {
        ...widgetSettings,
        [widgetKey]: checked
      }
    });
  };

  // Category Add
  const [newCatName, setNewCatName] = useState('');

  const handleAddCatSubmit = (e) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    if (addCategory(cleanName)) {
      window.toast(`Category "${cleanName}" created!`);
      setNewCatName('');
      setShowCatModal(false);
    } else {
      window.toast('Category already exists');
    }
  };

  // Savings Goal Add
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalSaved, setNewGoalSaved] = useState('');

  const handleAddGoalSubmit = (e) => {
    e.preventDefault();
    const gName = newGoalName.trim();
    const gTarget = parseFloat(newGoalTarget);
    const gSaved = parseFloat(newGoalSaved || 0);

    if (!gName || isNaN(gTarget) || gTarget <= 0) return;

    addSavingsGoal({ name: gName, target: gTarget, saved: gSaved });
    window.toast(`Goal "${gName}" initialized.`);
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalSaved('');
    setShowGoalModal(false);
  };

  const handleAddGoalFunds = (idx, gName) => {
    setSelectedGoalIdx(idx);
    setSelectedGoalName(gName);
    setFundsAmount('');
    setShowFundsModal(true);
  };

  const handleAddGoalFundsSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(fundsAmount);
    if (!isNaN(val) && val > 0 && selectedGoalIdx !== null) {
      addSavingsAmount(selectedGoalIdx, val);
      window.toast('Saved successfully.');
      setShowFundsModal(false);
    }
  };

  const handleDeleteGoal = (idx, gName) => {
    setSelectedGoalIdx(idx);
    setSelectedGoalName(gName);
    setShowDeleteGoalModal(true);
  };

  const handleDeleteGoalConfirm = () => {
    if (selectedGoalIdx !== null) {
      deleteSavingsGoal(selectedGoalIdx);
      window.toast('Savings goal deleted.');
      setShowDeleteGoalModal(false);
    }
  };

  // Keyword rules add
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleCat, setRuleCat] = useState('');

  useEffect(() => {
    if (categories && categories.length > 0 && !ruleCat) {
      setRuleCat(categories[0]);
    }
  }, [categories]);

  const handleRuleSubmit = (e) => {
    e.preventDefault();
    const kw = ruleKeyword.trim();
    if (!kw || !ruleCat) return;

    if (rules.some(r => r.keyword.toLowerCase() === kw.toLowerCase())) {
      window.toast('Auto rule already exists for this keyword');
      return;
    }
    addAutoCategoryRule(kw, ruleCat);
    window.toast(`Rule mapped: ${kw} → ${ruleCat}`);
    setRuleKeyword('');
  };

  // System backup and reset
  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `unispend-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    window.toast('Backup saved!');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (importData(parsed)) {
          window.toast('Data restored successfully.');
        } else {
          window.toast('Invalid backup file');
        }
      } catch (err) {
        window.toast(`Failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllDataConfirm = () => {
    resetState();
    window.toast('System reset complete.');
    setShowResetModal(false);
  };

  const getApiKeyLabel = () => {
    if (aiProvider === 'openrouter') return 'OpenRouter API Key';
    if (aiProvider === 'gemini') return 'Google AI Studio API Key';
    return 'Groq API Key';
  };

  const getApiKeyPlaceholder = () => {
    if (aiProvider === 'openrouter') return 'sk-or-v1-...';
    if (aiProvider === 'gemini') return 'AIzaSy...';
    return 'gsk_...';
  };

  const tabsList = [
    { id: 'profile', label: 'Profile Settings' },
    { id: 'ai', label: 'AI Models' },
    { id: 'widgets', label: 'Widgets' },
    { id: 'categories', label: 'Categories' },
    { id: 'goals', label: 'Savings Goals' },
    { id: 'rules', label: 'Auto Rules' },
    { id: 'system', label: 'System & Webhooks' }
  ];

  return (
    <section id="view-settings" className="view active" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header Profile Banner */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(197, 160, 89, 0.06) 100%)',
          borderLeft: '4px solid var(--accent)',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            fontSize: '22px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {name.charAt(0).toUpperCase() || 'U'}
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>{name || 'Student User'}</h2>
          <div style={{ marginTop: '6px' }}>
            {supabaseEmail ? (
              <span
                style={{
                  background: 'rgba(74, 222, 128, 0.12)',
                  color: 'var(--green)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  fontSize: '11.5px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Sync Connected ({supabaseEmail})
              </span>
            ) : (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  fontSize: '11.5px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontWeight: 600
                }}
              >
                Local Offline Mode
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Streak</div>
            <strong style={{ fontSize: '20px', color: 'var(--accent)', fontWeight: 800 }}>{user?.streak || 0}d</strong>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Active</div>
            <strong style={{ fontSize: '20px', color: 'var(--text)', fontWeight: 800 }}>{user?.totalDaysActive || 0}d</strong>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {tabsList.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`pill small ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ flexShrink: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. PROFILE TAB */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Dark Theme Toggle Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'block' }}>Dark Glass Theme</span>
              <span className="muted" style={{ fontSize: '12px' }}>Toggle between dark liquid glass and light mode</span>
            </div>
            <label className="check-row" style={{ margin: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={handleThemeToggleChange}
              />
            </label>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Profile Parameters</h3>
            <form onSubmit={handleProfileSubmit}>
              <div className="field" style={{ marginBottom: '16px' }}>
                <label>Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="field-row" style={{ marginBottom: '16px' }}>
                <div className="field">
                  <label>Currency Symbol</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="₹">Rupee (₹)</option>
                    <option value="$">Dollar ($)</option>
                    <option value="€">Euro (€)</option>
                    <option value="£">Pound (£)</option>
                  </select>
                </div>
                <div className="field">
                  <label>{budgetPeriod === 'month' ? `Monthly Allowance (${currency})` : `Weekly Allowance (${currency})`}</label>
                  <input type="number" value={pocketMoney} onChange={(e) => setPocketMoney(e.target.value)} required />
                </div>
              </div>

              <div className="field-row" style={{ marginBottom: '16px' }}>
                <div className="field">
                  <label>Budget Reset Duration</label>
                  <select value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value)}>
                    <option value="week">Weekly Pocket Money</option>
                    <option value="month">Monthly Pocket Money</option>
                  </select>
                  <span className="hint" style={{ fontSize: '11px', marginTop: '4px', display: 'block', color: 'var(--text-muted)' }}>
                    Allowance resets every {budgetPeriod === 'month' ? 'calendar month' : 'Monday'}.
                  </span>
                </div>
                <div className="field">
                  <label>Default Commute Mode</label>
                  <select value={commuteType} onChange={(e) => setCommuteType(e.target.value)}>
                    <option value="metro">Metro return (₹60)</option>
                    <option value="bus">Bus return (₹30)</option>
                    <option value="petrol">Bike fuel (₹100)</option>
                    <option value="cab">Cab share (₹250)</option>
                    <option value="none">Walk (₹0)</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <label>Your UPI Address (For settlement QR codes)</label>
                <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="username@upi" />
              </div>

              <div className="field-row" style={{ borderTop: '1px dashed var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                <div className="field">
                  <label>AI Target Savings Goal</label>
                  <input type="text" value={targetGoal} onChange={(e) => setTargetGoal(e.target.value)} placeholder="e.g. Save 1000 for exam passes" />
                </div>
                <div className="field">
                  <label>Cutback Target Category</label>
                  <select value={cutbackCategory} onChange={(e) => setCutbackCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '20px' }}>Save Profile Details</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. AI CONFIG TAB */}
      {activeTab === 'ai' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>AI Engine & LLM Configurations</h3>
          <form onSubmit={handleAiSubmit}>
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>AI Provider Service</label>
              <select value={aiProvider} onChange={(e) => {
                const p = e.target.value;
                setAiProvider(p);
                setAiModel(PROVIDER_MODELS[p][0].val);
              }}>
                <option value="groq">Groq Console (Ultra Fast)</option>
                <option value="gemini">Google Gemini API</option>
                <option value="openrouter">OpenRouter Router</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Model Architecture</label>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                {(PROVIDER_MODELS[aiProvider] || []).map(m => (
                  <option key={m.val} value={m.val}>{m.txt}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>{getApiKeyLabel()}</label>
              <input
                type="password"
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder={getApiKeyPlaceholder()}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }}>Save AI Settings</button>
          </form>
        </div>
      )}

      {/* 3. WIDGETS TAB */}
      {activeTab === 'widgets' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Dashboard Widget Visibility</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label className="check-row" style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="checkbox"
                checked={widgetSettings.showBudget !== false}
                onChange={(e) => handleWidgetToggle('showBudget', e.target.checked)}
              />
              Show Allowance Budget progress fill card
            </label>
            <label className="check-row" style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="checkbox"
                checked={widgetSettings.showBurnRate !== false}
                onChange={(e) => handleWidgetToggle('showBurnRate', e.target.checked)}
              />
              Show Spend Burn Rate velocity & forecast
            </label>
            <label className="check-row" style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="checkbox"
                checked={widgetSettings.showAiBar !== false}
                onChange={(e) => handleWidgetToggle('showAiBar', e.target.checked)}
              />
              Show Natural Language AI Command bar
            </label>
            <label className="check-row" style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="checkbox"
                checked={widgetSettings.showStats !== false}
                onChange={(e) => handleWidgetToggle('showStats', e.target.checked)}
              />
              Show Quick Statistics row (commute, IOUs)
            </label>
            <label className="check-row" style={{ cursor: 'pointer', padding: '8px 0' }}>
              <input
                type="checkbox"
                checked={widgetSettings.showRecent !== false}
                onChange={(e) => handleWidgetToggle('showRecent', e.target.checked)}
              />
              Show Recent Activity feed logs
            </label>
          </div>
        </div>
      )}

      {/* 4. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Custom Budget Categories</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCatModal(true)}>+ Add Category</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map(c => (
              <span
                key={c}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                {c}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1, padding: 0 }}
                  onClick={() => {
                    deleteCategory(c);
                    window.toast(`Category "${c}" removed`);
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. SAVINGS GOALS TAB */}
      {activeTab === 'goals' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Savings Goals Runway</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowGoalModal(true)}>+ New Goal</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(!wallet?.savingsGoals || wallet.savingsGoals.length === 0) ? (
              <p className="empty-state" style={{ padding: '20px 0', fontSize: '13px' }}>No active goals. Click + New Goal to start!</p>
            ) : (
              wallet.savingsGoals.map((g, idx) => {
                const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
                return (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14.5px' }}>{g.name}</strong>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{cur(g.saved)} / {cur(g.target)} ({Math.round(pct)}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ height: '100%', background: 'var(--accent-gradient)', width: `${pct}%` }}></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddGoalFunds(idx, g.name)}>+ Add Funds</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteGoal(idx, g.name)}>Delete</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 6. AUTO RULES TAB */}
      {activeTab === 'rules' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700 }}>Auto Category Mapping Rules</h3>
          <p className="muted" style={{ fontSize: '12.5px', lineHeight: 1.4, marginBottom: '16px' }}>Automatically map incoming transaction keywords (e.g., "Uber" → "Travel").</p>

          <form onSubmit={handleRuleSubmit} style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={ruleKeyword}
              onChange={(e) => setRuleKeyword(e.target.value)}
              placeholder="Keyword (e.g. Samosa)"
              required
              style={{ flex: 2, padding: '8px 12px', minWidth: '150px' }}
            />
            <select
              value={ruleCat}
              onChange={(e) => setRuleCat(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', minWidth: '120px' }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="btn-primary" style={{ height: '38px', padding: '0 16px' }}>Add Rule</button>
          </form>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(!rules || rules.length === 0) ? (
              <div className="empty-state" style={{ padding: '16px 0', width: '100%', fontSize: '13px' }}>No mapping rules added yet.</div>
            ) : (
              rules.map(r => (
                <span
                  key={r.id || r.keyword}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    fontSize: '12.5px',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <strong>{r.keyword}</strong> &rarr; <span className="muted">{r.category}</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                    onClick={() => {
                      deleteAutoCategoryRule(r.id || r.keyword);
                      window.toast('Rule removed');
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. SYSTEM & WEBHOOKS TAB */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Push & Webhooks Card */}
          <div className="card" style={{ padding: '24px', background: 'rgba(197, 160, 89, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Push Notifications & Auto-Track Webhook</h3>
                <p className="muted" style={{ fontSize: '12.5px', margin: '4px 0 0 0' }}>Background Web Push alerts & iOS Shortcut auto-logger URL.</p>
              </div>
              <span
                style={{
                  background: pushStatus === 'granted' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                  color: pushStatus === 'granted' ? 'var(--green)' : 'var(--red)',
                  border: '1px solid var(--border)', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 600
                }}
              >
                {pushStatus === 'granted' ? 'Push Granted' : 'Push Disabled'}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleActivatePush}
                style={{ height: '36px', fontSize: '12.5px', padding: '0 16px', fontWeight: 600 }}
              >
                {pushStatus === 'granted' ? 'Re-sync Push Notifications' : 'Enable Push Notifications'}
              </button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', padding: '14px', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  iOS Shortcut Webhook URL
                </span>
                {user?.id ? (
                  <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>
                    ✓ UUID Synced ({user.id.substring(0, 8)}...)
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    (Sign in to sync UUID)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, padding: '8px 10px', fontSize: '11px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '4px', wordBreak: 'break-all', color: 'var(--text-secondary)', minWidth: '200px' }}>
                  {currentWebhookUrl}
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(currentWebhookUrl);
                    window.toast('Copied webhook URL.');
                  }}
                  style={{ flexShrink: 0, height: '34px' }}
                >
                  Copy URL
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleTestWebhook}
                  style={{ flexShrink: 0, height: '34px', color: 'var(--accent)' }}
                >
                  Test Webhook
                </button>
              </div>
            </div>
          </div>

          {/* Backup & System Reset Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>Data Recovery & Reset</h3>
            <p className="muted" style={{ fontSize: '12.5px', lineHeight: 1.45, marginBottom: '20px' }}>Export local data backup, restore JSON state, or reset database.</p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={handleExportBackup}>Export Local Backup</button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = handleImportBackup;
                  input.click();
                }}
              >
                Import Local Backup
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setShowResetModal(true)}>Hard Reset Data</button>
            </div>
          </div>

        </div>
      )}

      {/* Modal: Add Category */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Budget Category</h3>
              <button className="close-btn" onClick={() => setShowCatModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddCatSubmit}>
              <div className="field">
                <label>Category Name</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Subscriptions"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowCatModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Savings Goal */}
      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Savings Goal</h3>
              <button className="close-btn" onClick={() => setShowGoalModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddGoalSubmit}>
              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Goal Name</label>
                <input
                  type="text"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="e.g. Laptop Fund"
                  required
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Target Sum ({sym})</label>
                  <input
                    type="number"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    placeholder="Target"
                    required
                  />
                </div>
                <div className="field">
                  <label>Already Saved ({sym})</label>
                  <input
                    type="number"
                    value={newGoalSaved}
                    onChange={(e) => setNewGoalSaved(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowGoalModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Create Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Funds to Goal */}
      {showFundsModal && (
        <div className="modal-overlay" onClick={() => setShowFundsModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Funds to Goal</h3>
              <button className="close-btn" onClick={() => setShowFundsModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddGoalFundsSubmit}>
              <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>
                Log savings contribution for <strong>{selectedGoalName}</strong>.
              </p>
              <div className="field">
                <label>Contribution Amount ({sym})</label>
                <input
                  type="number"
                  value={fundsAmount}
                  onChange={(e) => setFundsAmount(e.target.value)}
                  placeholder="e.g. 500"
                  required
                  min="0.01"
                  step="any"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowFundsModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add Funds</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Savings Goal */}
      {showDeleteGoalModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteGoalModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3>Delete Savings Goal</h3>
              <button className="close-btn" onClick={() => setShowDeleteGoalModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '20px', lineHeight: 1.45 }}>
              Are you sure you want to delete <strong>"{selectedGoalName}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowDeleteGoalModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDeleteGoalConfirm} style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reset System Data */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--red)' }}>Reset System Data</h3>
              <button className="close-btn" onClick={() => setShowResetModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '20px', lineHeight: 1.45 }}>
              <strong>WARNING:</strong> This will permanently delete ALL transactions, category configurations, savings goals, local settings, and credentials.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowResetModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleResetAllDataConfirm} style={{ flex: 1 }}>Reset Everything</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
