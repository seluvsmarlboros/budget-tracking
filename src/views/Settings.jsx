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
  const sym = user.currency || '₹';

  // Navigation within settings
  const [activeTab, setActiveTab] = useState('profile'); // profile, ai, widgets, categories, goals, system

  // Profile Settings Form State
  const [name, setName] = useState(user.name || '');
  const [currency, setCurrency] = useState(user.currency || '₹');
  const [pocketMoney, setPocketMoney] = useState(user.weeklyPocketMoney || '');
  const [commuteType, setCommuteType] = useState(user.commuteType || 'metro');
  const [upiId, setUpiId] = useState(user.upiId || '');
  const [budgetPeriod, setBudgetPeriod] = useState(user.budgetPeriod || 'week');
  const [targetGoal, setTargetGoal] = useState(user.targetGoal || '');
  const [cutbackCategory, setCutbackCategory] = useState(user.cutbackCategory || 'Canteen');

  // AI Settings Form State
  const [aiProvider, setAiProvider] = useState(ai.provider || 'groq');
  const [aiKey, setAiKey] = useState(ai.apiKey || '');
  const [aiModel, setAiModel] = useState(ai.model || 'llama-3.3-70b-versatile');

  // Sync state values on load or context updates
  useEffect(() => {
    setName(user.name || '');
    setCurrency(user.currency || '₹');
    setPocketMoney(user.weeklyPocketMoney || '');
    setCommuteType(user.commuteType || 'metro');
    setUpiId(user.upiId || '');
    setBudgetPeriod(user.budgetPeriod || 'week');
    setTargetGoal(user.targetGoal || '');
    setCutbackCategory(user.cutbackCategory || 'Canteen');
    
    setAiProvider(ai.provider || 'groq');
    setAiKey(ai.apiKey || '');
    setAiModel(ai.model || 'llama-3.3-70b-versatile');
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

  // Sync Supabase user email label
  const [supabaseEmail, setSupabaseEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('...');
  
  useEffect(() => {
    const fetchUserEmail = async () => {
      try {
        const u = await SupabaseService.getCurrentUser();
        if (u && u.email) {
          setSupabaseEmail(u.email);
          setWebhookUrl(`https://${window.location.host}/api/sms-log?userId=${u.id}`);
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
    window.toast('Profile settings saved! 💾');
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    updateAiSettings({
      provider: aiProvider,
      apiKey: aiKey,
      model: aiModel
    });
    window.toast('AI configurations saved! 🤖');
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
  const catDialogRef = useRef(null);

  const handleAddCatSubmit = (e) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    if (addCategory(cleanName)) {
      window.toast(`Category "${cleanName}" created!`);
      setNewCatName('');
      if (catDialogRef.current) catDialogRef.current.close();
    } else {
      window.toast('Category already exists');
    }
  };

  // Savings Goal Add
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalSaved, setNewGoalSaved] = useState('');
  const goalDialogRef = useRef(null);

  const handleAddGoalSubmit = (e) => {
    e.preventDefault();
    const gName = newGoalName.trim();
    const gTarget = parseFloat(newGoalTarget);
    const gSaved = parseFloat(newGoalSaved || 0);

    if (!gName || isNaN(gTarget) || gTarget <= 0) return;

    addSavingsGoal({ name: gName, target: gTarget, saved: gSaved });
    window.toast(`Goal "${gName}" initialized! 🎯`);
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalSaved('');
    if (goalDialogRef.current) goalDialogRef.current.close();
  };

  const handleAddGoalFunds = (idx) => {
    const val = window.prompt('Enter amount to save towards this goal:');
    if (val && parseFloat(val) > 0) {
      addSavingsAmount(idx, parseFloat(val));
      window.toast('Saved successfully! 🏦');
    }
  };

  const handleDeleteGoal = (idx, gName) => {
    if (window.confirm(`Delete savings goal "${gName}"?`)) {
      deleteSavingsGoal(idx);
      window.toast('Savings goal deleted.');
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
          window.toast('Data restored! Reloading...');
          setTimeout(() => location.reload(), 800);
        } else {
          window.toast('Invalid backup file');
        }
      } catch (err) {
        window.toast(`Failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllData = () => {
    if (window.confirm('WARNING: This will permanently delete ALL transactions, categories, and connected credentials. Continue?')) {
      resetState();
      window.toast('System reset complete.');
      setTimeout(() => location.reload(), 500);
    }
  };

  // Resolve API Key Label
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

  // Settings Tabs List
  const tabsList = [
    { id: 'profile', label: 'User Profile' },
    { id: 'ai', label: 'AI Configurations' },
    { id: 'widgets', label: 'Dashboard widgets' },
    { id: 'categories', label: 'Category Editor' },
    { id: 'goals', label: 'Savings Goals' },
    { id: 'rules', label: 'Auto Category Rules' },
    { id: 'system', label: 'System Recovery' }
  ];

  return (
    <section id="view-settings" className="view active">
      {/* Header Profile summary */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(6, 182, 212, 0.03) 100%)', borderLeft: '4px solid var(--accent)' }}>
        <div id="set-profile-avatar" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {name.charAt(0).toUpperCase() || 'S'}
        </div>
        <div style={{ flex: 1 }}>
          <h2 id="set-profile-name" style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{name || 'Student'}</h2>
          <div id="set-profile-email" style={{ marginTop: '4px' }}>
            {supabaseEmail ? (
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Sync Connected ({supabaseEmail})
              </span>
            ) : (
              <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                Local Offline Mode
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Streak</div>
            <strong id="set-streak" style={{ fontSize: '20px', color: 'var(--accent)' }}>{user.streak || 0}</strong>d
          </div>
          <div>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Active</div>
            <strong id="set-active-days" style={{ fontSize: '20px' }}>{user.totalDaysActive || 0}</strong>d
          </div>
        </div>
      </div>

      {/* Settings layout structure */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
        
        {/* Navigation Tabs bar */}
        <div className="pill-row wrap" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          {tabsList.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`pill small ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Dark Theme Toggle (renders in Profile tab) */}
        {activeTab === 'profile' && (
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Dark Theme Mode</span>
            <label className="check-row" style={{ margin: 0 }}>
              <input
                type="checkbox"
                id="toggle-dark"
                checked={isDarkMode}
                onChange={handleThemeToggleChange}
              />
            </label>
          </div>
        )}

        {/* PROFILE CONFIG */}
        {activeTab === 'profile' && (
          <div className="card settings-group-card" id="settings-group-profile">
            <h3 style={{ marginBottom: '16px' }}>Adjust Profile Settings</h3>
            <form id="settings-form" onSubmit={handleProfileSubmit}>
              <div className="field">
                <label htmlFor="set-name">Display Name</label>
                <input type="text" id="set-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              
              <div className="field-row">
                <div className="field">
                  <label htmlFor="set-currency">Currency Symbol</label>
                  <select id="set-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="₹">Rupee (₹)</option>
                    <option value="$">Dollar ($)</option>
                    <option value="€">Euro (€)</option>
                    <option value="£">Pound (£)</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="set-budget">Allowance Value</label>
                  <input type="number" id="set-budget" value={pocketMoney} onChange={(e) => setPocketMoney(e.target.value)} required />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="set-period">Budget Duration</label>
                  <select id="set-period" value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value)}>
                    <option value="week">Weekly Pocket Money</option>
                    <option value="month">Monthly Pocket Money</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="set-commute">Default Commute Mode</label>
                  <select id="set-commute" value={commuteType} onChange={(e) => setCommuteType(e.target.value)}>
                    <option value="metro">Metro return (₹60)</option>
                    <option value="bus">Bus return (₹30)</option>
                    <option value="petrol">Bike fuel (₹100)</option>
                    <option value="cab">Cab share (₹250)</option>
                    <option value="none">Walk (₹0)</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="set-upi">Your UPI Address (For settlement QR codes)</label>
                <input type="text" id="set-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="username@upi" />
              </div>

              <div className="field-row" style={{ borderTop: '1px dashed var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                <div className="field">
                  <label htmlFor="set-target-goal">AI Target Savings Goal</label>
                  <input type="text" id="set-target-goal" value={targetGoal} onChange={(e) => setTargetGoal(e.target.value)} placeholder="e.g. Save 1000 for exam passes" />
                </div>
                <div className="field">
                  <label htmlFor="set-cutback-category">Cutback Target Category</label>
                  <select id="set-cutback-category" value={cutbackCategory} onChange={(e) => setCutbackCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }}>Save Profile Details</button>
            </form>
          </div>
        )}

        {/* AI CONFIG */}
        {activeTab === 'ai' && (
          <div className="card settings-group-card" id="settings-group-ai">
            <h3 style={{ marginBottom: '16px' }}>Model & API Configurations</h3>
            <form id="ai-settings-form" onSubmit={handleAiSubmit}>
              <div className="field">
                <label htmlFor="set-ai-provider">AI Service Provider</label>
                <select id="set-ai-provider" value={aiProvider} onChange={(e) => {
                  const p = e.target.value;
                  setAiProvider(p);
                  setAiModel(PROVIDER_MODELS[p][0].val);
                }}>
                  <option value="groq">Groq Console (Fastest)</option>
                  <option value="gemini">Google Gemini API</option>
                  <option value="openrouter">OpenRouter Router</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="set-ai-model">AI Model Selection</label>
                <select id="set-ai-model" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                  {(PROVIDER_MODELS[aiProvider] || []).map(m => (
                    <option key={m.val} value={m.val}>{m.txt}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label id="ai-key-label" htmlFor="set-ai-key">{getApiKeyLabel()}</label>
                <input
                  type="password"
                  id="set-ai-key"
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  placeholder={getApiKeyPlaceholder()}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }}>Save AI Provider Settings</button>
            </form>
          </div>
        )}

        {/* WIDGETS CONFIG */}
        {activeTab === 'widgets' && (
          <div className="card settings-group-card" id="settings-group-widgets">
            <h3 style={{ marginBottom: '16px' }}>Dashboard Widget Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="widget-toggle-budget"
                  checked={widgetSettings.showBudget !== false}
                  onChange={(e) => handleWidgetToggle('showBudget', e.target.checked)}
                />
                Show Allowance Budget remaining progress fill
              </label>
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="widget-toggle-burnrate"
                  checked={widgetSettings.showBurnRate !== false}
                  onChange={(e) => handleWidgetToggle('showBurnRate', e.target.checked)}
                />
                Show Spend Burn Rate velocity & runway forecast
              </label>
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="widget-toggle-aibar"
                  checked={widgetSettings.showAiBar !== false}
                  onChange={(e) => handleWidgetToggle('showAiBar', e.target.checked)}
                />
                Show Natural Language Command processor bar
              </label>
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="widget-toggle-stats"
                  checked={widgetSettings.showStats !== false}
                  onChange={(e) => handleWidgetToggle('showStats', e.target.checked)}
                />
                Show Quick statistics row (commute, friend owes)
              </label>
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="widget-toggle-recent"
                  checked={widgetSettings.showRecent !== false}
                  onChange={(e) => handleWidgetToggle('showRecent', e.target.checked)}
                />
                Show Recent activities logs checklist feed
              </label>
            </div>
          </div>
        )}

        {/* CATEGORIES CONFIG */}
        {activeTab === 'categories' && (
          <div className="card settings-group-card" id="settings-group-categories">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Category Editor</h3>
              <button type="button" className="btn btn-ghost btn-sm" id="btn-add-cat" onClick={() => catDialogRef.current?.showModal()}>+ Add Category</button>
            </div>
            
            <div id="cat-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categories.map(c => (
                <span
                  key={c}
                  className="tag"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                >
                  {c}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineheight: 1, padding: 0 }}
                    onClick={() => {
                      deleteCategory(c);
                      window.toast(`Category "${c}" removed`);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SAVINGS GOALS CONFIG */}
        {activeTab === 'goals' && (
          <div className="card settings-group-card" id="settings-group-goals">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Savings Goals runway</h3>
              <button type="button" className="btn btn-ghost btn-sm" id="btn-add-goal" onClick={() => goalDialogRef.current?.showModal()}>+ New Goal</button>
            </div>

            <div id="goals-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(!wallet.savingsGoals || wallet.savingsGoals.length === 0) ? (
                <p className="empty-state" style={{ padding: '16px 0' }}>No active goals. Add one above!</p>
              ) : (
                wallet.savingsGoals.map((g, idx) => {
                  const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
                  return (
                    <div key={idx} className="goal-item" style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius)' }}>
                      <div className="goal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '14.5px' }}>{g.name}</strong>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{cur(g.saved)} / {cur(g.target)}</span>
                      </div>
                      <div className="goal-bar" style={{ height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border)' }}>
                        <div className="goal-fill" style={{ height: '100%', background: 'var(--accent-gradient)', width: `${pct}%` }}></div>
                      </div>
                      <div className="goal-actions" style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddGoalFunds(idx)}>+ Add funds</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteGoal(idx, g.name)}>Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* RULES CONFIG */}
        {activeTab === 'rules' && (
          <div className="card settings-group-card" id="settings-group-rules">
            <h3 style={{ marginBottom: '12px' }}>Automatic Category Mapping Rules</h3>
            <p className="muted" style={{ fontSize: '12.5px', lineHeight: 1.4, marginBottom: '16px' }}>Map transaction descriptions containing specific keywords directly to categories (e.g. mapping "Samosa" to "Food").</p>
            
            <form id="auto-rule-form" onSubmit={handleRuleSubmit} style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                id="rule-keyword"
                value={ruleKeyword}
                onChange={(e) => setRuleKeyword(e.target.value)}
                placeholder="Description Keyword (e.g. Samosa)"
                required
                style={{ flex: 2, padding: '8px 10px', minWidth: '150px' }}
              />
              <select
                id="rule-category"
                value={ruleCat}
                onChange={(e) => setRuleCat(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', minWidth: '120px' }}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="submit" className="btn-primary" style={{ height: '38px', padding: '0 16px' }}>Add Mapping Rule</button>
            </form>

            <div id="rules-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(!rules || rules.length === 0) ? (
                <div className="empty-state" style={{ padding: '12px 0', width: '100%' }}>No active rules. Add one above!</div>
              ) : (
                rules.map(r => (
                  <span
                    key={r.id || r.keyword}
                    className="tag"
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
                      style={{ background: 'none', border: 'none', fontSize: '15px', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                      onClick={() => {
                        deleteAutoCategoryRule(r.id || r.keyword);
                        window.toast('Rule removed');
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* SYSTEM ACTIONS & WEBHOOK CONFIG */}
        {activeTab === 'system' && (
          <div className="card settings-group-card" id="settings-group-system">
            
            {/* iOS Webhook Card */}
            {supabaseEmail && (
              <div id="ios-automation-card" className="card" style={{ display: 'block', background: 'rgba(6, 182, 212, 0.02)', borderColor: 'var(--border-focus)', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 4px 0' }}>iOS Webhook URL</h4>
                <p className="muted" style={{ fontSize: '12px', margin: '0 0 10px 0', lineHeight: 1.4 }}>Paste this webhook URL into your iOS Shortcut to sync bank transaction texts in the background.</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div id="ios-webhook-display" style={{ flex: 1, padding: '8px 10px', fontSize: '11px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '4px', wordBreak: 'break-all' }}>
                    {webhookUrl}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    id="btn-copy-webhook"
                    onClick={async () => {
                      await navigator.clipboard.writeText(webhookUrl);
                      window.toast('Copied webhook URL! 📋');
                    }}
                    style={{ flexShrink: 0, height: '34px', width: 'auto' }}
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            )}

            <h3 style={{ marginBottom: '12px' }}>System Maintenance & Recovery</h3>
            <p className="muted" style={{ fontSize: '12.5px', lineHeight: 1.45, marginBottom: '20px' }}>Back up all transactions and category structures to a JSON file locally, or perform a hard reset.</p>
            
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
              
              <button type="button" className="btn btn-danger" id="btn-reset" onClick={handleResetAllData}>Hard Reset System Data</button>
            </div>
          </div>
        )}

      </div>

      {/* Dialog: Add Category */}
      <dialog id="dialog-cat" className="dialog" ref={catDialogRef}>
        <form onSubmit={handleAddCatSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => catDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Create Budget Category</h3>
          <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Add a new category name for transaction log groupings.</p>
          <div className="field">
            <label htmlFor="inp-cat-name">Category Name</label>
            <input
              type="text"
              id="inp-cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Subscriptions"
              required
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => catDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Add Category</button>
          </div>
        </form>
      </dialog>

      {/* Dialog: Add Savings Goal */}
      <dialog id="dialog-goal" className="dialog" ref={goalDialogRef}>
        <form onSubmit={handleAddGoalSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => goalDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Create Savings Goal</h3>
          <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Configure target parameters to build savings funds.</p>
          
          <div className="field">
            <label htmlFor="goal-name">Savings Goal Name</label>
            <input
              type="text"
              id="goal-name"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              placeholder="e.g. Laptop Fund"
              required
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="goal-target">Target Sum ({sym})</label>
              <input
                type="number"
                id="goal-target"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                placeholder="Target value"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="goal-saved">Already Saved ({sym})</label>
              <input
                type="number"
                id="goal-saved"
                value={newGoalSaved}
                onChange={(e) => setNewGoalSaved(e.target.value)}
                placeholder="Default is 0"
              />
            </div>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => goalDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Save Goal</button>
          </div>
        </form>
      </dialog>

    </section>
  );
}
