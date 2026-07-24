import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStateContext, calculateCircleNetBalance, calculateMagicSettle } from '../contexts/StateContext';

export default function Circles() {
  const {
    state,
    createCircle,
    joinCircle,
    addCircleTransaction,
    addCircleMember,
    removeCircleMember,
    editCircle,
    deleteCircle,
    setActiveCircle
  } = useStateContext();

  const userName = state?.user?.name || 'Arjun';
  const sym = state?.user?.currency || '₹';

  // Circles list
  const circlesList = state?.circles?.list || [];
  const activeCircleId = state?.circles?.activeCircleId || (circlesList[0]?.id || null);
  const activeCircle = circlesList.find(c => c.id === activeCircleId) || circlesList[0];

  // UI Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAddTxnModal, setShowAddTxnModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [showEditCircleModal, setShowEditCircleModal] = useState(false);
  const [showMagicSettleModal, setShowMagicSettleModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Form states - Create Circle
  const [newCircleName, setNewCircleName] = useState('');
  const [newCircleIcon, setNewCircleIcon] = useState('building');
  const [initialMembers, setInitialMembers] = useState(['']);

  // Edit Circle State
  const [editNameInput, setEditNameInput] = useState('');
  const [editIconInput, setEditIconInput] = useState('building');

  // Join Circle State
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Log Expense Form States (Flexible Splitting Engine)
  const [txnTitle, setTxnTitle] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnPaidBy, setTxnPaidBy] = useState(userName);
  const [txnCategory, setTxnCategory] = useState('Food');
  const [splitMode, setSplitMode] = useState('equal'); // 'equal' | 'exact' | 'percentage'
  const [selectedParticipants, setSelectedParticipants] = useState({}); // { [memberName]: boolean }
  const [customSplits, setCustomSplits] = useState({}); // { [memberName]: number/string }

  // Manage Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberUpi, setNewMemberUpi] = useState('');

  // Settle Modal State
  const [settleDirection, setSettleDirection] = useState('pay'); // 'pay' vs 'receive'
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  // Sync edit form with active circle
  useEffect(() => {
    if (activeCircle) {
      setEditNameInput(activeCircle.name || '');
      setEditIconInput(activeCircle.icon || 'building');
    }
  }, [activeCircleId]);

  // Initialize selected participants when active circle or txn modal changes
  useEffect(() => {
    if (activeCircle && activeCircle.members) {
      const initialMap = {};
      const initialCustom = {};
      activeCircle.members.forEach(m => {
        initialMap[m.name] = true;
        initialCustom[m.name] = '';
      });
      setSelectedParticipants(initialMap);
      setCustomSplits(initialCustom);
      setTxnPaidBy(userName);
    }
  }, [activeCircleId, showAddTxnModal]);

  // Icon SVG Helper
  const getCircleIconSVG = (iconType) => {
    switch (iconType) {
      case 'beach':
      case 'trip':
        return (
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
          </div>
        );
      case 'coffee':
      case 'canteen':
        return (
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            </svg>
          </div>
        );
      case 'building':
      case 'apartment':
      default:
        return (
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(74, 222, 128, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald)', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="18" x2="15" y2="18"/>
            </svg>
          </div>
        );
    }
  };

  // Active circle net balance
  const activeNetBalance = useMemo(() => {
    return activeCircle ? calculateCircleNetBalance(activeCircle, userName) : 0;
  }, [activeCircle, userName]);

  // Magic settle list for active circle
  const activeMagicSettles = useMemo(() => {
    return activeCircle ? calculateMagicSettle(activeCircle) : [];
  }, [activeCircle]);

  // Handlers
  const handleCreateCircleSubmit = (e) => {
    e.preventDefault();
    if (!newCircleName.trim()) return;
    const members = initialMembers
      .filter(m => m.trim())
      .map(m => ({ name: m.trim(), isGhost: true }));

    const circle = createCircle(newCircleName, newCircleIcon, members);
    if (circle) {
      if (window.toast) window.toast(`Created Circle "${circle.name}"!`);
      setNewCircleName('');
      setInitialMembers(['']);
      setShowCreateModal(false);
    }
  };

  const handleJoinCircleSubmit = (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const circle = joinCircle(joinCodeInput);
    if (circle) {
      if (window.toast) window.toast(`Joined ${circle.name}!`);
      setJoinCodeInput('');
      setShowJoinModal(false);
    }
  };

  const handleEditCircleSubmit = (e) => {
    e.preventDefault();
    if (!activeCircle || !editNameInput.trim()) return;
    editCircle(activeCircle.id, editNameInput, editIconInput);
    if (window.toast) window.toast(`Updated Circle details!`);
    setShowEditCircleModal(false);
  };

  const handleDeleteCircle = (circleId, circleName) => {
    if (window.confirm(`Are you sure you want to delete "${circleName}"? This action cannot be undone.`)) {
      deleteCircle(circleId);
      if (window.toast) window.toast(`Deleted Circle "${circleName}"`);
    }
  };

  const handleAddTxnSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(txnAmount);
    if (!txnTitle.trim() || !amt || amt <= 0 || !activeCircle) return;

    const checkedMembers = (activeCircle.members || []).filter(m => selectedParticipants[m.name]);
    if (checkedMembers.length === 0) {
      alert('Please select at least one member who shared this expense.');
      return;
    }

    const splits = {};
    if (splitMode === 'equal') {
      const share = Math.round((amt / checkedMembers.length) * 100) / 100;
      checkedMembers.forEach(m => {
        splits[m.name] = share;
      });
    } else if (splitMode === 'exact') {
      let sum = 0;
      checkedMembers.forEach(m => {
        const val = parseFloat(customSplits[m.name]) || 0;
        splits[m.name] = val;
        sum += val;
      });
      if (Math.abs(sum - amt) > 1) {
        alert(`The sum of exact splits (${sym}${sum}) does not match total expense (${sym}${amt}).`);
        return;
      }
    } else if (splitMode === 'percentage') {
      let sumPct = 0;
      checkedMembers.forEach(m => {
        const pct = parseFloat(customSplits[m.name]) || 0;
        sumPct += pct;
        splits[m.name] = Math.round((amt * (pct / 100)) * 100) / 100;
      });
      if (Math.abs(sumPct - 100) > 0.5) {
        alert(`The sum of split percentages (${sumPct}%) must equal 100%.`);
        return;
      }
    }

    addCircleTransaction(activeCircle.id, {
      title: txnTitle,
      totalAmount: amt,
      paidBy: txnPaidBy,
      category: txnCategory,
      splits
    });

    if (window.toast) window.toast(`Logged "${txnTitle}" in ${activeCircle.name}!`);
    setTxnTitle('');
    setTxnAmount('');
    setShowAddTxnModal(false);
  };

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!newMemberName.trim() || !activeCircle) return;
    const success = addCircleMember(activeCircle.id, newMemberName, true, newMemberUpi);
    if (success) {
      if (window.toast) window.toast(`Added ${newMemberName} to ${activeCircle.name}`);
      setNewMemberName('');
      setNewMemberUpi('');
    } else {
      if (window.toast) window.toast(`Member already exists!`);
    }
  };

  const handleRemoveMember = (memberName) => {
    if (!activeCircle) return;
    removeCircleMember(activeCircle.id, memberName);
    if (window.toast) window.toast(`Removed ${memberName} from circle`);
  };

  const handleSettleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0 || !activeCircle) return;

    const payee = settlePayee || (activeCircle.members?.find(m => m.name !== userName)?.name || 'Member');
    const isPay = settleDirection === 'pay';

    addCircleTransaction(activeCircle.id, {
      title: isPay ? `Payment to ${payee}` : `Received from ${payee}`,
      totalAmount: amt,
      paidBy: isPay ? userName : payee,
      recipient: isPay ? payee : userName,
      isSettlement: true,
      category: 'Income',
      splits: {
        [userName]: isPay ? -amt : amt,
        [payee]: isPay ? amt : -amt
      }
    });

    if (window.toast) window.toast(`Recorded settlement of ${sym}${amt} with ${payee}!`);
    setSettleAmount('');
    setShowSettleModal(false);
  };

  return (
    <section id="view-circles" className="view active" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* 1. HEADER CONTROL BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>UniSpend Circles</h1>
          <span className="muted" style={{ fontSize: '13px' }}>Real-time group bill splitting & net balance engine</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddTxnModal(true)}
            disabled={!activeCircle}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Split Expense
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCreateModal(true)}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
          >
            Create Circle
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowJoinModal(true)}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
          >
            Join with Code
          </button>
        </div>
      </div>

      {/* 2. MAIN BENTO GRID LAYOUT */}
      <div className="circles-grid-layout">
        
        {/* LEFT COLUMN: ACTIVE WORKSPACE & ACTIVITY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {activeCircle ? (
            /* ACTIVE CIRCLE HERO CARD */
            <div className="card" style={{ padding: '24px', border: '1px solid var(--border-highlight)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {getCircleIconSVG(activeCircle.icon)}
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{activeCircle.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span className="muted" style={{ fontSize: '12px' }}>{activeCircle.members?.length || 0} Members</span>
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeCircle.inviteCode);
                          if (window.toast) window.toast(`Copied invite code: ${activeCircle.inviteCode}`);
                        }}
                        style={{
                          background: 'rgba(197, 160, 89, 0.15)',
                          border: '1px solid rgba(197, 160, 89, 0.3)',
                          color: 'var(--accent, #c5a059)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Code: {activeCircle.inviteCode} 📋
                      </button>
                    </div>
                  </div>
                </div>

                {/* Net balance pill */}
                <div>
                  <span className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Your Net Balance</span>
                  <strong style={{ fontSize: '20px', fontWeight: 800, color: activeNetBalance === 0 ? 'var(--text-muted)' : activeNetBalance > 0 ? '#4ade80' : '#ef4444' }}>
                    {activeNetBalance === 0 ? `${sym}0 (Settled)` : activeNetBalance > 0 ? `+${sym}${activeNetBalance}` : `-${sym}${Math.abs(activeNetBalance)}`}
                  </strong>
                </div>
              </div>

              {/* Members List Badges */}
              <div style={{ marginBottom: '20px' }}>
                <span className="muted" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>CIRCLE MEMBERS</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(activeCircle.members || []).map(m => (
                    <div
                      key={m.name}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '99px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.name === userName ? 'var(--emerald)' : 'var(--text-muted)' }} />
                      {m.name} {m.name === userName && '(You)'}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="circles-action-toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowSettleModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Settle Up
                </button>

                <button
                  type="button"
                  onClick={() => setShowMagicSettleModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ⚡ Magic Settle Matrix
                </button>

                <button
                  type="button"
                  onClick={() => setShowManageMembersModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  👥 Manage Members
                </button>

                <button
                  type="button"
                  onClick={() => setShowEditCircleModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <span className="muted" style={{ fontSize: '14px' }}>No active circle selected. Create or join a circle to start splitting bills.</span>
            </div>
          )}

          {/* CIRCLE ACTIVITY FEED */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Circle Shared Transactions</h3>

            {!activeCircle || !activeCircle.transactions || activeCircle.transactions.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <span className="muted" style={{ fontSize: '13px' }}>No shared expenses logged in this circle yet. Click "+ Split Expense" above!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeCircle.transactions.map(t => {
                  const isUserPaid = t.paidBy === userName;
                  const myShare = t.splits?.[userName] || 0;

                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '8px',
                          background: t.isSettlement ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: t.isSettlement ? 'var(--emerald)' : 'var(--text-main)',
                          fontSize: '14px', fontWeight: 700, flexShrink: 0
                        }}>
                          {t.isSettlement ? '✓' : (t.category?.[0] || 'S')}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <strong style={{ display: 'block', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</strong>
                          <span className="muted" style={{ fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            Paid by <strong>{t.paidBy}</strong> • {t.date}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <strong style={{ fontSize: '13.5px', display: 'block', whiteSpace: 'nowrap' }}>{sym}{t.totalAmount}</strong>
                        <span className="muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {isUserPaid ? `You lent ${sym}${t.totalAmount - myShare}` : `Your share: ${sym}${myShare}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CIRCLE LIST & MAGIC SETTLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CIRCLES LIST SELECTOR */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700 }}>Your Circles ({circlesList.length})</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {circlesList.map(c => {
                const isSelected = activeCircleId === c.id;
                const net = calculateCircleNetBalance(c, userName);

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCircle(c.id)}
                    style={{
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getCircleIconSVG(c.icon)}
                      <div>
                        <strong style={{ display: 'block', fontSize: '13.5px', color: isSelected ? 'var(--emerald)' : 'var(--text-main)' }}>{c.name}</strong>
                        <span className="muted" style={{ fontSize: '11px' }}>{c.members?.length || 0} members</span>
                      </div>
                    </div>

                    <strong style={{ fontSize: '13px', color: net === 0 ? 'var(--text-muted)' : net > 0 ? '#4ade80' : '#ef4444' }}>
                      {net === 0 ? '₹0' : net > 0 ? `+${sym}${net}` : `-${sym}${Math.abs(net)}`}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAGIC SETTLE QUICK MATRIX */}
          {activeCircle && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700 }}>Magic Settle Matrix</h3>
              
              {activeMagicSettles.length === 0 ? (
                <span className="muted" style={{ fontSize: '12px' }}>Everyone is fully settled up in {activeCircle.name}!</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeMagicSettles.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span><strong>{s.from}</strong> → <strong>{s.to}</strong></span>
                      <strong style={{ color: 'var(--emerald)' }}>{sym}{s.amount}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE CIRCLE MODAL */}
      {showCreateModal && createPortal(
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px', position: 'relative' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Create New Circle</h3>
            <form onSubmit={handleCreateCircleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Circle Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={newCircleName}
                  onChange={(e) => setNewCircleName(e.target.value)}
                  placeholder="e.g. Apartment 4B"
                  required
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Category Icon</label>
                <select
                  className="input-field"
                  value={newCircleIcon}
                  onChange={(e) => setNewCircleIcon(e.target.value)}
                >
                  <option value="building">Building / Apartment</option>
                  <option value="beach">Trip / Vacation</option>
                  <option value="coffee">Canteen / Food</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Circle</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* JOIN CIRCLE MODAL */}
      {showJoinModal && createPortal(
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '24px', position: 'relative' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Join Circle with Code</h3>
            <form onSubmit={handleJoinCircleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Invite Code</label>
                <input
                  type="text"
                  className="input-field"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="e.g. APT4B8"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoinModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Join Circle</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* SPLIT EXPENSE MODAL */}
      {showAddTxnModal && activeCircle && createPortal(
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '24px', position: 'relative' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Log Shared Expense</h3>
            <form onSubmit={handleAddTxnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Description</label>
                <input
                  type="text"
                  className="input-field"
                  value={txnTitle}
                  onChange={(e) => setTxnTitle(e.target.value)}
                  placeholder="e.g. Pizza Night"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Total Amount</label>
                  <input
                    type="number"
                    className="input-field"
                    value={txnAmount}
                    onChange={(e) => setTxnAmount(e.target.value)}
                    placeholder="600"
                    required
                  />
                </div>

                <div>
                  <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Paid By</label>
                  <select
                    className="input-field"
                    value={txnPaidBy}
                    onChange={(e) => setTxnPaidBy(e.target.value)}
                  >
                    {(activeCircle.members || []).map(m => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTxnModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* SETTLE UP MODAL */}
      {showSettleModal && activeCircle && createPortal(
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px', position: 'relative' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Settle Up Payment</h3>
            <form onSubmit={handleSettleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Member</label>
                <select
                  className="input-field"
                  value={settlePayee}
                  onChange={(e) => setSettlePayee(e.target.value)}
                >
                  {(activeCircle.members || []).filter(m => m.name !== userName).map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Amount ({sym})</label>
                <input
                  type="number"
                  className="input-field"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="e.g. 150"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Settlement</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </section>
  );
}
