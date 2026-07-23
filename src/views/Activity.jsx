import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';

export default function Activity() {
  const { state, addFriend, settleUp, addSpike, addGroupSplit, deleteSpike, executeEqualize } = useStateContext();
  const { friends, spikes, transactions, user } = state;
  const sym = user.currency || '₹';
  const friendsList = friends?.list || [];
  const friendBalances = friends?.balances || {};

  // State filters
  const [activeFilter, setActiveFilter] = useState('all'); // all, expense, commute, split, income

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

  // Dialog Refs
  const friendDialogRef = useRef(null);
  const settleDialogRef = useRef(null);
  const spikeDialogRef = useRef(null);
  const groupDialogRef = useRef(null);
  const equalizeDialogRef = useRef(null);
  const qrDialogRef = useRef(null);
  
  const qrCodeContainerRef = useRef(null);

  // Formatting helpers
  const cur = (amount) => {
    return sym + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(); 
    today.setHours(0,0,0,0);
    const diff = Math.floor((today - d) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // Generate QR Code dynamically using cdn script QRCode
  useEffect(() => {
    if (qrFriend && qrAmount && qrCodeContainerRef.current) {
      qrCodeContainerRef.current.innerHTML = '';
      const upiId = user.upiId;
      if (!upiId) {
        window.toast('Please configure your UPI ID in Settings to show QR!');
        setQrFriend('');
        if (qrDialogRef.current) qrDialogRef.current.close();
        location.hash = '#settings';
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
        window.toast('QR generator library is loading... Open again.');
      }
    }
  }, [qrFriend, qrAmount]);

  // Handle Add Friend
  const handleAddFriendSubmit = (e) => {
    e.preventDefault();
    const name = friendName.trim();
    if (!name) return;

    if (addFriend(name)) {
      window.toast(`Added Friend: ${name}`);
      setFriendName('');
      if (friendDialogRef.current) friendDialogRef.current.close();
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
    if (settleDialogRef.current) settleDialogRef.current.showModal();
  };

  const handleSettleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!settleFriend || isNaN(amt) || amt <= 0) return;

    settleUp(settleFriend, amt, 'UPI');
    window.toast(`Repayment logged with ${settleFriend}`);
    if (settleDialogRef.current) settleDialogRef.current.close();
  };

  // Handle Spike Submit
  const handleSpikeSubmit = (e) => {
    e.preventDefault();
    const title = spikeTitle.trim();
    const amt = parseFloat(spikeAmount);

    if (!title || isNaN(amt) || amt <= 0 || !spikeDate) return;

    addSpike({ title, amount: amt, date: spikeDate });
    window.toast(`Added upcoming expense: ${title} ⏰`);
    setSpikeTitle('');
    setSpikeAmount('');
    if (spikeDialogRef.current) spikeDialogRef.current.close();
  };

  // Handle Group split initialization
  const handleOpenGroupSplit = () => {
    setGroupMembers([user.name || 'Me']);
    setGroupAmount('');
    setGroupDesc('');
    if (groupDialogRef.current) groupDialogRef.current.showModal();
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
    if (groupDialogRef.current) groupDialogRef.current.close();
  };

  // Group split hint helper
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
    if (equalizeDialogRef.current) equalizeDialogRef.current.showModal();
  };

  // Record all minimized transfers
  const handleSettleAllEqualized = () => {
    try {
      executeEqualize(equalizedTransactions);
      window.toast('All minimized transfers recorded!');
      if (equalizeDialogRef.current) equalizeDialogRef.current.close();
    } catch (err) {
      window.toast(`Failed to equalize debts: ${err.message}`);
    }
  };

  // Handle QR code display trigger
  const handleShowQr = (friend, amount) => {
    setQrFriend(friend);
    setQrAmount(amount);
    if (qrDialogRef.current) qrDialogRef.current.showModal();
  };

  // Render spike row details
  const today = new Date(); 
  today.setHours(0,0,0,0);
  const upcomingSpikes = spikes.filter(s => new Date(s.date + 'T00:00:00') >= today);
  const nextSpike = upcomingSpikes.length > 0 ? upcomingSpikes[0] : null;
  const nextSpikeDays = nextSpike
    ? Math.ceil((new Date(nextSpike.date + 'T00:00:00') - today) / 864e5)
    : 0;

  // Filter unified feed logs
  let entries = [];
  transactions.forEach(t => {
    let tag = t.type; // income / expense
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

  // Sort descending
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Group by date YYYY-MM-DD
  const groupedFeed = {};
  entries.forEach(e => {
    if (!groupedFeed[e.date]) groupedFeed[e.date] = [];
    groupedFeed[e.date].push(e);
  });

  const getTransactionIcon = (t) => {
    if (t.type === 'income') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
      );
    } else if (t.tag === 'commute') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4" width="14" height="16" rx="2"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/><path d="M12 8h.01"/><path d="M9 12h6"/>
        </svg>
      );
    } else if (t.tag === 'split') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="15" y2="17"/>
        </svg>
      );
    } else {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
        </svg>
      );
    }
  };

  const activeFriendBal = friendsList.filter(f => (friendBalances[f] || 0) !== 0);

  return (
    <section id="view-activity" className="view active">
      <h1>Activity Hub</h1>

      {/* Friends Balances Grid Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Peer Balances</h3>
            <p className="muted" style={{ fontSize: '11.5px', margin: '2px 0 0 0' }}>Outstanding IOUs: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{activeFriendBal.length} active</span></p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-ghost btn-sm" id="btn-add-friend-activity" onClick={() => friendDialogRef.current?.showModal()}>+ Friend</button>
            <button type="button" className="btn btn-ghost btn-sm" id="btn-group-split" onClick={handleOpenGroupSplit}>Group Bill</button>
            <button type="button" className="btn btn-ghost btn-sm" id="btn-equalize" onClick={handleEqualize}>Equalize</button>
          </div>
        </div>

        <div id="balances-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {friendsList.length === 0 ? (
            <p className="empty-state" style={{ padding: '16px 0' }}>No friends added yet. Tap Add Friend to start!</p>
          ) : (
            friendsList.map(f => {
              const bal = friendBalances[f] || 0;
              let label = 'settled';
              let cls = 'muted';
              
              if (bal > 0) {
                label = `owes you ${cur(bal)}`;
                cls = 'green';
              } else if (bal < 0) {
                label = `you owe ${cur(Math.abs(bal))}`;
                cls = 'red';
              }

              return (
                <div className="feed-item" key={f} style={{ borderBottom: 'none', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14.5px' }}>{f}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`feed-amount ${cls}`} style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
                    {bal !== 0 && (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => handleSettleClick(f)} style={{ padding: '4px 10px', height: '28px' }}>Settle</button>
                    )}
                    {bal > 0 && (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => handleShowQr(f, bal)} style={{ padding: '4px 8px', height: '28px' }} title="Show pay QR">QR</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Upcoming Spike Banner */}
      <div id="no-spike-row" style={{ display: nextSpike ? 'none' : 'block', marginBottom: '20px' }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
          <span className="muted" style={{ fontSize: '12.5px' }}>No upcoming exam fests or fee spikes logged.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => spikeDialogRef.current?.showModal()}>+ Add Spike</button>
        </div>
      </div>
      
      {nextSpike && (
        <div className="card spike-banner" id="activity-spike" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderLeftWidth: '4px', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--orange)', fontWeight: 600, letterSpacing: '0.5px' }}>Next Bill Spike</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span className="spike-title" id="act-spike-title">{nextSpike.title}</span>
              <span className="spike-date" id="act-spike-meta" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>in {nextSpikeDays}d ({nextSpike.date})</span>
            </div>
          </div>
          <div className="spike-right">
            <span className="spike-amount" id="act-spike-amount" style={{ fontSize: '18px', color: 'var(--orange)', fontWeight: 700 }}>{cur(nextSpike.amount)}</span>
            <button type="button" className="btn-danger btn-sm" onClick={() => {
              deleteSpike(nextSpike.id);
              window.toast('Spike cleared');
            }} style={{ padding: '4px 8px', height: '28px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Unified Feed Tags / Filters */}
      <div className="pill-row wrap" id="filter-row" style={{ marginBottom: '16px' }}>
        <button type="button" className={`pill small ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All Activities</button>
        <button type="button" className={`pill small ${activeFilter === 'expense' ? 'active' : ''}`} onClick={() => setActiveFilter('expense')}>Personal Expenses</button>
        <button type="button" className={`pill small ${activeFilter === 'commute' ? 'active' : ''}`} onClick={() => setActiveFilter('commute')}>Commutes</button>
        <button type="button" className={`pill small ${activeFilter === 'split' ? 'active' : ''}`} onClick={() => setActiveFilter('split')}>IOU Splits</button>
        <button type="button" className={`pill small ${activeFilter === 'income' ? 'active' : ''}`} onClick={() => setActiveFilter('income')}>Extra Incomes</button>
      </div>

      {/* Unified List Feed grouped by date */}
      <div id="activity-feed">
        {entries.length === 0 ? (
          <p className="empty-state card" style={{ padding: '32px 0' }}>No activity logs discoverable matching filters.</p>
        ) : (
          Object.keys(groupedFeed).sort((a, b) => b.localeCompare(a)).map(date => (
            <div key={date}>
              <div className="feed-date-header muted" style={{ fontSize: '11px', fontWeight: 600, padding: '14px 0 6px 4px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                {fmtDate(date)}
              </div>
              <div className="card" style={{ padding: '0 16px', marginBottom: '8px' }}>
                {groupedFeed[date].map(t => (
                  <div className="feed-item" key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
                    <div className="feed-icon">{getTransactionIcon(t)}</div>
                    <div className="feed-body" style={{ flex: 1, minWidth: 0 }}>
                      <div className="feed-desc" style={{ fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description}
                      </div>
                      <div className="feed-meta" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t.category || ''}{t.paymentMethod ? ' · ' + t.paymentMethod : ''}
                      </div>
                    </div>
                    <span className={`feed-amount ${t.type === 'income' ? 'pos' : 'neg'}`} style={{ fontWeight: 600, color: t.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                      {t.type === 'income' ? '+' : '−'}{cur(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog: Add Friend */}
      <dialog id="dialog-friend" className="dialog" ref={friendDialogRef}>
        <form onSubmit={handleAddFriendSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => friendDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Add New Friend</h3>
          <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Add a friend's display name to log bills and track net balances.</p>
          <div className="field">
            <label htmlFor="inp-friend-name">Display Name</label>
            <input
              type="text"
              id="inp-friend-name"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="e.g. Rohan"
              required
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => friendDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Add Friend</button>
          </div>
        </form>
      </dialog>

      {/* Dialog: Settle Up IOU */}
      <dialog id="dialog-settle" className="dialog" ref={settleDialogRef}>
        <form onSubmit={handleSettleSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => settleDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Record IOU Settlement</h3>
          <p id="settle-desc" className="muted" style={{ fontSize: '13px', marginBottom: '14px', fontWeight: 600, color: 'var(--accent)' }}>
            {settleDesc}
          </p>

          <div className="field">
            <label htmlFor="settle-amount">Amount Settled</label>
            <input
              type="number"
              id="settle-amount"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="₹"
              required
              step="any"
            />
          </div>

          <input type="hidden" id="settle-friend" value={settleFriend} />
          
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => settleDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Record Payment</button>
          </div>
        </form>
      </dialog>

      {/* Dialog: Add Spike */}
      <dialog id="dialog-spike" className="dialog" ref={spikeDialogRef}>
        <form onSubmit={handleSpikeSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => spikeDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Add Large Future Expense</h3>
          <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Add exam fees, college deposits, or ticket fests to monitor savings runway.</p>
          
          <div className="field">
            <label htmlFor="spk-title">Expense Title</label>
            <input
              type="text"
              id="spk-title"
              value={spikeTitle}
              onChange={(e) => setSpikeTitle(e.target.value)}
              placeholder="e.g. Odd-Sem Exam Fee"
              required
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="spk-amount">Estimated Total ({sym})</label>
              <input
                type="number"
                id="spk-amount"
                value={spikeAmount}
                onChange={(e) => setSpikeAmount(e.target.value)}
                placeholder="₹"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="spk-date">Expected Date</label>
              <input
                type="date"
                id="spk-date"
                value={spikeDate}
                onChange={(e) => setSpikeDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="dialog-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-ghost" onClick={() => spikeDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Add Spike Template</button>
          </div>
        </form>
      </dialog>

      {/* Dialog: Group Split */}
      <dialog id="dialog-group" className="dialog" ref={groupDialogRef}>
        <form onSubmit={handleGroupSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => groupDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Log Group Bill Split</h3>
          <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Divide a shared group bill equally among roommates or friends.</p>
          
          <div className="field">
            <label htmlFor="grp-amount">Total Bill Amount ({sym})</label>
            <input
              type="number"
              id="grp-amount"
              value={groupAmount}
              onChange={(e) => setGroupAmount(e.target.value)}
              placeholder="e.g. 1200"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="grp-desc">Bill Description</label>
            <input
              type="text"
              id="grp-desc"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="e.g. Hostel Pizza pool"
              required
            />
          </div>

          <div className="field">
            <label>Select Members Involved</label>
            <div id="grp-members" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: '120px', overflowY: 'auto', marginTop: '4px' }}>
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
            <div id="grp-hint" className="hint" style={{ fontWeight: 600, color: 'var(--accent)', marginTop: '8px', marginBottom: '14px' }}>
              {cur(groupSplitShare)} per person ({groupMembers.length} people)
            </div>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => groupDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Record Group Split</button>
          </div>
        </form>
      </dialog>

      {/* Dialog: Equalize Debts */}
      <dialog id="dialog-equalize" className="dialog" ref={equalizeDialogRef}>
        <button type="button" className="btn-close-dialog" onClick={() => equalizeDialogRef.current?.close()} aria-label="Close dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h3>Equalize Friend Debts</h3>
        <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.4 }}>
          UniSpend has analyzed all negative and positive balances and minimized total transaction transfers.
        </p>

        <div id="equalize-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          {equalizedTransactions.length === 0 ? (
            <p className="empty-state" style={{ textAlign: 'center', padding: '16px 0', margin: 0 }}>All debts are already settled!</p>
          ) : (
            equalizedTransactions.map((t, i) => (
              <div key={i} className="equalize-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                <span><strong>{t.from}</strong> pays <strong>{t.to}</strong></span>
                <strong style={{ color: 'var(--accent)' }}>{cur(t.amount)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="dialog-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button type="button" className="btn-ghost" onClick={() => equalizeDialogRef.current?.close()} style={{ flex: 1 }}>Got it!</button>
          {equalizedTransactions.length > 0 && (
            <button type="button" className="btn-primary" onClick={handleSettleAllEqualized} style={{ flex: 1 }}>Settle All</button>
          )}
        </div>
      </dialog>

      {/* Dialog: QR Display Code */}
      <dialog id="dialog-qr-show" className="dialog" ref={qrDialogRef} style={{ maxWidth: '320px', textAlign: 'center' }}>
        <button type="button" className="btn-close-dialog" onClick={() => qrDialogRef.current?.close()} aria-label="Close dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h3 id="qr-title">Pay {user.name || 'Alex'}</h3>
        <p id="qr-desc" className="muted" style={{ fontSize: '12px', margin: '4px 0 16px 0' }}>
          {qrFriend} can scan this to pay split share of {cur(qrAmount)}
        </p>

        {/* QR Code Container mount */}
        <div id="qrcode" ref={qrCodeContainerRef} style={{ display: 'inline-flex', padding: '14px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px' }}></div>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={() => qrDialogRef.current?.close()} style={{ width: '100%' }}>Close</button>
        </div>
      </dialog>

    </section>
  );
}
