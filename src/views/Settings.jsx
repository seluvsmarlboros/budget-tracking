import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStateContext } from '../contexts/StateContext';
import { SupabaseService } from '../services/supabase';

export default function Settings() {
  const {
    state,
    updateSettings,
    updateAiSettings,
    resetState,
    importData
  } = useStateContext();

  const { user, ai } = state;

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || '₹');
  const [pocketMoney, setPocketMoney] = useState(user?.weeklyPocketMoney || '');
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [budgetPeriod, setBudgetPeriod] = useState(user?.budgetPeriod || 'month');

  // AI Form State
  const [aiProvider, setAiProvider] = useState(ai?.provider || 'groq');
  const [aiKey, setAiKey] = useState(ai?.apiKey || '');
  const [aiModel, setAiModel] = useState(ai?.model || 'llama-3.3-70b-versatile');

  // App Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('unispend_dark') !== '0');

  // Push Permission State
  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Modal State for Data Reset
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setCurrency(user?.currency || '₹');
    setPocketMoney(user?.weeklyPocketMoney || '');
    setUpiId(user?.upiId || '');
    setBudgetPeriod(user?.budgetPeriod || 'month');

    setAiProvider(ai?.provider || 'groq');
    setAiKey(ai?.apiKey || '');
    setAiModel(ai?.model || 'llama-3.3-70b-versatile');
  }, [state]);

  const handleThemeToggle = (e) => {
    const checked = e.target.checked;
    setIsDarkMode(checked);
    if (checked) {
      document.body.classList.remove('light');
      localStorage.setItem('unispend_dark', '1');
    } else {
      document.body.classList.add('light');
      localStorage.setItem('unispend_dark', '0');
    }
    if (window.toast) window.toast(`Theme updated to ${checked ? 'Dark OLED' : 'Light Mint'}`);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateSettings({
      name,
      currency,
      weeklyPocketMoney: parseFloat(pocketMoney) || 5000,
      upiId,
      budgetPeriod
    });
    if (window.toast) window.toast('Profile & budget settings saved!');
  };

  const handleSaveAi = (e) => {
    e.preventDefault();
    updateAiSettings({
      provider: aiProvider,
      apiKey: aiKey,
      model: aiModel
    });
    if (window.toast) window.toast('AI Assistant settings updated!');
  };

  const handleActivatePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (window.toast) window.toast('Web Push is not supported in this browser.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushStatus(perm);
      if (perm === 'granted') {
        if (window.toast) window.toast('Notifications enabled! UniSpend will alert you of budget spikes & group bills.');
      } else {
        if (window.toast) window.toast('Notification permission was denied in browser settings.');
      }
    } catch (err) {
      if (window.toast) window.toast(`Push setup error: ${err.message}`);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `unispend-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    if (window.toast) window.toast('Data backup exported successfully!');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        importData(parsed);
        if (window.toast) window.toast('State imported successfully!');
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = () => {
    resetState();
    setShowResetModal(false);
    if (window.toast) window.toast('All app data has been reset.');
  };

  return (
    <section id="view-settings" className="view active" style={{ maxWidth: '840px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>App Settings</h1>
        <span className="muted" style={{ fontSize: '13px' }}>Manage your profile preferences, AI options, and data backups</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 1. PROFILE & BUDGET PREFERENCES CARD */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(74, 222, 128, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Account & Budget Profile</h3>
              <span className="muted" style={{ fontSize: '12px' }}>Personalize currency, budget period, and payment details</span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Display Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  required
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Local Currency</label>
                <select
                  className="input-field"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="₹">₹ (INR - Indian Rupee)</option>
                  <option value="$">$ (USD - US Dollar)</option>
                  <option value="€">€ (EUR - Euro)</option>
                  <option value="£">£ (GBP - British Pound)</option>
                  <option value="A$">A$ (AUD - Australian Dollar)</option>
                  <option value="C$">C$ (CAD - Canadian Dollar)</option>
                  <option value="¥">¥ (JPY - Japanese Yen)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Pocket Money Limit</label>
                <input
                  type="number"
                  className="input-field"
                  value={pocketMoney}
                  onChange={(e) => setPocketMoney(e.target.value)}
                  placeholder="e.g. 5000"
                  required
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Budget Cycle</label>
                <select
                  className="input-field"
                  value={budgetPeriod}
                  onChange={(e) => setBudgetPeriod(e.target.value)}
                >
                  <option value="week">Weekly Allowance</option>
                  <option value="month">Monthly Budget</option>
                </select>
              </div>
            </div>

            <div>
              <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>UPI ID (for Circle Debt Settlement)</label>
              <input
                type="text"
                className="input-field"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. alex@upi"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '8px' }}>
                Save Profile Changes
              </button>
            </div>
          </form>
        </div>

        {/* 2. APP PREFERENCES & NOTIFICATIONS CARD */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Appearance & Notifications</h3>
              <span className="muted" style={{ fontSize: '12px' }}>Customize theme mode and instant Web Push alerts</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '14px' }}>Dark OLED Theme</strong>
                <span className="muted" style={{ fontSize: '12px' }}>High-contrast Nordic Obsidian theme for reduced eye strain</span>
              </div>
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={handleThemeToggle}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--emerald)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '14px' }}>Web Push Notifications</strong>
                <span className="muted" style={{ fontSize: '12px' }}>Get real-time browser alerts when friends settle IOUs or spend velocity overheats</span>
              </div>
              <button
                type="button"
                className={`btn ${pushStatus === 'granted' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleActivatePush}
                disabled={pushStatus === 'granted'}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                {pushStatus === 'granted' ? '✓ Push Enabled' : 'Enable Web Push'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. AI NATURAL LANGUAGE ASSISTANT CARD */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>AI Natural Language Engine</h3>
              <span className="muted" style={{ fontSize: '12px' }}>Powers natural language expense parsing and financial advice</span>
            </div>
          </div>

          <form onSubmit={handleSaveAi} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>AI Provider</label>
                <select
                  className="input-field"
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                >
                  <option value="groq">Groq AI (Fastest & Free)</option>
                  <option value="gemini">Google Gemini 2.5 Flash</option>
                  <option value="openrouter">OpenRouter AI</option>
                </select>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Selected Model</label>
                <input
                  type="text"
                  className="input-field"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="e.g. llama-3.3-70b-versatile"
                />
              </div>
            </div>

            <div>
              <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>API Key (Optional / Built-in Default Active)</label>
              <input
                type="password"
                className="input-field"
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder="Leave blank to use built-in Groq key"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '8px' }}>
                Save AI Settings
              </button>
            </div>
          </form>
        </div>

        {/* 4. DATA MANAGEMENT & BACKUP CARD */}
        <div className="card" style={{ padding: '24px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Data Backup & Management</h3>
              <span className="muted" style={{ fontSize: '12px' }}>Export local JSON backups, restore data, or clear cache</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportJSON}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Export JSON Backup
            </button>

            <label className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
              Import JSON Backup
              <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            </label>

            <button
              type="button"
              className="btn"
              onClick={() => setShowResetModal(true)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                marginLeft: 'auto'
              }}
            >
              Reset App Data
            </button>
          </div>
        </div>

      </div>

      {/* DANGER ZONE RESET CONFIRMATION MODAL */}
      {showResetModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px', border: '1px solid rgba(239,68,68,0.4)', position: 'relative' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>Reset All App Data?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              This action will permanently delete your local transactions, circle splits, custom categories, and saved profile settings from browser storage. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirmReset}
                style={{ background: '#ef4444', color: '#fff' }}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
