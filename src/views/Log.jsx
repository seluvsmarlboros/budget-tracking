import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';
import { parseUPIAndSMS } from '../services/smsParser';
import { scanReceipt } from '../services/ocr';

export default function Log() {
  const { state, addTransaction, addSplitIOU, addFriend } = useStateContext();
  
  // Local form state
  const [type, setType] = useState('expense'); // expense, income, split
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Split IOU state
  const [splitDir, setSplitDir] = useState('lent'); // lent, borrowed
  const [splitMode, setSplitMode] = useState('half'); // half, full
  const [splitFriend, setSplitFriend] = useState('');
  
  // Dialog refs
  const friendDialogRef = useRef(null);
  const qrDialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const qrScannerRef = useRef(null);
  
  // New friend form state
  const [newFriendName, setNewFriendName] = useState('');
  
  const { categories, friends, user } = state;
  const sym = user.currency || '₹';

  // Set default category when categories load or change
  useEffect(() => {
    if (categories && categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [categories]);

  // QR scanner instance placeholder
  const html5QrScanner = useRef(null);

  const handleTypeChange = (newType) => {
    setType(newType);
  };

  const handlePasteSMS = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) {
        window.toast('Clipboard is empty! Copy a UPI / banking SMS alert first.');
        return;
      }

      const parsed = parseUPIAndSMS(clipboardText);
      if (parsed) {
        if (parsed.amount) setAmount(parsed.amount.toString());
        if (parsed.description) setDescription(parsed.description);
        if (parsed.date) setDate(parsed.date);
        if (parsed.type) setType(parsed.type);
        window.toast(`Autofilled ₹${parsed.amount || ''} from clipboard! 📋`);
      } else {
        window.toast('No transaction details discovered in copied text.');
      }
    } catch (err) {
      console.error('Clipboard reading failed:', err);
      window.toast('Permission to read clipboard is required.');
    }
  };

  const handleOCRFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let originalText = 'Scan Receipt 🧾';
    try {
      const parsed = await scanReceipt(file, (status) => {
        window.toast(status);
      });
      if (parsed) {
        if (parsed.amount) {
          setAmount(parsed.amount.toString());
          window.toast(`Autofilled: ₹${parsed.amount}! 🧾`);
        } else {
          window.toast('Scan complete. No numeric totals found.');
        }
        if (parsed.description) {
          setDescription(parsed.description);
        }
        if (parsed.date) {
          setDate(parsed.date);
        }
      }
    } catch (err) {
      console.error(err);
      window.toast(`OCR Scan failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const startQrScanner = () => {
    if (typeof window.Html5Qrcode === 'undefined') {
      window.toast('Scanner library loading... Try again.');
      return;
    }
    if (qrDialogRef.current) {
      qrDialogRef.current.showModal();
    }
    
    // Start scanning
    setTimeout(() => {
      try {
        html5QrScanner.current = new window.Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrScanner.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            const upi = parseUPILink(decodedText);
            if (upi) {
              if (upi.am) setAmount(parseFloat(upi.am).toString());
              let desc = '';
              if (upi.pn) desc += upi.pn;
              if (upi.tn) desc += (desc ? ' - ' : '') + upi.tn;
              setDescription(desc || 'UPI Payment');
              
              window.toast(`Scanned: ${upi.am ? '₹' + upi.am : ''} ${upi.pn ? 'to ' + upi.pn : ''}`);
              stopQrScanner();
            } else {
              if (!isNaN(decodedText) && parseFloat(decodedText) > 0) {
                setAmount(parseFloat(decodedText).toString());
                window.toast(`Scanned amount: ₹${decodedText}`);
                stopQrScanner();
              } else {
                window.toast('Scanned text: ' + decodedText.substring(0, 30));
              }
            }
          },
          () => {}
        ).catch(err => {
          console.error('Camera start failed', err);
          window.toast('Camera error. Check permissions.');
          if (qrDialogRef.current) qrDialogRef.current.close();
        });
      } catch (err) {
        console.error('QR start fail', err);
      }
    }, 100);
  };

  const stopQrScanner = () => {
    if (html5QrScanner.current) {
      html5QrScanner.current.stop().then(() => {
        html5QrScanner.current = null;
      }).catch(err => {
        console.error('Failed to stop scanner', err);
      });
    }
    if (qrDialogRef.current) {
      qrDialogRef.current.close();
    }
  };

  const parseUPILink = (urlText) => {
    if (!urlText.startsWith('upi://pay?')) return null;
    try {
      const params = new URLSearchParams(urlText.substring(urlText.indexOf('?')));
      return {
        pa: params.get('pa') || '',
        pn: params.get('pn') || '',
        am: params.get('am') || '',
        tn: params.get('tn') || ''
      };
    } catch {
      return null;
    }
  };

  const handleAddFriendSubmit = (e) => {
    e.preventDefault();
    const name = newFriendName.trim();
    if (!name) return;

    if (addFriend(name)) {
      setSplitFriend(name);
      setNewFriendName('');
      window.toast(`Added friend: "${name}"`);
      if (friendDialogRef.current) friendDialogRef.current.close();
    } else {
      window.toast(`Friend "${name}" already exists`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const valAmt = parseFloat(amount);
    const valDesc = description.trim();
    
    if (!valAmt || valAmt <= 0) {
      window.toast('Please enter a valid amount');
      return;
    }
    if (!valDesc) {
      window.toast('Please enter a description');
      return;
    }
    if (!date) {
      window.toast('Please select a date');
      return;
    }

    if (type === 'split') {
      if (!splitFriend) {
        window.toast('Pick a friend');
        return;
      }
      addSplitIOU(splitDir, splitFriend, valAmt, valDesc, splitMode === 'half', date);
      window.toast(`Split logged with ${splitFriend}`);
    } else {
      addTransaction({
        type: type,
        category: category || 'Other',
        amount: valAmt,
        paymentMethod: paymentMethod,
        date: date,
        description: valDesc
      });
      window.toast(`${type === 'income' ? 'Income' : 'Expense'} logged`);
    }

    // Reset Form
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('expense');
  };

  // Live Split calculations for Hint
  const splitAmt = parseFloat(amount) || 0;
  const partAmt = splitMode === 'half' ? splitAmt / 2 : splitAmt;
  const resolvedFriend = splitFriend || 'friend';
  const splitHintText = type === 'split' && splitAmt > 0
    ? (splitDir === 'lent'
        ? `${resolvedFriend} will owe you ${sym}${partAmt.toFixed(2)}`
        : `You'll owe ${resolvedFriend} ${sym}${partAmt.toFixed(2)}`)
    : '';

  return (
    <section id="view-add" className="view active">
      <form id="log-form" className="card log-form" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifycontent: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Log Transaction</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              id="btn-scan-qr"
              onClick={startQrScanner}
              title="Scan QR Code"
              style={{ padding: '6px', height: 'auto', width: 'auto' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              id="btn-ocr-receipt"
              onClick={() => fileInputRef.current?.click()}
              title="Scan Receipt OCR"
              style={{ padding: '6px', height: 'auto', width: 'auto' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </button>
            <input
              type="file"
              id="ocr-file-input"
              ref={fileInputRef}
              onChange={handleOCRFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              id="btn-paste-sms"
              onClick={handlePasteSMS}
              title="Paste from clipboard"
              style={{ padding: '6px', height: 'auto', width: 'auto' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </button>
          </div>
        </div>

        {/* Transaction Type Selector */}
        <div className="pill-row wrap" id="type-pills" style={{ marginBottom: '24px' }}>
          <button
            type="button"
            className={`pill ${type === 'expense' ? 'active' : ''}`}
            onClick={() => handleTypeChange('expense')}
          >
            Expense
          </button>
          <button
            type="button"
            className={`pill ${type === 'income' ? 'active' : ''}`}
            onClick={() => handleTypeChange('income')}
          >
            Income
          </button>
          <button
            type="button"
            className={`pill ${type === 'split' ? 'active' : ''}`}
            onClick={() => handleTypeChange('split')}
          >
            Split Bill
          </button>
        </div>

        {/* Highlighted Amount Field */}
        <div className="amount-field">
          <span className="currency" id="log-currency">{sym}</span>
          <input
            type="number"
            id="log-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            step="any"
            required
            autoFocus
            inputMode="decimal"
          />
        </div>

        {/* Category Pills (Hidden in Split mode) */}
        {type !== 'split' && (
          <div className="field">
            <label>Category</label>
            <div className="pill-row wrap" id="cat-pills" style={{ marginTop: '4px' }}>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`pill small ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Split Controls (Visible only in Split mode) */}
        {type === 'split' && (
          <div id="split-controls" style={{ display: 'block', marginTop: '12px' }}>
            <div className="field-row">
              <div className="field">
                <label>Split Type</label>
                <div className="pill-row" style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    className={`pill small ${splitMode === 'half' ? 'active' : ''}`}
                    onClick={() => setSplitMode('half')}
                  >
                    Split 50/50
                  </button>
                  <button
                    type="button"
                    className={`pill small ${splitMode === 'full' ? 'active' : ''}`}
                    onClick={() => setSplitMode('full')}
                  >
                    They owe full
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Flow Direction</label>
                <div className="pill-row" style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    className={`pill small ${splitDir === 'lent' ? 'active' : ''}`}
                    onClick={() => setSplitDir('lent')}
                  >
                    They owe me
                  </button>
                  <button
                    type="button"
                    className={`pill small ${splitDir === 'borrowed' ? 'active' : ''}`}
                    onClick={() => setSplitDir('borrowed')}
                  >
                    I owe them
                  </button>
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="split-friend">Friend Involved</label>
              <div className="friend-row">
                <select
                  id="split-friend"
                  value={splitFriend}
                  onChange={(e) => setSplitFriend(e.target.value)}
                  required
                >
                  <option value="" disabled>Choose...</option>
                  {friends.list.map((friend) => (
                    <option key={friend} value={friend}>
                      {friend}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost"
                  id="btn-friend-shortcut"
                  onClick={() => friendDialogRef.current?.showModal()}
                  style={{ height: '38px', padding: '0 12px' }}
                >
                  + Friend
                </button>
              </div>
            </div>
            
            {splitHintText && (
              <div id="split-hint" className="hint" style={{ fontWeight: 600, color: 'var(--accent)', marginTop: '-8px', marginBottom: '14px' }}>
                {splitHintText}
              </div>
            )}
          </div>
        )}

        {/* Date and Description Fields */}
        <div className="field-row">
          <div className="field">
            <label htmlFor="log-desc">Description</label>
            <input
              type="text"
              id="log-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Canteen lunch, Metro"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="log-date">Date</label>
            <input
              type="date"
              id="log-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Payment Method Selector (Hidden in Split mode) */}
        {type !== 'split' && (
          <div className="field">
            <label>Payment Method</label>
            <div className="pill-row" style={{ marginTop: '4px' }}>
              <button
                type="button"
                className={`pill small ${paymentMethod === 'UPI' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('UPI')}
              >
                UPI / NetBanking
              </button>
              <button
                type="button"
                className={`pill small ${paymentMethod === 'Cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Cash')}
              >
                Cash
              </button>
            </div>
          </div>
        )}

        {/* Submit Action */}
        <button type="submit" className="btn-primary" id="log-submit" style={{ width: '100%', marginTop: '12px', height: '48px', fontSize: '15px' }}>
          {type === 'income' ? 'Log Income' : type === 'split' ? 'Log Split IOU' : 'Log Expense'}
        </button>
      </form>

      {/* Add Friend Dialog modal shortcut */}
      <dialog id="dialog-friend" className="dialog" ref={friendDialogRef}>
        <form onSubmit={handleAddFriendSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => friendDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Add New Friend</h3>
          <p className="muted" style={{ fontSize: '12.5px', marginBottom: '14px' }}>Add a friend's display name to log bills and track net balances.</p>
          <div className="field">
            <label htmlFor="friend-name-input">Display Name</label>
            <input
              type="text"
              id="friend-name-input"
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              placeholder="e.g. Priyanshu, Ananya"
              required
              autoFocus
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => friendDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Add Friend</button>
          </div>
        </form>
      </dialog>

      {/* QR Scanner Dialog Modal */}
      <dialog id="dialog-scan" className="dialog" ref={qrDialogRef} style={{ maxWidth: '360px' }}>
        <button type="button" className="btn-close-dialog" onClick={stopQrScanner} aria-label="Close dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3>Scan Bill QR Code</h3>
          <p className="muted" style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Hold a UPI payment QR code or numeric bill total inside the box.</p>
        </div>
        
        <div id="reader" ref={qrScannerRef} style={{ width: '100%', background: '#000', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border)' }}></div>
        
        <div className="dialog-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn-ghost" onClick={stopQrScanner} style={{ width: '100%' }}>Cancel Scan</button>
        </div>
      </dialog>
    </section>
  );
}
