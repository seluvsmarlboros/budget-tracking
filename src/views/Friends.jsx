import React, { useState, useEffect, useRef } from 'react';
import { useStateContext } from '../contexts/StateContext';
import { SupabaseService, supabase } from '../services/supabase';

export default function Friends() {
  const { state, syncSupabaseBalances } = useStateContext();
  const sym = state?.user?.currency || '₹';
  const [currentUserId, setCurrentUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  
  // Navigation State within Friends View
  const [authState, setAuthState] = useState('auth'); // auth, unlinked, dashboard
  
  // Auth Form State
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState('');
  
  // Unlinked State
  const [activePartnerships, setActivePartnerships] = useState([]);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [connectedPartnerName, setConnectedPartnerName] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [directoryBalances, setDirectoryBalances] = useState({});

  // Connected Dashboard State
  const [activePartnership, setActivePartnership] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [balanceInfo, setBalanceInfo] = useState({ balance: 0, rawBalance: 0 });
  const [recurringTemplates, setRecurringTemplates] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [isReminderLoading, setIsReminderLoading] = useState(false);

  // Split form states
  const [activeTab, setActiveTab] = useState('expense'); // expense, loan
  const [splitType, setSplitType] = useState('equal'); // equal, percent, fixed, itemized
  const [sharedBillTitle, setSharedBillTitle] = useState('');
  const [sharedBillAmount, setSharedBillAmount] = useState('');
  const [sharedBillDue, setSharedBillDue] = useState('');
  const [sharedBillCat, setSharedBillCat] = useState('Shared');
  const [sharedBillRecurring, setSharedBillRecurring] = useState('none'); // none, daily, monthly
  
  // Percent split state
  const [percentSlider, setPercentSlider] = useState(50);
  
  // Fixed split state
  const [fixedMe, setFixedMe] = useState('');
  const [fixedPartner, setFixedPartner] = useState('');
  const [fixedWarn, setFixedWarn] = useState(false);

  // Itemized split state
  const [itemizedRows, setItemizedRows] = useState([{ id: 1, desc: '', amount: '', split: 'equal' }]);

  // Direct Loan Form State
  const [loanTitle, setLoanTitle] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDue, setLoanDue] = useState('');
  const [loanDir, setLoanDir] = useState('lend'); // lend, borrow

  // Settle Up State
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('UPI');

  // Collaborative Disconnect State
  const [disconnectVerifyCode, setDisconnectVerifyCode] = useState('');
  const [disconnectInputCode, setDisconnectInputCode] = useState('');
  
  // Dialog refs
  const settleDialogRef = useRef(null);
  const disconnectDialogRef = useRef(null);
  const qrDialogRef = useRef(null);

  // Full screen notification popup
  const [fullscreenNotification, setFullscreenNotification] = useState('');

  // 1. AUTH STATE CHECK
  const checkAuthState = async () => {
    try {
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        setAuthState('auth');
        return;
      }

      setCurrentUserId(user.id);
      const userProfile = await SupabaseService.getProfile(user.id);
      setProfile(userProfile);

      if (activePartnership) {
        const freshPartnerships = await SupabaseService.checkPartnerships();
        const updatedP = freshPartnerships.find(p => p.id === activePartnership.id);
        if (updatedP) {
          setActivePartnership(updatedP);
          const isUserA = updatedP.user_a && (typeof updatedP.user_a === 'object' ? updatedP.user_a.id === user.id : updatedP.user_a === user.id);
          const partnerProf = isUserA ? updatedP.user_b : updatedP.user_a;
          setPartnerProfile(partnerProf);
          setAuthState('dashboard');
          setupRealtimeSubscription(updatedP.id, user.id);
          try {
            await refreshDashboardData(updatedP, partnerProf, user.id);
          } catch (err) {
            console.error("Failed to refresh partner dashboard data:", err);
          }
          return;
        } else {
          setActivePartnership(null);
          setPartnerProfile(null);
        }
      }

      // Load unlinked directory screen
      const partnerships = await SupabaseService.checkPartnerships();
      setActivePartnerships(partnerships);
      setAuthState('unlinked');
      setupUnlinkedSubscription(user.id);

      // Resolve directory balances
      const balancesMap = {};
      for (const p of partnerships) {
        try {
          const bal = await SupabaseService.getNetBalance(p.id);
          balancesMap[p.id] = bal;
        } catch (err) {
          console.error("Failed to load net balance for partnership:", p.id, err);
          balancesMap[p.id] = { balance: 0, rawBalance: 0 };
        }
      }
      setDirectoryBalances(balancesMap);

      const invite = await SupabaseService.checkPendingInvite();
      setPendingInvite(invite);

    } catch (err) {
      console.error(err);
      setAuthState('auth');
    }
  };

  useEffect(() => {
    checkAuthState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        checkAuthState();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activePartnership?.id]);

  // 2. SUBSCRIPTIONS
  const realtimeSub = useRef(null);
  const unlinkedSub = useRef(null);

  const setupUnlinkedSubscription = (userId) => {
    if (unlinkedSub.current) unlinkedSub.current.unsubscribe();

    unlinkedSub.current = supabase
      .channel('unlinked-partnership')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partnerships' },
        async (payload) => {
          const p = payload.new;
          if (p && (p.user_a === userId || p.user_b === userId)) {
            if (p.status === 'active') {
              if (unlinkedSub.current) {
                unlinkedSub.current.unsubscribe();
                unlinkedSub.current = null;
              }
              // Get partner name
              let partnerName = 'Partner';
              try {
                const otherUserId = p.user_a === userId ? p.user_b : p.user_a;
                const pProfile = await SupabaseService.getProfile(otherUserId);
                if (pProfile) partnerName = pProfile.display_name || partnerName;
              } catch (e) {
                console.error(e);
              }
              setConnectedPartnerName(partnerName);
              setShowCelebration(true);
              window.toast(`🎉 Connected with ${partnerName}!`);
            }
          }
        }
      )
      .subscribe();
  };

  const setupRealtimeSubscription = (partnershipId, userId) => {
    if (realtimeSub.current) realtimeSub.current.unsubscribe();

    realtimeSub.current = supabase
      .channel(`partnership:${partnershipId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger_entries', filter: `partnership_id=eq.${partnershipId}` },
        async () => {
          console.log('Realtime ledger update detected');
          checkAuthState();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_expenses', filter: `partnership_id=eq.${partnershipId}` },
        async () => {
          console.log('Realtime shared expense update detected');
          checkAuthState();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new && payload.new.type === 'disconnect_code') {
            try {
              const info = JSON.parse(payload.new.message);
              setFullscreenNotification(`🔒 Disconnect Request: ${info.senderName || 'Your partner'} wants to disconnect. Share this security authorization code with them to verify: ${info.code}`);
            } catch (err) {
              setFullscreenNotification(payload.new.message);
            }
          } else {
            setFullscreenNotification(payload.new.message);
          }
          checkAuthState();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'partnerships', filter: `id=eq.${partnershipId}` },
        async (payload) => {
          if (payload.new.status === 'ended') {
            window.toast('⚠️ Your partner has disconnected from the partnership.');
            setActivePartnership(null);
            setPartnerProfile(null);
            setAuthState('unlinked');
          }
        }
      )
      .subscribe();
  };

  useEffect(() => {
    return () => {
      if (realtimeSub.current) realtimeSub.current.unsubscribe();
      if (unlinkedSub.current) unlinkedSub.current.unsubscribe();
    };
  }, []);

  // 3. REFRESH DASHBOARD DETAILS
  const refreshDashboardData = async (partnership, partnerProf, userId) => {
    const pName = partnerProf?.display_name || partnerProf?.id?.substring(0, 6) || (typeof partnerProf === 'string' ? partnerProf.substring(0, 6) : 'Partner');
    
    // Balance
    let balance = null;
    try {
      balance = await SupabaseService.getNetBalance(partnership.id);
    } catch (err) {
      console.error("Failed to load net balance:", err);
    }
    setBalanceInfo(balance || { balance: 0, rawBalance: 0 });

    // Sync to state provider context
    try {
      syncSupabaseBalances(balance?.rawBalance || 0, partnership.user_a, partnership.user_b);
    } catch (err) {
      console.error("Failed to sync supabase balances to state context:", err);
    }

    // Recurring templates
    let templates = [];
    try {
      templates = await SupabaseService.getRecurringTemplates(partnership.id);
    } catch (err) {
      console.error("Failed to load recurring templates:", err);
    }
    setRecurringTemplates(templates || []);

    // Activity
    let expenses = [];
    try {
      expenses = await SupabaseService.getSharedExpenses(partnership.id);
    } catch (err) {
      console.error("Failed to load shared expenses:", err);
    }

    let ledger = [];
    try {
      ledger = await SupabaseService.getLedgerEntries(partnership.id);
    } catch (err) {
      console.error("Failed to load ledger entries:", err);
    }

    const combined = [];
    (expenses || []).forEach(e => {
      combined.push({
        id: e.id,
        created_at: e.created_at,
        date: new Date(e.created_at),
        type: e.category === 'Loan' ? 'loan' : 'expense',
        title: e.title,
        total: parseFloat(e.total_amount || 0),
        added_by: e.added_by,
        user_a_owes: parseFloat(e.user_a_owes || 0),
        user_b_owes: parseFloat(e.user_b_owes || 0),
        recorded_by: e.added_by
      });
    });

    (ledger || []).filter(l => l && l.type === 'settlement').forEach(s => {
      combined.push({
        id: s.id,
        created_at: s.created_at,
        date: new Date(s.created_at),
        type: 'settlement',
        title: s.description || 'Settle Up',
        total: Math.abs(parseFloat(s.amount || 0)),
        added_by: s.recorded_by,
        recorded_by: s.recorded_by
      });
    });

    combined.sort((a, b) => b.date - a.date);
    setActivityLogs(combined);
  };

  // 4. ACTION HANDLERS
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const mail = authEmail.trim();
    const name = authName.trim();
    if (!mail || !name) return;

    setIsAuthLoading(true);
    setAuthMsg('');
    try {
      await SupabaseService.sendMagicLink(mail, name);
      setAuthMsg(`Magic link sent! Check your inbox at ${mail}.`);
      window.toast('Link sent! 📧');
    } catch (err) {
      window.toast(`Failed to sign in: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (realtimeSub.current) realtimeSub.current.unsubscribe();
      if (unlinkedSub.current) unlinkedSub.current.unsubscribe();
      
      await SupabaseService.signOut();
      setActivePartnership(null);
      setProfile(null);
      setPartnerProfile(null);
      setCurrentUserId(null);
      setAuthState('auth');
      window.toast('Signed out successfully.');
    } catch (err) {
      window.toast(`Sign out failed: ${err.message}`);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const invite = await SupabaseService.generateInvite();
      setPendingInvite(invite);
      window.toast('Invite code generated! 🔑');
    } catch (err) {
      window.toast(`Failed to create invite: ${err.message}`);
    }
  };

  const handleRedeemInvite = async (e) => {
    e.preventDefault();
    const code = redeemCode.trim();
    if (!code) return;

    setIsInviteLoading(true);
    try {
      const result = await SupabaseService.redeemInvite(code);
      setRedeemCode('');
      
      let partnerName = 'Partner';
      try {
        const pProfile = await SupabaseService.getProfile(result.user_a);
        if (pProfile) partnerName = pProfile.display_name || partnerName;
      } catch (e) {
        console.error(e);
      }
      setConnectedPartnerName(partnerName);
      setShowCelebration(true);
    } catch (err) {
      window.toast(err.message);
    } finally {
      setIsInviteLoading(false);
    }
  };

  const handleSendReminder = async () => {
    if (!activePartnership || !partnerProfile || balanceInfo.balance === 0) return;

    setIsReminderLoading(true);
    try {
      const senderName = profile.display_name || 'Your partner';
      await SupabaseService.sendReminderNotification(
        activePartnership.id,
        partnerProfile?.id,
        balanceInfo.balance,
        senderName
      );
      window.toast('Reminder notification sent! 🔔');
    } catch (err) {
      window.toast(`Failed to send reminder: ${err.message}`);
    } finally {
      setIsReminderLoading(false);
    }
  };

  const handleLeavePartnershipTrigger = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setDisconnectVerifyCode(code);

    if (partnerProfile && partnerProfile.id) {
      SupabaseService.sendDisconnectCodeNotification(
        partnerProfile.id,
        code,
        profile.display_name || 'Your partner'
      ).catch(err => console.error(err));
      window.toast('Disconnect authorization code sent to partner! 🔒');
    }

    setDisconnectInputCode('');
    if (disconnectDialogRef.current) {
      disconnectDialogRef.current.showModal();
    }
  };

  const handleDisconnectConfirm = async (e) => {
    e.preventDefault();
    if (disconnectInputCode !== disconnectVerifyCode) return;

    try {
      if (disconnectDialogRef.current) disconnectDialogRef.current.close();
      await SupabaseService.leavePartnership(activePartnership.id);
      if (realtimeSub.current) realtimeSub.current.unsubscribe();
      setActivePartnership(null);
      setPartnerProfile(null);
      window.toast('Disconnected partnership successfully.');
      checkAuthState();
    } catch (err) {
      window.toast(`Failed to disconnect: ${err.message}`);
    }
  };

  // 5. SPLIT COMPUTATIONS & SUBMISSION
  const handleAddItemizedRow = () => {
    setItemizedRows(prev => [...prev, { id: Date.now(), desc: '', amount: '', split: 'equal' }]);
  };

  const handleRemoveItemizedRow = (id) => {
    setItemizedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleItemizedRowChange = (id, field, val) => {
    setItemizedRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  // Compute itemized totals
  let itemizedMeTotal = 0;
  let itemizedPartnerTotal = 0;
  itemizedRows.forEach(r => {
    const amt = parseFloat(r.amount) || 0;
    if (r.split === 'me') itemizedMeTotal += amt;
    else if (r.split === 'partner') itemizedPartnerTotal += amt;
    else {
      itemizedMeTotal += amt / 2;
      itemizedPartnerTotal += amt / 2;
    }
  });

  const handleSharedExpenseSubmit = async (e) => {
    e.preventDefault();
    const title = sharedBillTitle.trim();
    let totalAmt = parseFloat(sharedBillAmount);

    if (splitType === 'itemized') {
      totalAmt = itemizedMeTotal + itemizedPartnerTotal;
    }

    if (!title || !totalAmt || totalAmt <= 0) {
      window.toast('Enter a valid title and amount');
      return;
    }

    let userAOwes = 0;
    let userBOwes = 0;
    const isUserA = activePartnership.user_a && (typeof activePartnership.user_a === 'object' ? activePartnership.user_a.id === currentUserId : activePartnership.user_a === currentUserId);

    if (splitType === 'equal') {
      userAOwes = totalAmt / 2;
      userBOwes = totalAmt / 2;
    } else if (splitType === 'percent') {
      const myOwes = totalAmt * (percentSlider / 100);
      const partnerOwes = totalAmt * ((100 - percentSlider) / 100);
      userAOwes = isUserA ? myOwes : partnerOwes;
      userBOwes = isUserA ? partnerOwes : myOwes;
    } else if (splitType === 'fixed') {
      const fMe = parseFloat(fixedMe) || 0;
      const fPartner = parseFloat(fixedPartner) || 0;
      if (Math.abs((fMe + fPartner) - totalAmt) > 0.05) {
        setFixedWarn(true);
        return;
      }
      setFixedWarn(false);
      userAOwes = isUserA ? fMe : fPartner;
      userBOwes = isUserA ? fPartner : fMe;
    } else if (splitType === 'itemized') {
      userAOwes = isUserA ? itemizedMeTotal : itemizedPartnerTotal;
      userBOwes = isUserA ? itemizedPartnerTotal : itemizedMeTotal;
    }

    let items = [];
    if (splitType === 'itemized') {
      items = itemizedRows.map(r => ({ name: r.desc || 'Item', amount: parseFloat(r.amount) || 0, split: r.split }));
    }

    const isRecurring = sharedBillRecurring === 'daily' || sharedBillRecurring === 'monthly';

    const expenseData = {
      partnershipId: activePartnership.id,
      title,
      totalAmount: totalAmt,
      splitType,
      splitDetail: JSON.stringify({
        splitType,
        userAOwes,
        userBOwes,
        items: items.length > 0 ? items : undefined
      }),
      userAOwes,
      userBOwes,
      dueDate: sharedBillDue || null,
      category: sharedBillCat,
      isRecurring
    };

    try {
      const res = await SupabaseService.addSharedExpense(expenseData);
      if (isRecurring && res) {
        const day = sharedBillDue ? new Date(sharedBillDue).getDate() : 1;
        await SupabaseService.addRecurringTemplate({
          partnershipId: activePartnership.id,
          title,
          totalAmount: totalAmt,
          splitType,
          splitDetail: JSON.stringify({
            splitType,
            userAOwes,
            userBOwes,
            items: items.length > 0 ? items : undefined
          }),
          dayOfMonth: day,
          category: sharedBillCat,
          frequency: sharedBillRecurring
        });
        window.toast(`Template & shared bill added! 📅`);
      } else {
        window.toast('Shared bill logged! 💸');
      }

      // Reset Form
      setSharedBillTitle('');
      setSharedBillAmount('');
      setSharedBillDue('');
      setSharedBillCat('Shared');
      setSharedBillRecurring('none');
      setSplitType('equal');
      setItemizedRows([{ id: Date.now(), desc: '', amount: '', split: 'equal' }]);
      setFixedMe('');
      setFixedPartner('');
      
      checkAuthState();
    } catch (err) {
      window.toast(`Failed to save: ${err.message}`);
    }
  };

  // Direct Loan Submit
  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(loanAmount);
    const title = loanTitle.trim();
    if (!amt || amt <= 0 || !title) {
      window.toast('Enter valid title and amount');
      return;
    }

    const isUserA = activePartnership.user_a && (typeof activePartnership.user_a === 'object' ? activePartnership.user_a.id === currentUserId : activePartnership.user_a === currentUserId);
    let userAOwes = 0;
    let userBOwes = 0;

    if (loanDir === 'lend') {
      userAOwes = isUserA ? 0 : amt;
      userBOwes = isUserA ? amt : 0;
    } else {
      userAOwes = isUserA ? 0 : -amt;
      userBOwes = isUserA ? -amt : 0;
    }

    const expenseData = {
      partnershipId: activePartnership.id,
      title,
      totalAmount: amt,
      splitType: 'fixed',
      splitDetail: JSON.stringify({ splitType: 'fixed', userAOwes, userBOwes, isLoan: true, direction: loanDir }),
      userAOwes,
      userBOwes,
      dueDate: loanDue || null,
      category: 'Loan',
      isRecurring: false
    };

    try {
      await SupabaseService.addSharedExpense(expenseData);
      window.toast('Direct loan logged successfully! 🤝');
      setLoanTitle('');
      setLoanAmount('');
      setLoanDue('');
      setLoanDir('lend');
      checkAuthState();
    } catch (err) {
      window.toast(`Failed to log loan: ${err.message}`);
    }
  };

  // Settle Up Submission
  const handleSettleUpOpen = () => {
    if (balanceInfo.balance === 0) {
      window.toast('No outstanding balances to settle.');
      return;
    }
    setSettleAmount(balanceInfo.balance.toFixed(2));
    if (settleDialogRef.current) {
      settleDialogRef.current.showModal();
    }
  };

  const handleSettleUpSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      window.toast('Please enter a valid settle amount');
      return;
    }

    const details = {
      description: `Settled ${sym}${amt.toFixed(2)} via ${settleMethod}`,
      partnerId: partnerProfile?.id,
      payerName: profile.display_name || 'Partner'
    };

    try {
      await SupabaseService.settleBalance(activePartnership.id, amt, details);
      window.toast('Settlement payment recorded! 🤝');
      if (settleDialogRef.current) settleDialogRef.current.close();
      checkAuthState();
    } catch (err) {
      window.toast(`Failed to settle: ${err.message}`);
    }
  };

  const handleLogTemplate = async (t) => {
    try {
      const detail = JSON.parse(t.split_detail);
      const expenseData = {
        partnershipId: activePartnership.id,
        title: t.title,
        totalAmount: parseFloat(t.total_amount),
        splitType: t.split_type,
        splitDetail: t.split_detail,
        userAOwes: parseFloat(detail.userAOwes),
        userBOwes: parseFloat(detail.userBOwes),
        dueDate: new Date().toISOString().split('T')[0],
        category: t.category || "Shared",
        isRecurring: false
      };
      await SupabaseService.addSharedExpense(expenseData);
      window.toast(`Logged recurring bill: ${t.title}! ⚡`);
      checkAuthState();
    } catch (err) {
      window.toast(`Failed to log: ${err.message}`);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (window.confirm('Delete this recurring template?')) {
      try {
        await SupabaseService.deleteRecurringTemplate(id);
        window.toast('Template deleted.');
        checkAuthState();
      } catch (err) {
        window.toast(`Delete template failed: ${err.message}`);
      }
    }
  };

  // Helper selectors
  const isUserA = activePartnership ? (activePartnership.user_a && (typeof activePartnership.user_a === 'object' ? activePartnership.user_a.id === currentUserId : activePartnership.user_a === currentUserId)) : false;
  const isDebtor = activePartnership ? (((balanceInfo?.rawBalance || 0) > 0 && isUserA) || ((balanceInfo?.rawBalance || 0) < 0 && !isUserA)) : false;

  // Settle Pay Deep Link helper
  const getSettleUpPayLink = () => {
    const amt = parseFloat(settleAmount) || balanceInfo.balance;
    if (settleMethod === 'UPI' && partnerProfile?.upi_id) {
      return `upi://pay?pa=${partnerProfile.upi_id}&pn=${partnerProfile.display_name}&am=${amt.toFixed(2)}&cu=INR`;
    } else if (settleMethod === 'PayPal') {
      const paypalName = (partnerProfile?.display_name || '').replace(/\s+/g, '').toLowerCase();
      return `https://www.paypal.me/${paypalName}/${amt.toFixed(2)}`;
    }
    return null;
  };

  // Render Auth UI
  if (authState === 'auth') {
    return (
      <section id="partner-auth" className="view active" style={{ display: 'block' }}>
        <div className="card log-form" style={{ maxWidth: '440px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ marginBottom: '12px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-light)' }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <h2>Synced Friends (Supabase)</h2>
            <p className="muted" style={{ fontSize: '13px' }}>Sign in to connect, split group bills, and sync balances in real-time.</p>
          </div>
          <form id="partner-login-form" onSubmit={handleLoginSubmit}>
            <div className="field">
              <label htmlFor="partner-auth-name">Your Display Name</label>
              <input
                type="text"
                id="partner-auth-name"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="e.g. Rohan"
                required
                disabled={isAuthLoading}
              />
            </div>
            <div className="field">
              <label htmlFor="partner-auth-email">College Email Address</label>
              <input
                type="email"
                id="partner-auth-email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@college.edu"
                required
                disabled={isAuthLoading}
              />
            </div>
            <button type="submit" className="btn-primary" id="partner-auth-submit" style={{ width: '100%' }} disabled={isAuthLoading}>
              {isAuthLoading ? 'Sending Link...' : 'Send Magic Link'}
            </button>
          </form>
          {authMsg && (
            <div id="partner-auth-msg" className="hint" style={{ color: 'var(--accent)', textAlign: 'center', marginTop: '14px', lineHeight: 1.4 }}>
              {authMsg}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Render Unlinked Directory UI
  if (authState === 'unlinked') {
    return (
      <section id="partner-unlinked" className="view active" style={{ display: 'block' }}>
        {showCelebration && (
          <div id="celebration-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000, animation: 'fadeIn 0.3s' }}>
            <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Connection Successful!</h3>
              <p className="muted" style={{ fontSize: '13.5px', marginBottom: '24px' }}>You are now linked with <strong style={{ color: 'var(--accent)' }}>{connectedPartnerName}</strong> in Supabase.</p>
              <button type="button" className="btn-primary" onClick={() => { setShowCelebration(false); checkAuthState(); }}>Go to Dashboard</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>Hello, {profile?.display_name || 'Friend'}</h1>
            <p className="muted" style={{ fontSize: '13px', margin: 0 }}>Select a connected peer or establish a new link below.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" id="partner-logout-btn" onClick={handleLogout}>Logout</button>
        </div>

        {/* Sync directory list */}
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Your Synced Friends</h3>
          <div id="friends-directory-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activePartnerships.length === 0 ? (
              <div className="empty-state">No synced friends yet. Share a code below to connect!</div>
            ) : (
              activePartnerships.map(p => {
                const isUserA = p.user_a && (typeof p.user_a === 'object' ? p.user_a.id === currentUserId : p.user_a === currentUserId);
                const partnerUser = isUserA ? p.user_b : p.user_a;
                let pName = 'Partner';
                if (partnerUser) {
                  if (typeof partnerUser === 'object') {
                    pName = partnerUser.display_name || partnerUser.id?.substring(0, 6) || 'Partner';
                  } else {
                    pName = partnerUser.substring(0, 6);
                  }
                }
                const bal = directoryBalances[p.id] || { balance: 0, rawBalance: 0 };
                const partnerDebtor = ((bal.rawBalance || 0) > 0 && isUserA) || ((bal.rawBalance || 0) < 0 && !isUserA);

                let statusText = 'Settled';
                let statusColor = 'var(--text-muted)';
                let avatarClass = 'settled';

                if (bal.balance > 0) {
                  if (partnerDebtor) {
                    statusText = `you owe ₹${bal.balance.toFixed(2)}`;
                    statusColor = 'var(--red)';
                    avatarClass = 'owe';
                  } else {
                    statusText = `owes you ₹${bal.balance.toFixed(2)}`;
                    statusColor = 'var(--green)';
                    avatarClass = 'owed';
                  }
                }

                return (
                  <div
                    key={p.id}
                    className="friend-directory-item card"
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', marginBottom: '8px' }}
                    onClick={async () => {
                      setActivePartnership(p);
                      setPartnerProfile(partnerUser);
                      setAuthState('dashboard');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className={`friend-avatar-circle ${avatarClass}`} style={{ width: '36px', height: '36px', borderRadius: '50%', background: avatarClass === 'owe' ? 'rgba(255,69,58,0.1)' : avatarClass === 'owed' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', color: avatarClass === 'owe' ? 'var(--red)' : avatarClass === 'owed' ? 'var(--green)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {pName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '15px' }}>{pName}</div>
                        <div style={{ fontSize: '12px', color: statusColor, marginTop: '2px' }}>{statusText}</div>
                      </div>
                    </div>
                    <button type="button" className="btn-ghost btn-sm" style={{ padding: '6px 12px', width: 'auto' }}>Manage ➔</button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Establish new link cards */}
        <div className="field-row" style={{ marginTop: '16px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '8px' }}>Invite a Friend</h3>
            <p className="muted" style={{ fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.4 }}>Generate an invite code and share it with your college roommate or friend.</p>
            <button type="button" className="btn-primary btn-sm" id="gen-invite-btn" onClick={handleGenerateInvite} style={{ width: '100%' }}>Generate Code</button>
            
            {pendingInvite && (
              <div id="invite-code-display" style={{ marginTop: '14px', borderTop: '1px dashed var(--border)', paddingTop: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Your Connection Code:</span>
                <div id="invite-code-val" style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '4px', margin: '6px 0', color: 'var(--accent)' }}>{pendingInvite.invite_code}</div>
                <button type="button" className="btn-ghost btn-sm" id="copy-invite-link" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#partner-redeem?code=${pendingInvite.invite_code}`);
                  window.toast('Invite code link copied! 📋');
                }} style={{ width: '100%' }}>Copy Invite Link</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '8px' }}>Redeem Code</h3>
            <p className="muted" style={{ fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.4 }}>Enter the invite connection code received from your friend to establish link.</p>
            <form id="redeem-invite-form" onSubmit={handleRedeemInvite}>
              <div className="field" style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  id="redeem-code-input"
                  maxLength={6}
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB49D2"
                  required
                  disabled={isInviteLoading}
                  style={{ textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}
                />
              </div>
              <button type="submit" className="btn-primary btn-sm" id="redeem-submit-btn" style={{ width: '100%' }} disabled={isInviteLoading}>
                {isInviteLoading ? 'Linking...' : 'Connect Friend'}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // Render Connected Partner Dashboard
  return (
    <section id="partner-dashboard" className="view active" style={{ display: 'block' }}>
      
      {fullscreenNotification && (
        <div id="reminder-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
          <div className="card" style={{ maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔔</div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Message Alert</h3>
            <p className="muted" style={{ fontSize: '13.5px', lineHeight: '1.5', marginBottom: '24px' }}>{fullscreenNotification}</p>
            <button type="button" className="btn-primary" onClick={() => setFullscreenNotification('')}>Acknowledge</button>
          </div>
        </div>
      )}

      {/* Back to unlinked directory */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          id="friend-back-btn"
          onClick={() => {
            if (realtimeSub.current) realtimeSub.current.unsubscribe();
            setActivePartnership(null);
            setPartnerProfile(null);
            checkAuthState();
          }}
          style={{ width: 'auto' }}
        >
          ← Back to Synced Friends
        </button>
        <button type="button" className="btn btn-ghost btn-sm" id="partner-dash-logout" onClick={handleLogout} style={{ width: 'auto' }}>Logout</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Connection status header card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(197, 160, 89, 0.03) 100%)', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.5px' }}>Live Connection</div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 800 }} id="partner-display-name">
                {partnerProfile?.display_name || 'Partner'}
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isDebtor && balanceInfo.balance > 0 && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" id="send-reminder-btn" onClick={handleSendReminder} disabled={isReminderLoading}>
                    {isReminderLoading ? 'Sending...' : '⚡ Send Reminder'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" id="generate-qr-btn" onClick={() => qrDialogRef.current?.showModal()}>
                    📱 Generate UPI QR
                  </button>
                </>
              )}
              <button type="button" className="btn btn-primary btn-sm" id="settle-up-btn" onClick={handleSettleUpOpen}>🤝 Settle Up</button>
              <button type="button" className="btn btn-danger btn-sm" id="leave-partner-btn" onClick={handleLeavePartnershipTrigger}>Disconnect</button>
            </div>
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="stat-label" id="partner-balance-desc">
                {balanceInfo.balance === 0
                  ? 'All settled up!'
                  : (isDebtor ? `You owe ${partnerProfile?.display_name}` : `${partnerProfile?.display_name} owes you`)}
              </span>
              <div id="partner-balance-val" className={`stat-value ${balanceInfo.balance === 0 ? '' : (isDebtor ? 'red' : 'green')}`} style={{ fontSize: '26px', marginTop: '4px' }}>
                {sym}{balanceInfo.balance.toFixed(2)}
              </div>
            </div>
            {partnerProfile?.upi_id && (
              <div style={{ textAlign: 'right', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Partner UPI ID:<br /><strong style={{ color: 'var(--text-secondary)' }}>{partnerProfile.upi_id}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Tab logs selector */}
        <div className="card">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
            <button
              type="button"
              className={`btn-ghost ${activeTab === 'expense' ? 'active' : ''}`}
              onClick={() => setActiveTab('expense')}
              style={{ flex: 1, height: '44px', border: 'none', borderBottom: activeTab === 'expense' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'expense' ? 'var(--accent)' : 'var(--text-secondary)', background: 'transparent' }}
            >
              Log Shared Bill
            </button>
            <button
              type="button"
              className={`btn-ghost ${activeTab === 'loan' ? 'active' : ''}`}
              onClick={() => setActiveTab('loan')}
              style={{ flex: 1, height: '44px', border: 'none', borderBottom: activeTab === 'loan' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'loan' ? 'var(--accent)' : 'var(--text-secondary)', background: 'transparent' }}
            >
              Log Direct Loan
            </button>
          </div>

          {/* Form Shared Expense */}
          {activeTab === 'expense' && (
            <form id="shared-expense-form" onSubmit={handleSharedExpenseSubmit}>
              <div className="field">
                <label>Split Type</label>
                <div className="pill-row wrap" id="split-type-pills" style={{ marginTop: '4px' }}>
                  <button type="button" className={`pill small ${splitType === 'equal' ? 'active' : ''}`} onClick={() => setSplitType('equal')}>Split 50/50</button>
                  <button type="button" className={`pill small ${splitType === 'percent' ? 'active' : ''}`} onClick={() => setSplitType('percent')}>Percentage (%)</button>
                  <button type="button" className={`pill small ${splitType === 'fixed' ? 'active' : ''}`} onClick={() => setSplitType('fixed')}>Fixed Shares</button>
                  <button type="button" className={`pill small ${splitType === 'itemized' ? 'active' : ''}`} onClick={() => setSplitType('itemized')}>Itemized Bill</button>
                </div>
              </div>

              {/* Slider for Percent */}
              {splitType === 'percent' && (
                <div id="split-info-percent" className="field" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '12px' }}>
                  <label>Share Slider</label>
                  <input
                    type="range"
                    id="split-pct-slider"
                    min="0"
                    max="100"
                    value={percentSlider}
                    onChange={(e) => setPercentSlider(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '8px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '8px' }}>
                    <span>Your Share: <strong id="split-pct-my-val">{percentSlider}</strong>%</span>
                    <span>{partnerProfile?.display_name || 'Partner'}: <strong id="split-pct-partner-val">{100 - percentSlider}</strong>%</span>
                  </div>
                </div>
              )}

              {/* Inputs for Fixed shares */}
              {splitType === 'fixed' && (
                <div id="split-info-fixed" className="field-row" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '12px' }}>
                  <div className="field">
                    <label>Your Share (Fixed)</label>
                    <input
                      type="number"
                      id="split-fixed-me"
                      value={fixedMe}
                      onChange={(e) => setFixedMe(e.target.value)}
                      placeholder="₹"
                    />
                  </div>
                  <div className="field">
                    <label>{partnerProfile?.display_name || 'Partner'} Share (Fixed)</label>
                    <input
                      type="number"
                      id="split-fixed-partner"
                      value={fixedPartner}
                      onChange={(e) => setFixedPartner(e.target.value)}
                      placeholder="₹"
                    />
                  </div>
                  {fixedWarn && (
                    <div id="split-fixed-warn" style={{ gridColumn: 'span 2', fontSize: '12px', color: 'var(--red)', fontWeight: 'bold' }}>
                      ⚠️ Sum of shares must equal the total bill amount.
                    </div>
                  )}
                </div>
              )}

              {/* Itemized row generator */}
              {splitType === 'itemized' && (
                <div id="split-info-itemized" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '12px' }}>
                  <label>Itemized List</label>
                  <div id="itemized-list" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {itemizedRows.map((row) => (
                      <div key={row.id} className="feed-item" style={{ borderBottom: 'none', padding: '4px 0', gap: '6px' }}>
                        <input
                          type="text"
                          className="itemized-desc"
                          placeholder="Item name"
                          value={row.desc}
                          onChange={(e) => handleItemizedRowChange(row.id, 'desc', e.target.value)}
                          style={{ flex: 2, padding: '6px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                        />
                        <input
                          type="number"
                          className="itemized-amount"
                          placeholder="Amount"
                          value={row.amount}
                          onChange={(e) => handleItemizedRowChange(row.id, 'amount', e.target.value)}
                          style={{ flex: 1, padding: '6px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                        />
                        <select
                          className="itemized-split"
                          value={row.split}
                          onChange={(e) => handleItemizedRowChange(row.id, 'split', e.target.value)}
                          style={{ flex: 1, padding: '6px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                        >
                          <option value="me">Your share</option>
                          <option value="partner">Partner share</option>
                          <option value="equal">Split 50/50</option>
                        </select>
                        <button type="button" className="btn-danger btn-sm" onClick={() => handleRemoveItemizedRow(row.id)} style={{ padding: '4px 8px', width: 'auto' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" id="add-itemized-row" onClick={handleAddItemizedRow} style={{ marginTop: '8px', width: '100%' }}>+ Add Row</button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '10px', marginTop: '12px', fontSize: '13px' }}>
                    <span>Your Total: {sym}<strong id="itemized-total-me">{itemizedMeTotal.toFixed(2)}</strong></span>
                    <span>Partner Total: {sym}<strong id="itemized-total-partner">{itemizedPartnerTotal.toFixed(2)}</strong></span>
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="shared-exp-title">Description</label>
                <input
                  type="text"
                  id="shared-exp-title"
                  value={sharedBillTitle}
                  onChange={(e) => setSharedBillTitle(e.target.value)}
                  placeholder="e.g. Electricity bill, Canteen treat"
                  required
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="shared-exp-amount">Total Bill Amount ({sym})</label>
                  <input
                    type="number"
                    id="shared-exp-amount"
                    value={splitType === 'itemized' ? (itemizedMeTotal + itemizedPartnerTotal || '') : sharedBillAmount}
                    onChange={(e) => setSharedBillAmount(e.target.value)}
                    placeholder="Total amount"
                    disabled={splitType === 'itemized'}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="shared-exp-due">Due Date</label>
                  <input
                    type="date"
                    id="shared-exp-due"
                    value={sharedBillDue}
                    onChange={(e) => setSharedBillDue(e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="shared-exp-cat">Category</label>
                  <select
                    id="shared-exp-cat"
                    value={sharedBillCat}
                    onChange={(e) => setSharedBillCat(e.target.value)}
                  >
                    <option value="Shared">Shared Bills</option>
                    <option value="Rent">Rent</option>
                    <option value="Food">Food / Canteen</option>
                    <option value="Travel">Commute</option>
                    <option value="Groceries">Groceries</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="shared-exp-recurring">Recurring Template?</label>
                  <select
                    id="shared-exp-recurring"
                    value={sharedBillRecurring}
                    onChange={(e) => setSharedBillRecurring(e.target.value)}
                  >
                    <option value="none">One-time payment</option>
                    <option value="daily">Daily Template</option>
                    <option value="monthly">Monthly Template</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', height: '44px', marginTop: '12px' }}>Log Shared Bill</button>
            </form>
          )}

          {/* Form Direct Loan */}
          {activeTab === 'loan' && (
            <form id="shared-loan-form" onSubmit={handleLoanSubmit}>
              <div className="field">
                <label>Flow Direction</label>
                <div className="pill-row" id="loan-dir-pills" style={{ marginTop: '4px' }}>
                  <button type="button" className={`pill small ${loanDir === 'lend' ? 'active' : ''}`} onClick={() => setLoanDir('lend')}>Lend money (they owe you)</button>
                  <button type="button" className={`pill small ${loanDir === 'borrow' ? 'active' : ''}`} onClick={() => setLoanDir('borrow')}>Borrow money (you owe them)</button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="shared-loan-title">Description</label>
                <input
                  type="text"
                  id="shared-loan-title"
                  value={loanTitle}
                  onChange={(e) => setLoanTitle(e.target.value)}
                  placeholder="e.g. Cash lent, GPay load"
                  required
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="shared-loan-amount">Loan Amount ({sym})</label>
                  <input
                    type="number"
                    id="shared-loan-amount"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="Loan amount"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="shared-loan-due">Due Date</label>
                  <input
                    type="date"
                    id="shared-loan-due"
                    value={loanDue}
                    onChange={(e) => setLoanDue(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', height: '44px', marginTop: '12px' }}>Log Direct Loan</button>
            </form>
          )}
        </div>

        {/* Recurring bill templates list card */}
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Active Bill Templates</h3>
          <div id="partner-recurring-list">
            {recurringTemplates.length === 0 ? (
              <div className="empty-state">No recurring bill templates active.</div>
            ) : (
              recurringTemplates.map(t => (
                <div className="feed-item" key={t.id}>
                  <div className="feed-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  </div>
                  <div className="feed-body">
                    <div className="feed-desc" style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="feed-meta">Total: ₹{t.total_amount} | Split: {t.split_type} | Repeat: {t.frequency === 'daily' ? 'Daily' : `Day ${t.day_of_month} Monthly`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn-ghost btn-sm" style={{ padding: '4px 8px', width: 'auto', fontWeight: 'bold' }} onClick={() => handleLogTemplate(t)}>⚡ Log</button>
                    <button type="button" className="btn-danger btn-sm" style={{ padding: '4px 8px', width: 'auto' }} onClick={() => handleDeleteTemplate(t.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time shared activity logs */}
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Shared Activity Feed</h3>
          <div id="partner-activity-list">
            {activityLogs.length === 0 ? (
              <div className="empty-state">No shared activity yet.</div>
            ) : (
              activityLogs.map(item => {
                const isLoan = item.type === 'loan';
                const isSettlement = item.type === 'settlement';
                const iconStroke = isSettlement ? 'var(--green)' : 'var(--accent)';
                
                let feedTitle = item.title;
                let feedAmtStr = '';
                let feedAmtColor = 'var(--text)';

                if (isLoan) {
                  const myShare = isUserA ? item.user_a_owes : item.user_b_owes;
                  const partnerShare = isUserA ? item.user_b_owes : item.user_a_owes;
                  const pName = partnerProfile ? (partnerProfile.display_name || 'Friend') : 'Friend';

                  if (partnerShare > 0 || myShare < 0) {
                    feedTitle = `Lent to ${pName}: ${item.title}`;
                    feedAmtStr = `+₹${Math.abs(item.total || 0).toFixed(2)}`;
                    feedAmtColor = 'var(--green)';
                  } else {
                    feedTitle = `Borrowed from ${pName}: ${item.title}`;
                    feedAmtStr = `-₹${Math.abs(item.total || 0).toFixed(2)}`;
                    feedAmtColor = 'var(--red)';
                  }
                } else if (isSettlement) {
                  const isPayer = (item.recorded_by && typeof item.recorded_by === 'object') ? item.recorded_by.id === currentUserId : item.recorded_by === currentUserId;
                  const pName = partnerProfile ? (partnerProfile.display_name || 'Partner') : 'Partner';
                  if (isPayer) {
                    feedTitle = `You paid ${pName}: Settle Up`;
                    feedAmtStr = `-₹${Math.abs(item.total || 0).toFixed(2)}`;
                    feedAmtColor = 'var(--red)';
                  } else {
                    feedTitle = `${pName} paid You: Settle Up`;
                    feedAmtStr = `+₹${Math.abs(item.total || 0).toFixed(2)}`;
                    feedAmtColor = 'var(--green)';
                  }
                } else {
                  // Standard expense split representation
                  const pName = partnerProfile ? (partnerProfile.display_name || 'Partner') : 'Partner';
                  feedTitle = `Shared Bill: ${item.title}`;
                  feedAmtStr = `₹${(item.total || 0).toFixed(2)}`;
                }

                const isPayerGlobal = (item.recorded_by && typeof item.recorded_by === 'object') ? item.recorded_by.id === currentUserId : item.recorded_by === currentUserId;
                const payerName = isPayerGlobal ? 'You' : (typeof item.recorded_by === 'object' ? (item.recorded_by?.display_name || 'Partner') : (partnerProfile?.display_name || 'Partner'));
                
                let fmtDate = 'Recently';
                if (item.created_at) {
                  try {
                    const dObj = new Date(item.created_at);
                    if (!isNaN(dObj.getTime())) {
                      fmtDate = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    }
                  } catch (e) {}
                }

                return (
                  <div className="feed-item" key={item.id}>
                    <div className="feed-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {isLoan ? (
                          <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>
                        ) : isSettlement ? (
                          <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                        ) : (
                          <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M16 8H8"/><path d="M16 12H8"/></>
                        )}
                      </svg>
                    </div>
                    <div className="feed-body">
                      <div className="feed-desc">{feedTitle}</div>
                      <div className="feed-meta">{payerName} on {fmtDate}</div>
                    </div>
                    <span className="feed-amount" style={{ color: feedAmtColor }}>{feedAmtStr}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Settle Up Dialog Modal */}
      <dialog id="dialog-settle-up" className="dialog" ref={settleDialogRef}>
        <form onSubmit={handleSettleUpSubmit}>
          <button type="button" className="btn-close-dialog" onClick={() => settleDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Settle Shared Balances</h3>
          <p id="settle-up-info" className="muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
            {balanceInfo.balance === 0
              ? 'All settled up!'
              : (isDebtor ? `You owe ${partnerProfile?.display_name} ₹${balanceInfo.balance.toFixed(2)}` : `${partnerProfile?.display_name} owes you ₹${balanceInfo.balance.toFixed(2)}`)}
          </p>

          <div className="field">
            <label htmlFor="settle-amount">Payment Amount</label>
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

          <div className="field">
            <label htmlFor="settle-method">Settle Method</label>
            <select
              id="settle-method"
              value={settleMethod}
              onChange={(e) => setSettleMethod(e.target.value)}
            >
              <option value="UPI">UPI Payment</option>
              <option value="PayPal">PayPal</option>
              <option value="Cash">Cash / Other</option>
            </select>
          </div>

          {/* Settle Pay button for debtor */}
          {isDebtor && getSettleUpPayLink() && (
            <div id="settle-pay-btn-container" style={{ display: 'block', margin: '14px 0' }}>
              <a
                href={getSettleUpPayLink()}
                id="settle-pay-link"
                className="btn-primary"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40px', fontWeight: 600 }}
              >
                Pay {sym}{parseFloat(settleAmount || balanceInfo.balance).toFixed(2)} via {settleMethod}
              </a>
            </div>
          )}

          <div className="dialog-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-ghost" onClick={() => settleDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary">Record Payment</button>
          </div>
        </form>
      </dialog>

      {/* Disconnect confirmation dialog */}
      <dialog id="dialog-disconnect-confirm" className="dialog" ref={disconnectDialogRef}>
        <form onSubmit={handleDisconnectConfirm}>
          <h3>Confirm Disconnection</h3>
          <p className="muted" style={{ fontSize: '13px', lineHeight: '1.45', marginBottom: '14px' }}>
            To disconnected from <strong style={{ color: 'var(--accent)' }}>{partnerProfile?.display_name}</strong>, enter the 6-digit verification authorization code shown on their device below.
          </p>
          
          <div className="field">
            <label htmlFor="disconnect-confirm-input">Security Verification Code</label>
            <input
              type="text"
              id="disconnect-confirm-input"
              value={disconnectInputCode}
              onChange={(e) => setDisconnectInputCode(e.target.value)}
              placeholder="e.g. 849204"
              required
            />
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => disconnectDialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-danger" id="disconnect-submit-btn" disabled={disconnectInputCode !== disconnectVerifyCode}>
              Disconnect Partner
            </button>
          </div>
        </form>
      </dialog>

      {/* UPI QR settlement dialog */}
      <dialog id="dialog-upi-qr" className="dialog" ref={qrDialogRef}>
        <div style={{ position: 'relative' }}>
          <button type="button" className="btn-close-dialog" onClick={() => qrDialogRef.current?.close()} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3 style={{ marginBottom: '12px' }}>Request Settle Payment</h3>
          
          {state?.user?.upiId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
              <p className="muted" style={{ fontSize: '13px', textAlign: 'center', margin: 0 }}>
                Scan this QR using any UPI app to settle the balance of <strong>{sym}{balanceInfo.balance.toFixed(2)}</strong>.
              </p>
              
              <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    `upi://pay?pa=${state.user.upiId}&am=${balanceInfo.balance.toFixed(2)}&tn=UniSpend_Settle`
                  )}`}
                  alt="UPI QR Code"
                  style={{ width: '200px', height: '200px', display: 'block' }}
                />
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your UPI ID</div>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <input
                    type="text"
                    value={state.user.upiId}
                    readOnly
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ width: 'auto', height: 'auto', padding: '8px 16px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(state.user.upiId);
                      window.toast('UPI ID copied to clipboard! 📋');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
                You haven't set your UPI ID yet. Configure it in Settings to enable one-click QR code generation!
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  qrDialogRef.current?.close();
                  window.location.hash = '#settings';
                }}
              >
                Go to Settings
              </button>
            </div>
          )}
          
          <div className="dialog-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-ghost" onClick={() => qrDialogRef.current?.close()}>Dismiss</button>
          </div>
        </div>
      </dialog>

    </section>
  );
}
