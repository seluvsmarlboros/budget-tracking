import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';
import { askAI } from '../services/ai';

export default function CommandPalette({ isOpen, onClose }) {
  const { state, addTransaction, addFriend, addSplitIOU } = useStateContext();
  const [query, setQuery] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedAction, setParsedAction] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const { transactions = [], friends = {}, circles = {} } = state;
  const friendList = friends?.list || [];
  const circlesList = circles?.list || [];

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setParsedAction(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard shortcut Esc & Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open triggered via App handler
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live natural language parser debouncer
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setParsedAction(null);
      setIsParsing(false);
      return;
    }

    const hasNumber = /\d+/.test(query);
    if (!hasNumber) {
      setParsedAction(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsParsing(true);
      try {
        const res = await askAI(query, state, null, null);
        if (res && res.actions && res.actions.length > 0) {
          setParsedAction({
            rawAction: res.actions[0],
            message: res.message
          });
        } else {
          setParsedAction(null);
        }
      } catch (err) {
        console.error('CommandPalette AI Parse Error:', err);
        setParsedAction(null);
      } finally {
        setIsParsing(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, state]);

  if (!isOpen) return null;

  // Filter app navigation items
  const navActions = [
    { type: 'nav', label: 'Go to Overview', hash: '#home', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { type: 'nav', label: 'Go to Circles', hash: '#partner', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
    { type: 'nav', label: 'Add New Expense', hash: '#add', icon: 'M12 5v14M5 12h14' },
    { type: 'nav', label: 'Go to Activity Feed', hash: '#activity', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    { type: 'nav', label: 'View Financial Insights', hash: '#insights', icon: 'M18 20V10M12 20V4M6 20v-6' },
    { type: 'nav', label: 'Open Settings', hash: '#settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' }
  ].filter(item => item.label.toLowerCase().includes(query.toLowerCase()));

  // Filter matching transactions
  const matchedTxns = query.trim().length > 1
    ? transactions.filter(t => 
        (t.description || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.category || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];

  // Filter matching friends
  const matchedFriends = query.trim().length > 1
    ? friendList.filter(f => (f.name || '').toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : [];

  // Execute Parsed AI Action
  const executeParsedAction = () => {
    if (!parsedAction || !parsedAction.rawAction) return;
    const act = parsedAction.rawAction;

    if (act.action === 'add_transaction') {
      addTransaction({
        type: act.type || 'expense',
        amount: parseFloat(act.amount || 0),
        category: act.category || 'Other',
        description: act.description || 'Quick Log',
        date: act.date || new Date().toISOString().split('T')[0],
        paymentMethod: act.paymentMethod || 'UPI'
      });
      if (window.toast) window.toast(`Logged ${state.user.currency || '₹'}${act.amount} for ${act.description || act.category}!`);
    } else if (act.action === 'add_split') {
      addSplitIOU({
        friend: act.friend,
        amount: parseFloat(act.amount || 0),
        description: act.description || 'Shared Expense',
        direction: act.direction || 'lent',
        splitHalf: act.splitHalf !== false
      });
      if (window.toast) window.toast(`Logged split with ${act.friend}!`);
    }
    onClose();
  };

  const handleNavClick = (hash) => {
    window.location.hash = hash;
    onClose();
  };

  return (
    <div 
      className="cmd-palette-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 5, 5, 0.75)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div 
        className="cmd-palette-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '560px',
          background: 'rgba(18, 16, 14, 0.95)',
          border: '1px solid rgba(197, 160, 89, 0.3)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(197,160,89,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or expense (e.g. 'spent 250 food', 'Priya')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f5f0e8',
              fontSize: '16px',
              fontWeight: 500
            }}
          />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(245,240,232,0.5)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>ESC</span>
        </div>

        {/* Results Container */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '12px 16px' }}>
          {/* AI Parsed Quick-Action Card */}
          {isParsing && (
            <div style={{ padding: '12px', color: 'rgba(197,160,89,0.8)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="spinner-small" /> Parsing natural language request...
            </div>
          )}

          {parsedAction && parsedAction.rawAction && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(18,16,14,0.6))',
              border: '1px solid rgba(197,160,89,0.4)',
              borderRadius: '14px',
              padding: '14px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent, #c5a059)', fontWeight: 700 }}>
                  ⚡ Instant AI Action
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                  {parsedAction.rawAction.action === 'add_transaction' && `Add ${parsedAction.rawAction.type || 'expense'}: ${state?.user?.currency || '₹'}${parsedAction.rawAction.amount} (${parsedAction.rawAction.description || parsedAction.rawAction.category})`}
                  {parsedAction.rawAction.action === 'add_split' && `Split with ${parsedAction.rawAction.friend}: ${state?.user?.currency || '₹'}${parsedAction.rawAction.amount} (${parsedAction.rawAction.description})`}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                  {parsedAction.message}
                </div>
              </div>
              <button
                onClick={executeParsedAction}
                style={{
                  background: 'var(--accent-gradient, linear-gradient(135deg, #c5a059, #dfb76c))',
                  color: '#0d1a15',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Press Enter ↵
              </button>
            </div>
          )}

          {/* Navigation Section */}
          {navActions.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '4px 8px' }}>
                Navigation & Tools
              </div>
              {navActions.map((item, idx) => (
                <div
                  key={item.hash}
                  onClick={() => handleNavClick(item.hash)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #c5a059)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={item.icon} />
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#f5f0e8' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Transactions Results */}
          {matchedTxns.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '4px 8px' }}>
                Matching Expenses
              </div>
              {matchedTxns.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleNavClick('#activity')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{t.description || t.category}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{t.date} • {t.category}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: t.type === 'income' ? '#4caf50' : 'var(--accent, #c5a059)' }}>
                    {t.type === 'income' ? '+' : '-'}{state?.user?.currency || '₹'}{t.amount}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends Results */}
          {matchedFriends.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '4px 8px' }}>
                Friends
              </div>
              {matchedFriends.map((f) => (
                <div
                  key={f.id || f.name}
                  onClick={() => handleNavClick('#partner')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{f.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--accent, #c5a059)' }}>View IOUs →</span>
                </div>
              ))}
            </div>
          )}

          {query.trim().length > 0 && navActions.length === 0 && matchedTxns.length === 0 && matchedFriends.length === 0 && !parsedAction && !isParsing && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              No matches found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
