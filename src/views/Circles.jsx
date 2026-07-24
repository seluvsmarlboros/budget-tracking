import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [showCircleDetail, setShowCircleDetail] = useState(false);
  const [showAddTxnModal, setShowAddTxnModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [showEditCircleModal, setShowEditCircleModal] = useState(false);
  const [showMagicSettleModal, setShowMagicSettleModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeCircleMenu, setActiveCircleMenu] = useState(null);

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
  const [settleMethod, setSettleMethod] = useState('UPI');

  // Outside click listener for 3-dots overflow menu
  useEffect(() => {
    const handleOutsideClick = () => setActiveCircleMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
          <div className="circle-avatar-icon bg-beach">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
          </div>
        );
      case 'coffee':
      case 'canteen':
        return (
          <div className="circle-avatar-icon bg-coffee">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            </svg>
          </div>
        );
      case 'building':
      case 'apartment':
      default:
        return (
          <div className="circle-avatar-icon bg-building">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
              <line x1="9" y1="6" x2="9" y2="6.01"/>
              <line x1="15" y1="6" x2="15" y2="6.01"/>
              <line x1="9" y1="18" x2="15" y2="18"/>
            </svg>
          </div>
        );
    }
  };

  // Compile recent activities across circles
  const recentActivities = useMemo(() => {
    const list = [];
    circlesList.forEach(circle => {
      (circle.transactions || []).forEach(t => {
        const isUserPaid = t.paidBy === userName;
        const myShare = t.splits?.[userName] || 0;
        let amountFormatted = '';
        let amountClass = '';

        if (t.isSettlement) {
          if (t.paidBy === userName) {
            amountFormatted = `-${sym}${t.totalAmount}`;
            amountClass = 'amount-red';
          } else if (t.recipient === userName) {
            amountFormatted = `+${sym}${t.totalAmount}`;
            amountClass = 'amount-green';
          } else {
            amountFormatted = `${sym}${t.totalAmount}`;
            amountClass = '';
          }
        } else if (isUserPaid) {
          const diff = t.totalAmount - myShare;
          amountFormatted = diff === 0 ? `${sym}0` : `+${sym}${diff}`;
          amountClass = 'amount-green';
        } else {
          amountFormatted = myShare === 0 ? `${sym}0` : `-${sym}${myShare}`;
          amountClass = myShare === 0 ? 'amount-green' : 'amount-red';
        }

        list.push({
          id: t.id,
          circleId: circle.id,
          circleName: circle.name,
          paidBy: t.paidBy,
          title: t.title,
          myShare,
          totalAmount: t.totalAmount,
          dateRaw: t.date || new Date().toISOString().split('T')[0],
          isSettlement: t.isSettlement,
          recipient: t.recipient,
          amountFormatted,
          amountClass
        });
      });
    });
    list.sort((a, b) => new Date(b.dateRaw) - new Date(a.dateRaw));
    return list.slice(0, 6);
  }, [circlesList, userName, sym]);

  // Action Handlers
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
      setActiveCircleMenu(null);
    }
  };

  // Flexible Splitting Calculation
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

    const partnerName = settlePayee || activeCircle.members?.find(m => m.name !== userName)?.name || 'Member';
    const isPaying = settleDirection === 'pay';
    const paidBy = isPaying ? userName : partnerName;
    const recipient = isPaying ? partnerName : userName;
    const title = isPaying ? `Settlement paid to ${partnerName}` : `Repayment received from ${partnerName}`;

    addCircleTransaction(activeCircle.id, {
      title,
      totalAmount: amt,
      paidBy,
      recipient,
      isSettlement: true,
      category: isPaying ? 'Other' : 'Income',
      splits: { [userName]: -amt, [partnerName]: amt }
    });

    if (window.toast) {
      window.toast(isPaying ? `Logged ${sym}${amt} settlement to ${partnerName}!` : `Recorded ${sym}${amt} repayment received from ${partnerName}!`);
    }
    setShowSettleModal(false);
    setSettleAmount('');
  };

  return (
    <div className="circles-hub-view view active">
      {/* Header & Main Controls */}
      <section className="circles-hero-section">
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>UniSpend Circles</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Real-time group bill splitting & net balance engine
          </p>
        </div>

        <div className="circles-hero-actions">
          <button
            type="button"
            className="btn-new-circle"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Create Circle</span>
          </button>

          <button
            type="button"
            className="btn-join-circle"
            onClick={() => setShowJoinModal(true)}
          >
            <span>Join with Code</span>
          </button>
        </div>
      </section>

      {/* Circles Horizontal Cards Carousel */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {circlesList.map(circle => {
            const netBalance = calculateCircleNetBalance(circle, userName);
            const isPositive = netBalance >= 0;
            const memberCount = circle.members?.length || 0;
            const isActive = activeCircleId === circle.id;

            return (
              <div
                key={circle.id}
                className={`circle-card-box ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveCircle(circle.id);
                  setShowCircleDetail(true);
                }}
              >
                {/* Top Row: Icon + 3 Dots Menu Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  {getCircleIconSVG(circle.icon)}

                  {/* Sleek SVG 3-Dots Menu Button */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCircleMenu(activeCircleMenu === circle.id ? null : circle.id);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>

                    {/* Overflow Dropdown */}
                    {activeCircleMenu === circle.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '38px',
                          background: 'rgba(18, 32, 26, 0.98)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                          zIndex: 99,
                          width: '190px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <button
                          onClick={() => {
                            setActiveCircle(circle.id);
                            setEditNameInput(circle.name);
                            setEditIconInput(circle.icon || 'building');
                            setShowEditCircleModal(true);
                            setActiveCircleMenu(null);
                          }}
                          style={{ padding: '10px 14px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          ✏️ Edit Circle Details
                        </button>
                        <button
                          onClick={() => {
                            setActiveCircle(circle.id);
                            setShowManageMembersModal(true);
                            setActiveCircleMenu(null);
                          }}
                          style={{ padding: '10px 14px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          👥 Manage Members ({memberCount})
                        </button>
                        <button
                          onClick={() => {
                            setActiveCircle(circle.id);
                            setShowMagicSettleModal(true);
                            setActiveCircleMenu(null);
                          }}
                          style={{ padding: '10px 14px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          🪄 Magic Settle
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(circle.inviteCode);
                            if (window.toast) window.toast(`Copied Code: ${circle.inviteCode}`);
                            setActiveCircleMenu(null);
                          }}
                          style={{ padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--accent)', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          📋 Copy Code ({circle.inviteCode})
                        </button>
                        <button
                          onClick={() => handleDeleteCircle(circle.id, circle.name)}
                          style={{ padding: '10px 14px', background: 'rgba(239, 83, 80, 0.1)', border: 'none', color: '#ef5350', textAlign: 'left', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          🗑️ Delete Circle
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Circle Info */}
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>{circle.name}</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {memberCount} members • Code: <strong style={{ color: 'var(--accent)' }}>{circle.inviteCode}</strong>
                </div>

                {/* Balance & Settle Bar */}
                <div className="circle-balance-strip">
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Your Net Balance</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: netBalance === 0 ? 'var(--text-muted)' : isPositive ? '#4ADE80' : '#ef5350' }}>
                      {netBalance === 0 ? `${sym}0` : isPositive ? `+${sym}${Math.abs(netBalance)}` : `-${sym}${Math.abs(netBalance)}`}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCircle(circle.id);
                      const isPos = netBalance >= 0;
                      setSettleDirection(isPos ? 'receive' : 'pay');
                      setShowSettleModal(true);
                    }}
                    style={{
                      background: isPositive ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 83, 80, 0.15)',
                      color: isPositive ? '#4ADE80' : '#ef5350',
                      border: isPositive ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(239, 83, 80, 0.3)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {netBalance === 0 ? 'Settle Up' : isPositive ? 'Collect' : 'Repay'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Circle Activity Feed */}
      <section className="card pulse-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
          Circle Activity Feed
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentActivities.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No transactions logged in your circles yet. Tap "+ Log Expense" above to start!
            </div>
          ) : (
            recentActivities.map(act => (
              <div
                key={act.id}
                onClick={() => {
                  setActiveCircle(act.circleId);
                  setShowCircleDetail(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                    {act.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {act.paidBy === userName ? 'You' : act.paidBy} paid • <span style={{ color: 'var(--accent)' }}>{act.circleName}</span>
                  </div>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, className: act.amountClass, color: act.amountClass === 'amount-green' ? '#4ADE80' : act.amountClass === 'amount-red' ? '#ef5350' : 'var(--text)' }}>
                  {act.amountFormatted}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- MODALS --- */}

      {/* 1. Create Circle Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Circle</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCircleSubmit} className="modal-form">
              <div className="field">
                <label>Circle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apartment 4B, Goa Trip"
                  value={newCircleName}
                  onChange={e => setNewCircleName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Category Icon</label>
                <div className="icon-selector" style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'building' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('building')}>Apartment</button>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'beach' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('beach')}>Trip</button>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'coffee' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('coffee')}>Canteen</button>
                </div>
              </div>

              {/* Initial Roommate Inputs */}
              <div className="field">
                <label>Initial Roommates / Members (Optional)</label>
                {initialMembers.map((m, idx) => (
                  <input
                    key={idx}
                    type="text"
                    placeholder={`Roommate #${idx + 1} Name...`}
                    value={m}
                    onChange={(e) => {
                      const updated = [...initialMembers];
                      updated[idx] = e.target.value;
                      setInitialMembers(updated);
                    }}
                    style={{ marginBottom: '6px' }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setInitialMembers(prev => [...prev, ''])}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
                >
                  + Add another roommate
                </button>
              </div>

              <button type="submit" className="btn-primary">Create Circle</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Join Circle Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Join Circle with Code</h3>
              <button className="close-btn" onClick={() => setShowJoinModal(false)}>✕</button>
            </div>
            <form onSubmit={handleJoinCircleSubmit} className="modal-form">
              <div className="field">
                <label>Enter 6-Character Invite Code</label>
                <input
                  type="text"
                  placeholder="e.g. APT4B8"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Join Room</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Log Expense Modal with Flexible Splitting Engine */}
      {showAddTxnModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowAddTxnModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log Expense in {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowAddTxnModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddTxnSubmit} className="modal-form">
              <div className="field">
                <label>Description / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Pizza, Wi-Fi bill, Groceries"
                  value={txnTitle}
                  onChange={e => setTxnTitle(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Total Amount ({sym})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={txnAmount}
                  onChange={e => setTxnAmount(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Paid By</label>
                <select value={txnPaidBy} onChange={e => setTxnPaidBy(e.target.value)}>
                  {activeCircle.members?.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Split Mode Selector */}
              <div className="field">
                <label>Split Method</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { mode: 'equal', label: '⚖️ Equally' },
                    { mode: 'exact', label: '💵 Exact ₹' },
                    { mode: 'percentage', label: '📊 Percentage %' }
                  ].map(item => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setSplitMode(item.mode)}
                      style={{
                        flex: 1,
                        background: splitMode === item.mode ? 'rgba(197, 160, 89, 0.2)' : 'rgba(255,255,255,0.04)',
                        border: splitMode === item.mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                        color: splitMode === item.mode ? 'var(--accent)' : 'var(--text)',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participant Selection Checklist & Custom Inputs */}
              <div className="field">
                <label>Select Participants ({activeCircle.members?.length})</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  {activeCircle.members?.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                        <input
                          type="checkbox"
                          checked={!!selectedParticipants[m.name]}
                          onChange={(e) => setSelectedParticipants(prev => ({ ...prev, [m.name]: e.target.checked }))}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span>{m.name}</span>
                      </label>

                      {/* Custom input for exact/percentage modes */}
                      {selectedParticipants[m.name] && splitMode !== 'equal' && (
                        <input
                          type="number"
                          placeholder={splitMode === 'exact' ? 'Amount ₹' : '% share'}
                          value={customSplits[m.name] || ''}
                          onChange={(e) => setCustomSplits(prev => ({ ...prev, [m.name]: e.target.value }))}
                          style={{ width: '90px', padding: '4px 8px', fontSize: '12px' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary">Log Bill & Split</button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Manage Members Modal */}
      {showManageMembersModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowManageMembersModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Members — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowManageMembersModal(false)}>✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Room Members ({activeCircle.members?.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeCircle.members?.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{m.name} {m.isGhost ? '(Ghost)' : ''}</span>
                    {m.name !== userName && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.name)}
                        style={{ background: 'rgba(239, 83, 80, 0.1)', color: '#ef5350', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add Member Form */}
            <form onSubmit={handleAddMemberSubmit} className="modal-form">
              <div className="field">
                <label>Add New Member Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">+ Add Member</button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Edit Circle Modal */}
      {showEditCircleModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowEditCircleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Circle Details</h3>
              <button className="close-btn" onClick={() => setShowEditCircleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditCircleSubmit} className="modal-form">
              <div className="field">
                <label>Circle Name</label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={e => setEditNameInput(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Icon</label>
                <div className="icon-selector" style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className={`icon-opt ${editIconInput === 'building' ? 'selected' : ''}`} onClick={() => setEditIconInput('building')}>Apartment</button>
                  <button type="button" className={`icon-opt ${editIconInput === 'beach' ? 'selected' : ''}`} onClick={() => setEditIconInput('beach')}>Trip</button>
                  <button type="button" className={`icon-opt ${editIconInput === 'coffee' ? 'selected' : ''}`} onClick={() => setEditIconInput('coffee')}>Canteen</button>
                </div>
              </div>

              <button type="submit" className="btn-primary">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Magic Settle Modal */}
      {showMagicSettleModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowMagicSettleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Magic Settle — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowMagicSettleModal(false)}>✕</button>
            </div>
            <div className="magic-settle-content">
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Graph debt minimizer algorithm calculates the minimum transfers needed to settle all roommate debts.
              </p>
              {calculateMagicSettle(activeCircle).length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(74, 222, 128, 0.1)', color: '#4ADE80', borderRadius: '12px', fontWeight: 600 }}>
                  ✨ Everyone in {activeCircle.name} is fully settled up! No transfers needed.
                </div>
              ) : (
                calculateMagicSettle(activeCircle).map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px' }}>
                      <strong>{step.from}</strong> → <strong>{step.to}</strong>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--accent)' }}>{sym}{step.amount}</div>
                    <button
                      className="btn-magic-pay"
                      onClick={() => {
                        setSettlePayee(step.to);
                        setSettleAmount(step.amount.toString());
                        setShowMagicSettleModal(false);
                        setShowSettleModal(true);
                      }}
                    >
                      Pay Now ↗
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Settle Up / Repay Modal */}
      {showSettleModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{settleDirection === 'receive' ? 'Record Repayment' : 'Repay Debt'} — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowSettleModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSettleSubmit} className="modal-form">
              <div className="field">
                <label>{settleDirection === 'pay' ? 'Pay To' : 'Received From'}</label>
                <select value={settlePayee || activeCircle.members?.find(m => m.name !== userName)?.name || ''} onChange={e => setSettlePayee(e.target.value)}>
                  {activeCircle.members?.filter(m => m.name !== userName).map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Amount ({sym})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  required
                />
              </div>

              {settleDirection === 'pay' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <a
                    href={`upi://pay?pa=${activeCircle.members?.find(m => m.name === settlePayee)?.upiId || 'partner@upi'}&pn=${encodeURIComponent(settlePayee)}&am=${settleAmount || '0'}&cu=INR`}
                    className="btn-upi-app"
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1 }}
                  >
                    🚀 Launch UPI App
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    style={{ background: 'rgba(197, 160, 89, 0.15)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '0 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    📱 QR Code
                  </button>
                </div>
              )}

              <button type="submit" className="btn-primary">
                {settleDirection === 'pay' ? 'Confirm Payment & Log' : 'Record Received Repayment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. QR Code Settle Overlay Modal */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '24px' }}>
            <h3>Scan QR to Pay {settlePayee}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Scan using PhonePe, Google Pay, or Paytm
            </p>

            <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '16px' }}>
              <svg width="160" height="160" viewBox="0 0 100 100" fill="#000">
                <rect x="10" y="10" width="30" height="30" fill="#000"/>
                <rect x="15" y="15" width="20" height="20" fill="#fff"/>
                <rect x="20" y="20" width="10" height="10" fill="#000"/>
                
                <rect x="60" y="10" width="30" height="30" fill="#000"/>
                <rect x="65" y="15" width="20" height="20" fill="#fff"/>
                <rect x="70" y="20" width="10" height="10" fill="#000"/>

                <rect x="10" y="60" width="30" height="30" fill="#000"/>
                <rect x="15" y="65" width="20" height="20" fill="#fff"/>
                <rect x="20" y="70" width="10" height="10" fill="#000"/>

                <rect x="50" y="50" width="10" height="10" fill="#000"/>
                <rect x="70" y="70" width="15" height="15" fill="#000"/>
                <rect x="50" y="75" width="10" height="15" fill="#000"/>
              </svg>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', marginBottom: '16px' }}>
              {sym}{settleAmount || '0'}
            </div>

            <button type="button" className="btn-primary" onClick={() => setShowQrModal(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
