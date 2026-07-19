import React, { useState, useEffect } from 'react';
import { useStateContext } from '../contexts/StateContext';
import { SupabaseService, supabase } from '../services/supabase';

export default function Onboarding() {
  const { completeOnboarding } = useStateContext();
  
  // Auth flow states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);

  // Profile setup states
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('₹');
  const [budget, setBudget] = useState('5000');
  const [targetGoal, setTargetGoal] = useState('');
  const [cutbackCategory, setCutbackCategory] = useState('Canteen');
  const [seedData, setSeedData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Check initial user authentication
    const checkUser = async () => {
      try {
        const user = await SupabaseService.getCurrentUser();
        if (user) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.log('No Supabase authenticated user found:', err);
      }
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Onboarding auth status change:', event);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setIsAuthenticated(true);
        window.toast('Authenticated successfully! 🎉');
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleMagicLinkSubmit = async (e) => {
    e.preventDefault();
    const mail = email.trim();
    if (!mail) return;

    setIsAuthLoading(true);
    setAuthMessage('');

    try {
      await SupabaseService.sendMagicLink(mail, mail.split('@')[0]);
      setAuthMessage(`Magic link sent! Check your inbox, or enter the 6-digit code below.`);
      setShowOtpForm(true);
      window.toast('Verification code sent! 📧');
    } catch (err) {
      window.toast(`Error sending link: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    const token = otpToken.trim();
    if (!token) return;

    setIsOtpLoading(true);
    try {
      await SupabaseService.verifyOTP(email, token);
      window.toast('Verification successful! 🔑');
      setIsAuthenticated(true);
    } catch (err) {
      window.toast(`Verification failed: ${err.message}`);
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await SupabaseService.signInWithGoogle();
    } catch (err) {
      window.toast(`Google Login Failed: ${err.message}`);
      setIsGoogleLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const valName = name.trim();
    const valBudget = parseFloat(budget);

    if (!valName || isNaN(valBudget) || valBudget <= 0) {
      window.toast('Please fill in your name and pocket money amount.');
      return;
    }

    setIsSaving(true);
    try {
      if (isAuthenticated) {
        try {
          await SupabaseService.updateProfile({ displayName: valName });
        } catch (sErr) {
          console.warn('Supabase remote profile update failed:', sErr);
          window.toast('Profile saved locally (Offline mode).');
        }
      }

      completeOnboarding({
        name: valName,
        currency,
        weeklyPocketMoney: valBudget,
        seedData,
        targetGoal,
        cutbackCategory
      });
      window.toast('Onboarding completed! Welcome to UniSpend.');
      
      // Reload hash routing to home
      location.hash = '#home';
    } catch (err) {
      console.error('Save profile metadata error:', err);
      window.toast(`Error saving profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderAuthStep = () => (
    <div className="card log-form" id="onb-auth-card" style={{ maxWidth: '440px', padding: '32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.7px', marginBottom: '6px' }}>Welcome to UniSpend</h2>
        <p className="muted" style={{ fontSize: '13px', margin: 0 }}>Sync your pocket money, IOU splits, and track expenses across devices.</p>
      </div>

      <button
        type="button"
        className="btn-ghost"
        style={{ width: '100%', height: '48px', fontSize: '14.5px', marginBottom: '16px' }}
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
      >
        {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 20px 0' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>or use email code</span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
      </div>

      <form onSubmit={handleMagicLinkSubmit}>
        <div className="field">
          <label htmlFor="onb-email">College Email Address</label>
          <input
            type="email"
            id="onb-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            required
            disabled={isAuthLoading}
          />
        </div>
        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%', height: '44px', marginBottom: '12px' }}
          disabled={isAuthLoading}
        >
          {isAuthLoading ? 'Sending Link...' : 'Send Magic Link →'}
        </button>
      </form>

      {authMessage && (
        <p className="hint" style={{ fontSize: '12px', textAlign: 'center', color: 'var(--accent)', marginTop: '8px', lineHeight: '1.4' }}>
          {authMessage}
        </p>
      )}

      {showOtpForm && (
        <form onSubmit={handleOtpVerify} style={{ marginTop: '16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>
          <div className="field">
            <label htmlFor="onb-otp">Enter 6-Digit Code</label>
            <input
              type="text"
              id="onb-otp"
              maxLength={6}
              value={otpToken}
              onChange={(e) => setOtpToken(e.target.value)}
              placeholder="e.g. 123456"
              required
              disabled={isOtpLoading}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', height: '44px' }}
            disabled={isOtpLoading}
          >
            {isOtpLoading ? 'Verifying...' : 'Verify Code →'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px', textAlign: 'center' }}>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setIsOffline(true)}
          style={{ padding: '8px 16px', background: 'rgba(255, 255, 255, 0.02)' }}
        >
          Skip Login & Use Offline Mode 🔌
        </button>
      </div>
    </div>
  );

  const renderProfileStep = () => (
    <div className="card log-form" id="onb-profile-card" style={{ maxWidth: '480px', padding: '32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>Complete Your Profile</h2>
        <p className="muted" style={{ fontSize: '13px', margin: 0 }}>Configure your budget details and local currency settings.</p>
      </div>

      <form onSubmit={handleProfileSubmit}>
        <div className="field">
          <label htmlFor="onb-name">Your Display Name</label>
          <input
            type="text"
            id="onb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priyanshu"
            required
            disabled={isSaving}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="onb-currency">Local Currency</label>
            <select
              id="onb-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isSaving}
            >
              <option value="₹">Rupees (₹)</option>
              <option value="$">Dollars ($)</option>
              <option value="€">Euros (€)</option>
              <option value="£">Pounds (£)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="onb-budget">Monthly Pocket Money</label>
            <input
              type="number"
              id="onb-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="5000"
              required
              disabled={isSaving}
              min="1"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="onb-goal">Target Savings Goal (Optional)</label>
          <input
            type="text"
            id="onb-goal"
            value={targetGoal}
            onChange={(e) => setTargetGoal(e.target.value)}
            placeholder="e.g. Save 2000 for exam fests"
            disabled={isSaving}
          />
        </div>

        <div className="field">
          <label htmlFor="onb-cutback">Category to cut back spending</label>
          <select
            id="onb-cutback"
            value={cutbackCategory}
            onChange={(e) => setCutbackCategory(e.target.value)}
            disabled={isSaving}
          >
            <option value="Canteen">Canteen</option>
            <option value="Food">Food</option>
            <option value="Travel">Travel</option>
            <option value="Hangout">Hangout</option>
          </select>
        </div>

        <div className="check-row" style={{ marginTop: '12px' }}>
          <input
            type="checkbox"
            id="onb-seed"
            checked={seedData}
            onChange={(e) => setSeedData(e.target.checked)}
            disabled={isSaving}
          />
          <label htmlFor="onb-seed" style={{ fontSize: '13px', userSelect: 'none' }}>
            Seed sample student data (bills, spikes, friends)
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%', height: '48px', marginTop: '16px', fontSize: '15px' }}
          disabled={isSaving}
        >
          {isSaving ? 'Finishing Up...' : 'Start Tracking →'}
        </button>
      </form>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
      {!isAuthenticated && !isOffline ? renderAuthStep() : renderProfileStep()}
    </div>
  );
}
