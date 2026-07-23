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
  const [settleDirection, setSettleDirection] = useState('pay'); // pay (I paid debt) vs receive (I received repayment)
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
      if (window.toast) window.toast(`Created Circle "${circle.name}"!`);
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
      if (window.toast) window.toast(`Joined ${circle.name}!`);
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

    if (window.toast) window.toast(`Logged "${txnTitle}" in ${activeCircle.name}!`);
    setTxnTitle('');
    setTxnAmount('');
    setShowAddTxnModal(false);
  };

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!newMemberName.trim() || !activeCircle) return;
    const success = addCircleMember(activeCircle.id, newMemberName, isGhostToggle);
    if (success) {
      if (window.toast) window.toast(`Added ${newMemberName} to ${activeCircle.name}`);
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
      window.toast(isPaying ? `Logged ${sym}${amt} payment to ${partnerName}!` : `Recorded ${sym}${amt} repayment received from ${partnerName}!`);
    }
    setShowSettleModal(false);
    setSettleAmount('');
  };

  const handleSendReminder = async () => {
    const partnerName = settlePayee || activeCircle.members?.find(m => m.name !== userName)?.name || 'Member';
    if (!partnerName) return;
    try {
      const partnerMember = activeCircle.members?.find(m => m.name === partnerName);
      if (partnerMember && partnerMember.id && !partnerMember.isGhost) {
        await SupabaseService.sendReminderNotification(activeCircle.id, partnerMember.id, parseFloat(settleAmount || 0), userName);
        window.toast(`Reminder notification sent to ${partnerName}!`);
      } else {
        window.toast(`Reminder logged for ${partnerName}! (Share via UPI link below)`);
      }
    } catch (e) {
      window.toast(`Reminder notification logged for ${partnerName}!`);
    }
  };

  return (
    <div className="circles-hub-view">
      {/* Hero Greeting & New Circle Action */}
      <section className="circles-hero-section">
        <div className="hero-greeting-box">
          <h1 className="hero-title">Hey {userName}</h1>
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
                          Add Member
                        </button>
                        <button onClick={() => { setActiveCircle(circle.id); setShowMagicSettleModal(true); setActiveCircleMenu(null); }}>
                          Magic Settle
                        </button>
                        <button onClick={() => { navigator.clipboard?.writeText(circle.inviteCode); window.toast(`Copied Code: ${circle.inviteCode}`); setActiveCircleMenu(null); }}>
                          Copy Invite Code ({circle.inviteCode})
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
                          setSettleDirection(isPositive ? 'receive' : 'pay');
                          setShowSettleModal(true);
                        }}
                      >
                        {netBalance === 0 ? 'Settled' : isPositive ? 'Collect' : 'Repay Debt'}
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
            <div className="empty-feed">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>No transactions logged in your circles yet</span>
            </div>
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
                  <button type="button" className={`icon-opt ${newCircleIcon === 'building' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('building')}>Apartment</button>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'beach' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('beach')}>Trip</button>
                  <button type="button" className={`icon-opt ${newCircleIcon === 'coffee' ? 'selected' : ''}`} onClick={() => setNewCircleIcon('coffee')}>Canteen</button>
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
              <button className="btn-action-pill" onClick={() => {
                const isPos = calculateCircleNetBalance(activeCircle, userName) >= 0;
                setSettleDirection(isPos ? 'receive' : 'pay');
                setShowCircleDetail(false);
                setShowSettleModal(true);
              }}>
                Settle Up
              </button>
              <button className="btn-action-pill primary" onClick={() => { setShowCircleDetail(false); setShowAddTxnModal(true); }}>
                + Log Expense
              </button>
              <button className="btn-action-pill" onClick={() => { setShowCircleDetail(false); setShowMagicSettleModal(true); }}>
                Magic Settle
              </button>
              <button className="btn-action-pill" onClick={() => { setShowCircleDetail(false); setShowAddMemberModal(true); }}>
                + Add Member
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
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 700 }}>
                Circle Transactions ({activeCircle.transactions?.length || 0})
              </h4>
              {(!activeCircle.transactions || activeCircle.transactions.length === 0) ? (
                <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                  <p className="muted" style={{ margin: 0, fontSize: '13px' }}>No expenses recorded in this circle yet.</p>
                </div>
              ) : (
                <div className="circle-history-card">
                  {activeCircle.transactions.map((t, idx) => {
                    const isMePayer = (t.paidBy || '').toLowerCase() === (userName || '').toLowerCase();
                    const isMeRecipient = (t.recipient || '').toLowerCase() === (userName || '').toLowerCase();

                    return (
                      <div key={t.id || idx} className="txn-history-row">
                        {/* Left Icon Badge */}
                        {t.isSettlement ? (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isMeRecipient ? 'rgba(74, 222, 128, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isMeRecipient ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="15" y2="17"/>
                              </svg>
                            )}
                          </div>
                        ) : (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                            </svg>
                          </div>
                        )}

                        {/* Title & Metadata */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{t.paidBy === userName ? 'You' : t.paidBy} paid</span>
                            <span>• {t.date}</span>
                            {t.isSettlement && <span style={{ background: 'rgba(74, 222, 128, 0.1)', color: 'var(--green)', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600 }}>Settlement</span>}
                            {!t.isSettlement && t.category && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px' }}>{t.category}</span>}
                          </div>
                        </div>

                        {/* Amount Badge */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {t.isSettlement ? (
                            <span style={{
                              fontWeight: 700,
                              fontSize: '14px',
                              color: isMeRecipient ? 'var(--green)' : isMePayer ? 'var(--red)' : 'var(--text-secondary)'
                            }}>
                              {isMeRecipient ? `+${sym}${t.totalAmount}` : isMePayer ? `-${sym}${t.totalAmount}` : `${sym}${t.totalAmount}`}
                            </span>
                          ) : (
                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                              {sym}{t.totalAmount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              <h3>Magic Settle — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowMagicSettleModal(false)}>✕</button>
            </div>
            <div className="magic-settle-content">
              <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Our min-cash-flow algorithm calculates the fewest number of transactions needed to settle all debts.
              </p>
              {calculateMagicSettle(activeCircle).length === 0 ? (
                <div className="settled-notice">Everyone in {activeCircle.name} is fully settled up! No transfers needed.</div>
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

      {/* 5. Settle Up / Repay / Collect Modal */}
      {showSettleModal && activeCircle && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{settleDirection === 'receive' ? 'Record Received Repayment' : 'Repay Debt'} — {activeCircle.name}</h3>
              <button className="close-btn" onClick={() => setShowSettleModal(false)}>✕</button>
            </div>

            {/* Direction Selector Tabs */}
            <div className="pill-row" style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <button
                type="button"
                className={`pill small ${settleDirection === 'pay' ? 'active' : ''}`}
                onClick={() => setSettleDirection('pay')}
              >
                I Paid (Repaid Debt)
              </button>
              <button
                type="button"
                className={`pill small ${settleDirection === 'receive' ? 'active' : ''}`}
                onClick={() => setSettleDirection('receive')}
              >
                I Received (Collected)
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="modal-form">
              <div className="field">
                <label>{settleDirection === 'pay' ? 'Pay To (Recipient)' : 'Received From (Payer)'}</label>
                <select value={settlePayee || activeCircle.members?.find(m => m.name !== userName)?.name || ''} onChange={e => setSettlePayee(e.target.value)}>
                  {activeCircle.members?.filter(m => m.name !== userName).map(m => (
                    <option key={m.id} value={m.name}>{m.name} {m.isGhost ? '(Ghost)' : ''}</option>
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

              <div className="field">
                <label>Payment Method</label>
                <select value={settleMethod} onChange={e => setSettleMethod(e.target.value)}>
                  <option value="UPI">UPI App (GPay / PhonePe / Paytm)</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              {settleMethod === 'UPI' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a
                    href={`upi://pay?pa=${activeCircle.members?.find(m => m.name === settlePayee)?.upiId || 'partner@upi'}&pn=${encodeURIComponent(settlePayee)}&am=${settleAmount || '0'}&cu=INR`}
                    className="btn-upi-app"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {settleDirection === 'pay' ? 'Pay via Instant UPI App' : 'Generate UPI Request Link'}
                  </a>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {settleDirection === 'pay' ? 'Confirm Payment & Log' : 'Record Received Repayment'}
                </button>
                {settleDirection === 'receive' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleSendReminder}
                    style={{ flexShrink: 0, height: '42px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
                  >
                    Send Nudge
                  </button>
                )}
              </div>
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
