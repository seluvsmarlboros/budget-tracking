import React, { useState, useRef } from 'react';
import { useStateContext, calculateCircleNetBalance, calculateMagicSettle } from '../contexts/StateContext';

export default function Circles() {
  const { state, createCircle, joinCircle, addCircleTransaction, addCircleMember, mergeGhostMember, setActiveCircle } = useStateContext();
  const userName = state?.user?.name || 'Arjun';
  const sym = state?.user?.currency || '₹';

  // Circles list from state
  const circlesList = state?.circles?.list || [];
  const activeCircleId = state?.circles?.activeCircleId || (circlesList[0]?.id || null);
  const activeCircle = circlesList.find(c => c.id === activeCircleId) || circlesList[0];

  // UI state for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCircleDetail, setShowCircleDetail] = useState(false);
  const [showAddTxnModal, setShowAddTxnModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMagicSettleModal, setShowMagicSettleModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('UPI');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeCircleMenu, setActiveCircleMenu] = useState(null);

  // Form states
  const [newCircleName, setNewCircleName] = useState('');
  const [newCircleIcon, setNewCircleIcon] = useState('building');
  const [newMemberInputs, setNewMemberInputs] = useState(['']);

  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [txnTitle, setTxnTitle] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnPaidBy, setTxnPaidBy] = useState(userName);
  const [txnCategory, setTxnCategory] = useState('Food');

  const [newMemberName, setNewMemberName] = useState('');
  const [isGhostToggle, setIsGhostToggle] = useState(true);

  // Carousel indicator tracking
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const width = scrollRef.current.offsetWidth;
      const index = Math.round(scrollLeft / width);
      setCarouselIndex(index);
    }
  };

  // Icon renderer helper
  const getCircleIconSVG = (iconType) => {
    switch (iconType) {
      case 'beach':
      case 'trip':
        return (
          <div className="circle-avatar-icon bg-beach">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
              <sun x1="12" y1="2" x2="12" y2="4"/>
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
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
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
              <line x1="9" y1="10" x2="9" y2="10.01"/>
              <line x1="15" y1="10" x2="15" y2="10.01"/>
              <line x1="9" y1="14" x2="9" y2="14.01"/>
              <line x1="15" y1="14" x2="15" y2="14.01"/>
              <line x1="9" y1="18" x2="15" y2="18"/>
            </svg>
          </div>
        );
    }
  };

  // User avatar helper
  const renderUserAvatar = (name) => {
    const isFemale = name.toLowerCase().includes('priya') || name.toLowerCase().includes('neha') || name.toLowerCase().includes('ishita') || name.toLowerCase().includes('sneha') || name.toLowerCase().includes('simran');
    const isWallet = name.toLowerCase() === 'you' || name.toLowerCase() === userName.toLowerCase();

    if (isWallet) {
      return (
        <div className="user-avatar-circle bg-wallet">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D1A15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
            <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>
          </svg>
        </div>
      );
    }
    return (
      <div className={`user-avatar-circle ${isFemale ? 'bg-female' : 'bg-male'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    );
  };

  // Compile recent activities across all circles
  const recentActivities = [];
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

      const formatRelativeDate = (dateStr) => {
        if (!dateStr) return 'Today';
        const today = new Date().toISOString().split('T')[0];
        if (dateStr === today) return 'Today';

        const d = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.round((now - d) / 864e5);
        if (diffDays === 1) return 'Yesterday';
        if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
        return dateStr;
      };

      recentActivities.push({
        id: t.id,
        circleName: circle.name,
        paidBy: t.paidBy,
        title: t.title,
        myShare,
        totalAmount: t.totalAmount,
        dateRaw: t.date || new Date().toISOString().split('T')[0],
        date: formatRelativeDate(t.date),
        isSettlement: t.isSettlement,
        recipient: t.recipient,
        amountFormatted,
        amountClass
      });
    });
  });

  // Sort activities by raw date descending (not formatted string)
  recentActivities.sort((a, b) => new Date(b.dateRaw) - new Date(a.dateRaw));
  const displayedActivities = recentActivities.slice(0, 5);

  // Action handlers
  const handleCreateCircleSubmit = (e) => {
    e.preventDefault();
    if (!newCircleName.trim()) return;
    const memberObjs = newMemberInputs
      .filter(m => m.trim())
      .map(m => ({ name: m.trim(), isGhost: true }));

    const circle = createCircle(newCircleName, newCircleIcon, memberObjs);
    if (circle) {
      if (window.toast) window.toast(`🎉 Created Circle "${circle.name}"!`);
      setNewCircleName('');
      setNewMemberInputs(['']);
      setShowCreateModal(false);
    }
  };

  const handleJoinCircleSubmit = (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const circle = joinCircle(joinCodeInput);
    if (circle) {
      if (window.toast) window.toast(`🚀 Joined ${circle.name}!`);
      setJoinCodeInput('');
      setShowJoinModal(false);
    }
  };

  const handleAddTxnSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(txnAmount);
    if (!txnTitle.trim() || !amt || amt <= 0 || !activeCircle) return;

    // Calculate equal split across active circle members
    const members = activeCircle.members || [];
    const count = Math.max(1, members.length);
    const equalShare = Math.round((amt / count) * 100) / 100;

    const splits = {};
    members.forEach(m => {
      splits[m.name] = equalShare;
    });

    addCircleTransaction(activeCircle.id, {
      title: txnTitle,
      totalAmount: amt,
      paidBy: txnPaidBy,
      category: txnCategory,
      splits
    });

    if (window.toast) window.toast(`💸 Logged "${txnTitle}" in ${activeCircle.name}!`);
    setTxnTitle('');
    setTxnAmount('');
    setShowAddTxnModal(false);
  };

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!newMemberName.trim() || !activeCircle) return;
    const success = addCircleMember(activeCircle.id, newMemberName, isGhostToggle);
    if (success) {
      if (window.toast) window.toast(`👤 Added ${newMemberName} to ${activeCircle.name}`);
      setNewMemberName('');
      setShowAddMemberModal(false);
    } else {
      if (window.toast) window.toast(`Member already in Circle!`);
    }
  };

  const handleSettleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0 || !activeCircle) return;

    const payee = settlePayee || activeCircle.members?.find(m => m.name !== userName)?.name || 'Member';

    addCircleTransaction(activeCircle.id, {
      title: `Settlement to ${payee}`,
      totalAmount: amt,
      paidBy: userName,
      recipient: payee,
      isSettlement: true,
      category: 'Income',
      splits: { [userName]: -amt, [payee]: amt }
    });

    if (window.toast) window.toast(`🤝 Logged ${sym}${amt} settlement to ${payee}!`);
    setShowSettleModal(false);
    setSettleAmount('');
  };

  return (
    <div className="circles-hub-view">
      {/* Hero Greeting & New Circle Action */}
      <section className="circles-hero-section">
        <div className="hero-greeting-box">
          <h1 className="hero-title">Hey {userName} 👋</h1>
          <p className="hero-subtext">Here's what's happening in your circles.</p>
        </div>

        <button className="btn-new-circle" onClick={() => setShowCreateModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New Circle</span>
        </button>
      </section>

      {/* Your Circles Horizontal Carousel */}
      <section className="circles-carousel-section">
        <div className="section-header">
          <h2 className="section-title">Your Circles</h2>
          <button className="view-all-link" onClick={() => setShowJoinModal(true)}>
            <span>Join with Code</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Cards Carousel Container */}
        <div className="carousel-wrapper">
          <div className="circles-scroll-container" ref={scrollRef} onScroll={handleScroll}>
            {circlesList.map(circle => {
              const netBalance = calculateCircleNetBalance(circle, userName);
              const isPositive = netBalance >= 0;
              const memberCount = circle.members?.length || 0;

              return (
                <div
                  key={circle.id}
                  className={`circle-card ${activeCircleId === circle.id ? 'active-card' : ''}`}
                  onClick={() => {
                    setActiveCircle(circle.id);
                    setShowCircleDetail(true);
                  }}
                >
                  {/* Card Top Row */}
                  <div className="card-top-row">
                    {getCircleIconSVG(circle.icon)}
                    <button
                      className="card-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCircleMenu(activeCircleMenu === circle.id ? null : circle.id);
                      }}
                    >
                      •••
                    </button>

                    {/* Overflow Dropdown */}
                    {activeCircleMenu === circle.id && (
                      <div className="circle-overflow-menu" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setActiveCircle(circle.id); setShowAddMemberModal(true); setActiveCircleMenu(null); }}>
                          ➕ Add Member
                        </button>
                        <button onClick={() => { setActiveCircle(circle.id); setShowMagicSettleModal(true); setActiveCircleMenu(null); }}>
                          ✨ Magic Settle
                        </button>
                        <button onClick={() => { navigator.clipboard?.writeText(circle.inviteCode); window.toast(`Copied Code: ${circle.inviteCode}`); setActiveCircleMenu(null); }}>
                          📋 Copy Invite Code ({circle.inviteCode})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Title & Members */}
                  <div className="card-info">
                    <h3 className="circle-name">{circle.name}</h3>
                    <span className="member-count">{memberCount} members</span>
                  </div>

                  <hr className="card-divider" />

                  {/* Net Balance Section */}
                  <div className="card-balance-section">
                    <span className="balance-label">Your net balance</span>
                    <div className={`balance-amount ${netBalance === 0 ? 'positive' : isPositive ? 'positive' : 'negative'}`}>
                      {netBalance === 0 ? `${sym}0` : isPositive ? `+${sym}${Math.abs(netBalance)}` : `-${sym}${Math.abs(netBalance)}`}
                    </div>

                    {/* Status Pill & Settle Action */}
                    <div className="card-status-row">
                      <div className={`status-pill ${netBalance === 0 ? 'pill-settled' : isPositive ? 'pill-settled' : 'pill-owe'}`}>
                        {netBalance === 0 ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>All settled up</span>
                          </>
                        ) : isPositive ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="7" y1="17" x2="17" y2="7"/>
                              <polyline points="7 7 17 7 17 17"/>
                            </svg>
                            <span>You're owed</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="7" y1="7" x2="17" y2="17"/>
                              <polyline points="17 7 17 17 7 17"/>
                            </svg>
                            <span>You owe</span>
                          </>
                        )}
                      </div>

                      <button
                        className={`btn-card-settle ${netBalance === 0 ? 'settled' : isPositive ? 'settled' : 'owe'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCircle(circle.id);
                          const magicTransfers = calculateMagicSettle(circle);
                          const myTransfer = magicTransfers.find(t => t.from.toLowerCase() === userName.toLowerCase());
                          const targetPayee = myTransfer ? myTransfer.to : (circle.members.find(m => m.name !== userName)?.name || '');
                          const targetAmt = myTransfer ? myTransfer.amount.toString() : Math.abs(netBalance).toString();
                          setSettlePayee(targetPayee);
                          setSettleAmount(targetAmt);
                          setShowSettleModal(true);
                        }}
                      >
                        {netBalance === 0 ? '✅ Settled' : isPositive ? '🤝 Collect' : '💸 Repay Debt'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Carousel Dots */}
          <div className="carousel-dots">
            {circlesList.map((c, i) => (
              <span key={c.id} className={`dot ${i === carouselIndex ? 'active' : ''}`}></span>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="recent-activity-section">
        <div className="section-header">
          <h2 className="section-title">Recent Activity</h2>
          <a href="#activity" className="view-all-link">
            <span>View all</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>
        </div>

        {/* Activity Cards Feed */}
        <div className="activity-feed-card">
          {displayedActivities.length === 0 ? (
            <div className="empty-feed">No transactions logged in your circles yet.</div>
          ) : (
            displayedActivities.map((act, idx) => (
              <div key={act.id || idx} className="activity-row" onClick={() => setShowCircleDetail(true)}>
                <div className="activity-left">
                  {renderUserAvatar(act.paidBy)}
                  <div className="activity-details">
                    <div className="activity-headline">
                      {act.isSettlement
                        ? <><strong>{act.paidBy === userName ? 'You' : act.paidBy}</strong> paid <strong>{act.recipient === userName ? 'you' : (act.recipient || 'member')}</strong></>
                        : <><strong>{act.paidBy === userName ? 'You' : act.paidBy}</strong> paid for {act.title}.</>
                      }
                    </div>
                    <div className="activity-sub">
                      {act.isSettlement ? 'Settlement' : `Your share: ${sym}${Math.abs(act.myShare || 0)}`}
                    </div>
                    <div className="activity-meta">
                      {act.date} • <span className="circle-tag">{act.circleName}</span>
                    </div>
                  </div>
                </div>

                <div className="activity-right">
                  <span className={`activity-amount ${act.amountClass}`}>{act.amountFormatted}</span>
                  <svg className="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- MODALS & SHEETS --- */}

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
                <div className="icon-selector">
                  <button type="button" className={`icon-opt ${newCircleIcon === 'building' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('building')}>🏢 Apartment</button>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'beach' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('beach')}>🌴 Trip</button>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'coffee' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('coffee')}>☕ Canteen</button>
                </div>
              </div>

              <div className="field">
                <label>Add Members (Ghost / Friends)</label>
                {newMemberInputs.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    placeholder={`Member ${idx + 1} Name`}
                    value={val}
                    onChange={e => {
                      const updated = [...newMemberInputs];
                      updated[idx] = e.target.value;
                      setNewMemberInputs(updated);
                    }}
                    style={{ marginBottom: '8px' }}
                  />
                ))}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setNewMemberInputs([...newMemberInputs, ''])}
                >
                  + Add another member
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
              <h3>Join Existing Circle</h3>
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
              <button type="submit" className="btn-primary">Join Circle</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Circle Detail View Modal */}
      {showCircleDetail && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowCircleDetail(false)}>
          <div className="modal-sheet detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="circle-title-group">
                <h3>{activeCircle.name}</h3>
                <span className="code-badge">Code: {activeCircle.inviteCode}</span>
              </div>
              <button className="close-btn" onClick={() => setShowCircleDetail(false)}>✕</button>
            </div>

            {/* Quick Actions in Detail */}
            <div className="detail-actions">
              <button className="action-pill highlight-green" onClick={() => {
                const magicTransfers = calculateMagicSettle(activeCircle);
                const myTransfer = magicTransfers.find(t => t.from.toLowerCase() === userName.toLowerCase());
                const targetPayee = myTransfer ? myTransfer.to : (activeCircle.members.find(m => m.name !== userName)?.name || '');
                const targetAmt = myTransfer ? myTransfer.amount.toString() : Math.abs(calculateCircleNetBalance(activeCircle, userName)).toString();
                setSettlePayee(targetPayee);
                setSettleAmount(targetAmt);
                setShowSettleModal(true);
              }}>
                🤝 Repay Debt
              </button>
              <button className="action-pill" onClick={() => setShowAddTxnModal(true)}>
                ➕ Log Expense
              </button>
              <button className="action-pill highlight" onClick={() => setShowMagicSettleModal(true)}>
                ✨ Magic Settle
              </button>
              <button className="action-pill" onClick={() => setShowAddMemberModal(true)}>
                👤 Add Member
              </button>
            </div>

            {/* Member List */}
            <div className="members-list-section">
              <h4>Members ({activeCircle.members?.length})</h4>
              <div className="members-chips">
                {activeCircle.members?.map(m => (
                  <div key={m.id} className="member-chip">
                    <span>{m.name}</span>
                    {m.isGhost && <span className="ghost-tag">Ghost</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Circle Expense Log History */}
            <div className="circle-history-section">
              <h4>Circle Expenses</h4>
              {(!activeCircle.transactions || activeCircle.transactions.length === 0) ? (
                <p className="muted">No expenses recorded yet.</p>
              ) : (
                activeCircle.transactions.map(t => (
                  <div key={t.id} className="txn-history-row">
                    <div>
                      <strong>{t.title}</strong>
                      <div className="muted">{t.paidBy} paid • {t.date}</div>
                    </div>
                    <span className="txn-amt">{sym}{t.totalAmount}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Magic Settle Modal */}
      {showMagicSettleModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowMagicSettleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✨ Magic Settle — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowMagicSettleModal(false)}>✕</button>
            </div>
            <div className="magic-settle-content">
              <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Our min-cash-flow algorithm calculates the fewest number of transactions needed to settle all debts.
              </p>
              {calculateMagicSettle(activeCircle).length === 0 ? (
                <div className="settled-notice">🎉 Everyone in {activeCircle.name} is fully settled up! No transfers needed.</div>
              ) : (
                calculateMagicSettle(activeCircle).map((step, idx) => (
                  <div key={idx} className="magic-step-card">
                    <div className="step-num">{idx + 1}</div>
                    <div className="step-text">
                      <strong>{step.from}</strong> pays <strong>{step.to}</strong>
                    </div>
                    <div className="step-amount">{sym}{step.amount}</div>
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

      {/* 5. Settle Up / Repay Debt Modal */}
      {showSettleModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🤝 Settle Up & Repay — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowSettleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSettleSubmit} className="modal-form">
              <div className="field">
                <label>Pay To (Recipient)</label>
                <select value={settlePayee || activeCircle.members?.find(m => m.name !== userName)?.name || ''} onChange={e => setSettlePayee(e.target.value)}>
                  {activeCircle.members?.filter(m => m.name !== userName).map(m => (
                    <option key={m.id} value={m.name}>{m.name} {m.isGhost ? '(Ghost)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Settlement Amount ({sym})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Payment Method</label>
                <select value={settleMethod} onChange={e => setSettleMethod(e.target.value)}>
                  <option value="UPI">UPI App (GPay / PhonePe / Paytm)</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              {settleMethod === 'UPI' && (
                <a
                  href={`upi://pay?pa=${activeCircle.members?.find(m => m.name === settlePayee)?.upiId || 'partner@upi'}&pn=${encodeURIComponent(settlePayee)}&am=${settleAmount || '0'}&cu=INR`}
                  className="btn-upi-app"
                  target="_blank"
                  rel="noreferrer"
                >
                  🚀 Pay via Instant UPI Deep Link
                </a>
              )}

              <button type="submit" className="btn-primary">Confirm & Log Settlement</button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Circle Member Modal */}
      {showAddMemberModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Member to {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowAddMemberModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMemberSubmit} className="modal-form">
              <div className="field">
                <label>Member Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul, Sneha"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  required
                />
              </div>

              <div className="field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={isGhostToggle}
                    onChange={e => setIsGhostToggle(e.target.checked)}
                  />
                  <span>Track as local Ghost Member (no account required)</span>
                </label>
              </div>

              <button type="submit" className="btn-primary">Add Member</button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Circle Expense Modal */}
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
                  placeholder="e.g. Pizza, Groceries, Movie"
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

              <button type="submit" className="btn-primary">Log Bill & Split Equally</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
