import React, { useState, useEffect, Component } from 'react';
import { useStateContext } from './contexts/StateContext';

// Import Views
import Overview from './views/Overview';
import Log from './views/Log';
import Friends from './views/Friends';
import Activity from './views/Activity';
import Insights from './views/Insights';
import Settings from './views/Settings';
import Onboarding from './views/Onboarding';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('UniSpend crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
          background: 'var(--bg, #0e0c0b)', color: 'var(--text, #f5f0e8)',
          padding: '24px', textAlign: 'center'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.6, maxWidth: '280px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#home'; }}
            style={{
              marginTop: '8px', padding: '10px 24px', borderRadius: '99px',
              background: 'linear-gradient(135deg, #b08d46, #e6c27e)',
              color: '#0e0c0b', fontWeight: 700, fontSize: '14px',
              border: 'none', cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { state } = useStateContext();
  const [currentHash, setCurrentHash] = useState(() => (location.hash || '#home').replace('#', ''));
  const [showSplash, setShowSplash] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Toast notifier binding
  const triggerToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    window.toast = triggerToast;

    // Handle hash change routing
    const handleHashChange = () => {
      const hash = (location.hash || '#home').replace('#', '');
      setCurrentHash(hash);
    };
    window.addEventListener('hashchange', handleHashChange);

    // Initial dark mode theme validation
    const localDark = localStorage.getItem('unispend_dark');
    if (localDark === '0') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }

    // Fade out splash screen
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 450);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearTimeout(timer);
    };
  }, []);

  if (showSplash) {
    return (
      <div id="splash-screen" className="splash-screen">
        <div className="splash-content">
          <div className="splash-logo">UniSpend</div>
          <div className="splash-spinner"></div>
        </div>
      </div>
    );
  }

  // Show onboarding view if user is not yet onboarded
  if (!state.user.onboarded) {
    return <Onboarding />;
  }

  // Resolve active view
  const renderActiveView = () => {
    switch (currentHash) {
      case 'home':
        return <Overview />;
      case 'add':
        return <Log />;
      case 'partner':
        return <Friends />;
      case 'activity':
        return <Activity />;
      case 'insights':
        return <Insights />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  const navItems = [
    { view: 'home', label: 'Overview', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
    { view: 'add', label: 'Log', icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></> },
    { view: 'partner', label: 'Friends', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
    { view: 'activity', label: 'Activity', icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/> },
    { view: 'insights', label: 'Insights', icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
    { view: 'settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></> }
  ];

  return (
    <div className="app">
      {/* Top Nav / Desktop Sidebar */}
      <nav className="top-nav">
        <div className="nav-inner">
          <span className="brand">UniSpend</span>
          <div className="nav-links">
            {navItems.map(item => (
              <a
                key={item.view}
                href={`#${item.view}`}
                className={`nav-link ${currentHash === item.view ? 'active' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <a
            key={item.view}
            href={`#${item.view}`}
            className={`bnav ${currentHash === item.view ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="main">
        {renderActiveView()}
      </main>

      {/* Toasts Notification Hub */}
      <div className="toasts">
        {toasts.map(toast => (
          <div key={toast.id} className="toast">
            {toast.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
