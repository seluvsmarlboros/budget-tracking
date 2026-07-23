import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';

export default function Activity() {
  const { state, addFriend, settleUp, addSpike, addGroupSplit, deleteSpike, executeEqualize } = useStateContext();
  const { friends, spikes, transactions, user } = state;
  const sym = user?.currency || '₹';
  const friendsList = friends?.list || [];
  const friendBalances = friends?.balances || {};

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState('all'); // all, expense, commute, split, income
  const [searchQuery, setSearchQuery] = useState('');
  const [showPeerDrawer, setShowPeerDrawer] = useState(false);

  // Dialogs and states
  const [friendName, setFriendName] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleFriend, setSettleFriend] = useState('');
  const [settleDesc, setSettleDesc] = useState('');

  // Spike form state
  const [spikeTitle, setSpikeTitle] = useState('');
  const [spikeAmount, setSpikeAmount] = useState('');
  const [spikeDate, setSpikeDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Group split form state
  const [groupAmount, setGroupAmount] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);

  // Equalize debts list
  const [equalizedTransactions, setEqualizedTransactions] = useState([]);

  // QR Display code
  const [qrFriend, setQrFriend] = useState('');
  const [qrAmount, setQrAmount] = useState(0);

  // Modal Visibility States
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showSpikeModal, setShowSpikeModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showEqualizeModal, setShowEqualizeModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const qrCodeContainerRef = useRef(null);

  // Formatting helpers
  const cur = (amount) => {
    return sym + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - d) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Generate QR Code dynamically
  useEffect(() => {
    if (showQrModal && qrFriend && qrAmount && qrCodeContainerRef.current) {
      qrCodeContainerRef.current.innerHTML = '';
      const upiId = user?.upiId;
      if (!upiId) {
        window.toast('Please configure your UPI ID in Settings to show QR.');
        setQrFriend('');
        setShowQrModal(false);
        window.location.hash = '#settings';
        return;
      }

      const note = `Split share for ${qrFriend}`;
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(user.name || 'Alex')}&am=${qrAmount}&tn=${encodeURIComponent(note)}`;

      if (typeof window.QRCode !== 'undefined') {
        new window.QRCode(qrCodeContainerRef.current, {
          text: upiUrl,
          width: 180,
          height: 180,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } else {
        window.toast('QR generator library is loading...');
      }
    }
  }, [showQrModal, qrFriend, qrAmount]);

  // Handle Add Friend
  const handleAddFriendSubmit = (e) => {
    e.preventDefault();
    const name = friendName.trim();
    if (!name) return;

    if (addFriend(name)) {
      window.toast(`Added Friend: ${name}`);
      setFriendName('');
      setShowFriendModal(false);
    } else {
      window.toast('Friend already exists');
    }
  };

  // Handle Settle up click
  const handleSettleClick = (friend) => {
    const bal = friendBalances[friend] || 0;
    setSettleFriend(friend);
    setSettleAmount(Math.abs(bal).toString());
    setSettleDesc(bal > 0 ? `${friend} owes you ${cur(bal)}` : `You owe ${friend} ${cur(Math.abs(bal))}`);
    setShowSettleModal(true);
  };

  const handleSettleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!settleFriend || isNaN(amt) || amt <= 0) return;

    settleUp(settleFriend, amt, 'UPI');
    window.toast(`Repayment logged with ${settleFriend}`);
    setShowSettleModal(false);
  };

  // Handle Spike Submit
  const handleSpikeSubmit = (e) => {
    e.preventDefault();
    const title = spikeTitle.trim();
    const amt = parseFloat(spikeAmount);

    if (!title || isNaN(amt) || amt <= 0 || !spikeDate) return;

    addSpike({ title, amount: amt, date: spikeDate });
    window.toast(`Added upcoming expense: ${title}`);
    setSpikeTitle('');
    setSpikeAmount('');
    setShowSpikeModal(false);
  };

  // Handle Group split initialization
  const handleOpenGroupSplit = () => {
    setGroupMembers([user.name || 'Me']);
    setGroupAmount('');
    setGroupDesc('');
    setShowGroupModal(true);
  };

  const handleGroupMemberToggle = (name) => {
    setGroupMembers(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const handleGroupSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(groupAmount);
    const desc = groupDesc.trim();

    if (isNaN(amt) || amt <= 0 || !desc || groupMembers.length < 2) {
      window.toast('Select at least 2 members & enter valid inputs');
      return;
    }

    addGroupSplit(amt, desc, groupMembers);
    window.toast('Group split logged!');
    setShowGroupModal(false);
  };

  const groupSplitShare = parseFloat(groupAmount) && groupMembers.length >= 2
    ? (parseFloat(groupAmount) / groupMembers.length)
    : 0;

  // Handle Equalize debts algorithm
  const handleEqualize = () => {
    const debtors = [];
    const creditors = [];

    friendsList.forEach(f => {
      const bal = friendBalances[f] || 0;
      if (bal > 0) debtors.push({ name: f, amount: bal });
      else if (bal < 0) creditors.push({ name: f, amount: Math.abs(bal) });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const txs = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const minAmt = Math.min(debtor.amount, creditor.amount);

      txs.push({
        from: debtor.name,
        to: creditor.name,
        amount: minAmt
      });

      debtor.amount -= minAmt;
      creditor.amount -= minAmt;

      if (debtor.amount <= 0.01) dIdx++;
      if (creditor.amount <= 0.01) cIdx++;
    }

    setEqualizedTransactions(txs);
    setShowEqualizeModal(true);
  };

  const handleSettleAllEqualized = () => {
    try {
      executeEqualize(equalizedTransactions);
      window.toast('All minimized transfers recorded!');
      setShowEqualizeModal(false);
    } catch (err) {
      window.toast(`Failed to equalize debts: ${err.message}`);
    }
  };

  const handleShowQr = (friend, amount) => {
    setQrFriend(friend);
    setQrAmount(amount);
    setShowQrModal(true);
  };

  // Render spike row details
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingSpikes = (spikes || []).filter(s => new Date(s.date + 'T00:00:00') >= today);
  const nextSpike = upcomingSpikes.length > 0 ? upcomingSpikes[0] : null;
  const nextSpikeDays = nextSpike
    ? Math.ceil((new Date(nextSpike.date + 'T00:00:00') - today) / 864e5)
    : 0;

  // Filter & Search unified feed logs
  let entries = [];
  (transactions || []).forEach(t => {
    let tag = t.type;
    if (t.category === 'Travel') tag = 'commute';
    if (t.description && (t.description.includes('split') || t.description.includes('Settle') || t.description.includes('Borrowed') || t.description.includes('Group Split'))) {
      tag = 'split';
    }
    entries.push({ ...t, tag });
  });

  // Filter
  if (activeFilter !== 'all') {
    entries = entries.filter(e => {
      if (activeFilter === 'expense') return e.type === 'expense' && e.tag !== 'commute' && e.tag !== 'split';
      if (activeFilter === 'commute') return e.tag === 'commute';
      if (activeFilter === 'split') return e.tag === 'split';
      if (activeFilter === 'income') return e.type === 'income';
      return true;
    });
  }

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    entries = entries.filter(e =>
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q))
    );
  }

  // Sort descending by date
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Compute stat summary
  const totalOutflow = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalInflow = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Group by date
  const groupedFeed = {};
  entries.forEach(e => {
    if (!groupedFeed[e.date]) groupedFeed[e.date] = [];
    groupedFeed[e.date].push(e);
  });

  const getTransactionIcon = (t) => {
    if (t.type === 'income') {
      return (
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(74, 222, 128, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>
      );
    } else if (t.tag === 'commute') {
      return (
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="4" width="14" height="16" rx="2"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/><path d="M12 8h.01"/><path d="M9 12h6"/>
          </svg>
        </div>
      );
    } else if (t.tag === 'split') {
      return (
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(167, 139, 250, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="15" y2="17"/>
          </svg>
        </div>
      );
    } else {
      return (
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(248, 113, 113, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
          </svg>
        </div>
      );
    }
  };

  const activeFriendBal = friendsList.filter(f => (friendBalances[f] || 0) !== 0);

  return (
    <section id="view-activity" className="view active" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Activity Stream</h1>
          <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Real-time timeline of expenses, splits, and settlements.</p>
        </div>

        {/* Header Quick Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShowPeerDrawer(!showPeerDrawer)}
            style={{ fontSize: '12px', height: '34px' }}
          >
            Peer IOUs ({activeFriendBal.length})
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShowSpikeModal(true)}
            style={{ fontSize: '12px', height: '34px' }}
          >
            + Spike
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '14px 16px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Logs</span>
          <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: 'var(--text)' }}>{entries.length}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', background: 'rgba(248, 113, 113, 0.05)', borderColor: 'rgba(248, 113, 113, 0.2)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--red)', fontWeight: 600, letterSpacing: '0.5px' }}>Total Outflow</span>
          <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: 'var(--red)' }}>{cur(totalOutflow)}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', background: 'rgba(74, 222, 128, 0.05)', borderColor: 'rgba(74, 222, 128, 0.2)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 600, letterSpacing: '0.5px' }}>Total Inflow</span>
          <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: 'var(--green)' }}>{cur(totalInflow)}</div>
        </div>
      </div>

      {/* Collapsible Peer IOUs Drawer */}
      {showPeerDrawer && (
        <div className="card" style={{ marginBottom: '20px', background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Peer Balances & IOUs</h3>
              <p className="muted" style={{ fontSize: '11.5px', margin: '2px 0 0 0' }}>Outstanding balances with friends</p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFriendModal(true)}>+ Friend</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleOpenGroupSplit}>Group Bill</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleEqualize}>Equalize</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {friendsList.length === 0 ? (
              <p className="empty-state" style={{ padding: '16px 0', fontSize: '12.5px' }}>No friends added yet. Click + Friend to add!</p>
            ) : (
              friendsList.map(f => {
                const bal = friendBalances[f] || 0;
                let label = 'Settled up';
                let cls = 'muted';

                if (bal > 0) {
                  label = `owes you ${cur(bal)}`;
                  cls = 'green';
                } else if (bal < 0) {
                  label = `you owe ${cur(Math.abs(bal))}`;
                  cls = 'red';
                }

                return (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{f}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: cls === 'green' ? 'var(--green)' : cls === 'red' ? 'var(--red)' : 'var(--text-muted)' }}>{label}</span>
                      {bal !== 0 && (
                        <button type="button" className="btn-ghost btn-sm" onClick={() => handleSettleClick(f)} style={{ padding: '2px 8px', height: '26px', fontSize: '11px' }}>Settle</button>
                      )}
                      {bal > 0 && (
                        <button type="button" className="btn-ghost btn-sm" onClick={() => handleShowQr(f, bal)} style={{ padding: '2px 8px', height: '26px', fontSize: '11px' }}>QR</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Upcoming Spike Banner */}
      {nextSpike && (
        <div className="card spike-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderLeft: '4px solid var(--orange)', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--orange)', fontWeight: 700, letterSpacing: '0.5px' }}>Upcoming Bill Spike</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{nextSpike.title}</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>in {nextSpikeDays}d ({nextSpike.date})</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px', color: 'var(--orange)', fontWeight: 800 }}>{cur(nextSpike.amount)}</span>
            <button type="button" className="btn-danger btn-sm" onClick={() => {
              deleteSpike(nextSpike.id);
              window.toast('Spike cleared');
            }} style={{ padding: '2px 6px', height: '26px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        
        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search activity description, category, or payment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'rgba(255, 255, 255, 0.03)',
              color: 'var(--text)',
              fontSize: '13px'
            }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Scrollable Filter Pills Bar */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button type="button" className={`pill small ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')} style={{ flexShrink: 0 }}>All</button>
          <button type="button" className={`pill small ${activeFilter === 'expense' ? 'active' : ''}`} onClick={() => setActiveFilter('expense')} style={{ flexShrink: 0 }}>Expenses</button>
          <button type="button" className={`pill small ${activeFilter === 'split' ? 'active' : ''}`} onClick={() => setActiveFilter('split')} style={{ flexShrink: 0 }}>Splits & Settles</button>
          <button type="button" className={`pill small ${activeFilter === 'commute' ? 'active' : ''}`} onClick={() => setActiveFilter('commute')} style={{ flexShrink: 0 }}>Commutes</button>
          <button type="button" className={`pill small ${activeFilter === 'income' ? 'active' : ''}`} onClick={() => setActiveFilter('income')} style={{ flexShrink: 0 }}>Income</button>
        </div>
      </div>

      {/* Unified Activity Timeline Stream */}
      <div id="activity-feed">
        {entries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>No activity logs found matching current filters.</p>
          </div>
        ) : (
          Object.keys(groupedFeed).sort((a, b) => b.localeCompare(a)).map(date => (
            <div key={date} style={{ marginBottom: '16px' }}>
              
              {/* Date Divider */}
              <div style={{ fontSize: '11px', fontWeight: 700, padding: '6px 4px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                {fmtDate(date)}
              </div>

              <div className="card" style={{ padding: '4px 16px' }}>
                {groupedFeed[date].map((t, idx) => (
                  <div
                    key={t.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 0',
                      borderBottom: idx !== groupedFeed[date].length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none'
                    }}
                  >
                    {getTransactionIcon(t)}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description || 'Transaction'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t.category && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>{t.category}</span>}
                        {t.paymentMethod && <span>• {t.paymentMethod}</span>}
                      </div>
                    </div>

                    <span style={{ fontWeight: 700, fontSize: '14.5px', color: t.type === 'income' ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.2px', flexShrink: 0 }}>
                      {t.type === 'income' ? '+' : '−'}{cur(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Friend */}
      {showFriendModal && (
        <div className="modal-overlay" onClick={() => setShowFriendModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Friend</h3>
              <button className="close-btn" onClick={() => setShowFriendModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddFriendSubmit}>
              <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Add a friend's display name to track balances.</p>
              <div className="field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  placeholder="e.g. Rohan"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowFriendModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add Friend</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Settle Up IOU */}
      {showSettleModal && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record IOU Settlement</h3>
              <button className="close-btn" onClick={() => setShowSettleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSettleSubmit}>
              <p style={{ fontSize: '13px', marginBottom: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                {settleDesc}
              </p>
              <div className="field">
                <label>Amount Settled ({sym})</label>
                <input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="₹"
                  required
                  step="any"
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowSettleModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Spike */}
      {showSpikeModal && (
        <div className="modal-overlay" onClick={() => setShowSpikeModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Large Future Expense</h3>
              <button className="close-btn" onClick={() => setShowSpikeModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSpikeSubmit}>
              <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Add exam fees, college deposits, or ticket fests.</p>
              <div className="field">
                <label>Expense Title</label>
                <input
                  type="text"
                  value={spikeTitle}
                  onChange={(e) => setSpikeTitle(e.target.value)}
                  placeholder="e.g. Odd-Sem Exam Fee"
                  required
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Estimated Amount ({sym})</label>
                  <input
                    type="number"
                    value={spikeAmount}
                    onChange={(e) => setSpikeAmount(e.target.value)}
                    placeholder="₹"
                    required
                  />
                </div>
                <div className="field">
                  <label>Expected Date</label>
                  <input
                    type="date"
                    value={spikeDate}
                    onChange={(e) => setSpikeDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowSpikeModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add Spike</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Group Split */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log Group Bill Split</h3>
              <button className="close-btn" onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGroupSubmit}>
              <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Divide a shared bill equally among roommates or friends.</p>
              <div className="field">
                <label>Total Bill Amount ({sym})</label>
                <input
                  type="number"
                  value={groupAmount}
                  onChange={(e) => setGroupAmount(e.target.value)}
                  placeholder="e.g. 1200"
                  required
                />
              </div>
              <div className="field">
                <label>Bill Description</label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="e.g. Hostel Pizza pool"
                  required
                />
              </div>
              <div className="field">
                <label>Select Members Involved</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: '120px', overflowY: 'auto', marginTop: '4px' }}>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
                    <input type="checkbox" checked disabled /> {user.name || 'Me'}
                  </label>
                  {friendsList.map(f => (
                    <label key={f} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        value={f}
                        checked={groupMembers.includes(f)}
                        onChange={() => handleGroupMemberToggle(f)}
                      /> {f}
                    </label>
                  ))}
                </div>
              </div>

              {groupSplitShare > 0 && (
                <div style={{ fontWeight: 600, color: 'var(--accent)', marginTop: '8px', marginBottom: '14px', fontSize: '12.5px' }}>
                  {cur(groupSplitShare)} per person ({groupMembers.length} people)
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowGroupModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Record Split</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Equalize Debts */}
      {showEqualizeModal && (
        <div className="modal-overlay" onClick={() => setShowEqualizeModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Equalize Friend Debts</h3>
              <button className="close-btn" onClick={() => setShowEqualizeModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.4 }}>
              UniSpend has minimized total transfers needed to settle all balances.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {equalizedTransactions.length === 0 ? (
                <p className="empty-state" style={{ textAlign: 'center', padding: '16px 0', margin: 0, fontSize: '12.5px' }}>All debts are already settled!</p>
              ) : (
                equalizedTransactions.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                    <span><strong>{t.from}</strong> pays <strong>{t.to}</strong></span>
                    <strong style={{ color: 'var(--accent)' }}>{cur(t.amount)}</strong>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowEqualizeModal(false)} style={{ flex: 1 }}>Close</button>
              {equalizedTransactions.length > 0 && (
                <button type="button" className="btn-primary" onClick={handleSettleAllEqualized} style={{ flex: 1 }}>Settle All</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Display */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Pay {user.name || 'Alex'}</h3>
              <button className="close-btn" onClick={() => setShowQrModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: '12px', margin: '4px 0 16px 0' }}>
              {qrFriend} can scan this QR to pay {cur(qrAmount)}
            </p>
            <div ref={qrCodeContainerRef} style={{ display: 'inline-flex', padding: '14px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px' }}></div>
            <button type="button" className="btn-ghost" onClick={() => setShowQrModal(false)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

    </section>
  );
}
