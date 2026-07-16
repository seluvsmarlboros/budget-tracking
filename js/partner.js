/* Partner Controller module */
import { SupabaseService, supabase } from './supabase.js';
import { State } from './state.js';
import { toast } from './app.js';

let activePartnerships = [];
let activePartnership = null;
let profile = null;
let partnerProfile = null;
let currentUserId = null;
let splitType = 'equal';
let itemizedCount = 0;
let balanceInfo = { balance: 0, rawBalance: 0 };
let realtimeSubscription = null;
let unlinkedSubscription = null;

export async function initPartner() {
  console.log('UniSpend: initPartner() triggered');
  
  // Wire Celebration Overlay Close button
  const celebBtn = document.getElementById('celebration-close-btn');
  if (celebBtn) {
    celebBtn.addEventListener('click', async () => {
      document.getElementById('celebration-overlay').style.display = 'none';
      await checkAuthState();
    });
  }

  // Wire back button
  const backBtn = document.getElementById('friend-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', async () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        realtimeSubscription = null;
      }
      activePartnership = null;
      partnerProfile = null;
      await checkAuthState();
    });
  }

  // Wire Auth forms
  const loginForm = document.getElementById('partner-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  const logoutBtn = document.getElementById('partner-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  const dashLogoutBtn = document.getElementById('partner-dash-logout');
  if (dashLogoutBtn) dashLogoutBtn.addEventListener('click', handleLogout);

  // Wire Invite actions
  const genInviteBtn = document.getElementById('gen-invite-btn');
  if (genInviteBtn) genInviteBtn.addEventListener('click', handleGenerateInvite);

  const redeemForm = document.getElementById('redeem-invite-form');
  if (redeemForm) redeemForm.addEventListener('submit', handleRedeemInvite);

  const reminderBtn = document.getElementById('send-reminder-btn');
  if (reminderBtn) reminderBtn.addEventListener('click', handleSendReminder);

  const leaveBtn = document.getElementById('leave-partner-btn');
  if (leaveBtn) leaveBtn.addEventListener('click', handleLeavePartnership);

  // Wire Split Type Buttons
  const splitPills = document.querySelectorAll('#split-type-pills .pill');
  splitPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      splitPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      setSplitType(pill.dataset.split);
    });
  });

  // Wire range slider
  const slider = document.getElementById('split-pct-slider');
  if (slider) {
    slider.addEventListener('input', updatePercentSplitValues);
  }

  // Itemized tools
  const addItemBtn = document.getElementById('add-itemized-row');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => addItemizedRow('', 0, 'me'));
  }

  // Wire Form Submits
  const expenseForm = document.getElementById('shared-expense-form');
  if (expenseForm) {
    expenseForm.addEventListener('submit', handleSharedExpenseSubmit);
  }

  // Wire Settle Up Dialog
  const settleUpBtn = document.getElementById('settle-up-btn');
  if (settleUpBtn) {
    settleUpBtn.addEventListener('click', openSettleUpDialog);
  }

  const settleForm = document.getElementById('form-settle-up');
  if (settleForm) {
    settleForm.addEventListener('submit', handleSettleUpSubmit);
  }

  const closeSettleBtn = document.getElementById('close-settle-dialog');
  if (closeSettleBtn) {
    closeSettleBtn.addEventListener('click', () => {
      document.getElementById('dialog-settle-up').close();
    });
  }

  const settleMethodSelect = document.getElementById('settle-method');
  if (settleMethodSelect) {
    settleMethodSelect.addEventListener('change', updateSettleUpPaymentContainer);
  }

  const copyInviteBtn = document.getElementById('copy-invite-link');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', copyInviteLinkToClipboard);
  }

  // Handle invite links
  const hash = window.location.hash;
  if (hash && hash.includes('partner-redeem')) {
    const parts = hash.split('code=');
    if (parts.length > 1) {
      const code = parts[1].substring(0, 6);
      if (code) {
        document.getElementById('redeem-code-input').value = code;
        window.location.hash = '#partner';
      }
    }
  }

  // Setup auth status listener
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Supabase auth state changed:', event);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await checkAuthState();
      }
    });
  }

  // Check initial state
  await checkAuthState();
}

// ─── Authentication state transitions ─────────────────────────────
export async function checkAuthState() {
  if (!supabase) {
    showState('auth');
    return;
  }

  const user = await SupabaseService.getCurrentUser();
  if (!user) {
    showState('auth');
    return;
  }

  currentUserId = user.id;
  profile = await SupabaseService.getProfile(user.id);

  // If we are actively viewing a specific partnership details screen, refresh and keep it open
  if (activePartnership) {
    const freshPartnerships = await SupabaseService.checkPartnerships();
    const updatedP = freshPartnerships.find(p => p.id === activePartnership.id);
    if (updatedP) {
      activePartnership = updatedP;
      const isUserA = activePartnership.user_a.id === currentUserId;
      partnerProfile = isUserA ? activePartnership.user_b : activePartnership.user_a;
      showState('dashboard');
      setupRealtimeSubscription(activePartnership.id);
      await refreshDashboard();
      return;
    } else {
      activePartnership = null;
      partnerProfile = null;
    }
  }

  // Load all active partnerships and show directory list
  activePartnerships = await SupabaseService.checkPartnerships();
  showState('unlinked');
  setupUnlinkedRealtimeSubscription();
  
  await renderFriendsDirectory();

  // Check if user already has an active pending code
  const pending = await SupabaseService.checkPendingInvite();
  if (pending) {
    displayInviteCode(pending.invite_code);
  } else {
    const inviteEl = document.getElementById('invite-code-display');
    if (inviteEl) inviteEl.style.display = 'none';
  }
}

async function renderFriendsDirectory() {
  const container = document.getElementById('friends-directory-list');
  if (!container) return;

  if (activePartnerships.length === 0) {
    container.innerHTML = '<div class="empty-state">No synced friends yet. Share a code below to connect!</div>';
    return;
  }

  container.innerHTML = '';
  for (const p of activePartnerships) {
    const isUserA = p.user_a.id === currentUserId;
    const friend = isUserA ? p.user_b : p.user_a;
    const friendName = friend.display_name || friend.id.substring(0, 6);

    const balInfo = await SupabaseService.getNetBalance(p.id);
    const isDebtor = (balInfo.rawBalance > 0 && isUserA) || (balInfo.rawBalance < 0 && !isUserA);

    const item = document.createElement('div');
    item.className = 'friend-directory-item';
    item.style.cursor = 'pointer';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '16px';

    item.addEventListener('click', async () => {
      activePartnership = p;
      partnerProfile = friend;
      showState('dashboard');
      setupRealtimeSubscription(p.id);
      await refreshDashboard();
    });

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '14px';

    const avatar = document.createElement('div');
    avatar.textContent = friendName.charAt(0).toUpperCase();

    const details = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.style.fontWeight = '600';
    nameEl.style.fontSize = '15px';
    nameEl.textContent = friendName;

    const statusEl = document.createElement('div');
    statusEl.className = 'feed-meta';
    statusEl.style.fontSize = '12px';
    statusEl.style.marginTop = '2px';
    
    if (balInfo.balance === 0) {
      avatar.className = 'friend-avatar-circle settled';
      statusEl.textContent = 'Settled';
    } else if (isDebtor) {
      avatar.className = 'friend-avatar-circle owe';
      statusEl.textContent = `you owe ₹${balInfo.balance.toFixed(2)}`;
      statusEl.style.color = 'var(--red)';
    } else {
      avatar.className = 'friend-avatar-circle owed';
      statusEl.textContent = `owes you ₹${balInfo.balance.toFixed(2)}`;
      statusEl.style.color = 'var(--green)';
    }

    details.appendChild(nameEl);
    details.appendChild(statusEl);
    left.appendChild(avatar);
    left.appendChild(details);

    const right = document.createElement('div');
    const manageBtn = document.createElement('button');
    manageBtn.className = 'btn-ghost btn-sm';
    manageBtn.textContent = 'Manage ➔';
    manageBtn.style.padding = '6px 12px';
    manageBtn.style.width = 'auto';
    right.appendChild(manageBtn);

    item.appendChild(left);
    item.appendChild(right);
    container.appendChild(item);
  }
}

function showState(state) {
  document.getElementById('partner-auth').style.display = state === 'auth' ? '' : 'none';
  document.getElementById('partner-unlinked').style.display = state === 'unlinked' ? '' : 'none';
  document.getElementById('partner-dashboard').style.display = state === 'dashboard' ? '' : 'none';

  if (state === 'unlinked' && profile) {
    document.getElementById('partner-unlinked-name').textContent = profile.display_name || 'Friend';
  }
}

// ─── Actions ──────────────────────────────────────────────────────
async function handleLoginSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('partner-auth-name').value;
  const email = document.getElementById('partner-auth-email').value;
  const submitBtn = document.getElementById('partner-auth-submit');
  const msgDiv = document.getElementById('partner-auth-msg');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending Magic Link...';

  try {
    await SupabaseService.sendMagicLink(email, name);
    msgDiv.textContent = `Check your inbox at ${email} for the link!`;
    msgDiv.style.display = '';
    toast('Magic link sent successfully!');
  } catch (err) {
    console.error(err);
    toast(`Failed to sign in: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Magic Link';
  }
}

async function handleLogout() {
  try {
    if (partnerProfile) {
      const partnerName = partnerProfile.display_name || 'Partner';
      if (State.data.friends.balances[partnerName] !== undefined) {
        State.data.friends.balances[partnerName] = 0;
        State.saveState();
      }
    }
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
      realtimeSubscription = null;
    }
    if (unlinkedSubscription) {
      unlinkedSubscription.unsubscribe();
      unlinkedSubscription = null;
    }
    await SupabaseService.signOut();
    activePartnership = null;
    profile = null;
    partnerProfile = null;
    currentUserId = null;
    showState('auth');
    toast('Signed out successfully.');
  } catch (err) {
    toast(`Sign out failed: ${err.message}`);
  }
}

async function handleGenerateInvite() {
  const btn = document.getElementById('gen-invite-btn');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const invite = await SupabaseService.generateInvite();
    displayInviteCode(invite.invite_code);
    toast('Invite code generated!');
  } catch (err) {
    toast(`Failed to create invite: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Code';
  }
}

function displayInviteCode(code) {
  document.getElementById('invite-code-val').textContent = code;
  document.getElementById('invite-code-display').style.display = '';
}

function copyInviteLinkToClipboard() {
  const code = document.getElementById('invite-code-val').textContent;
  const link = `${window.location.origin}/#partner-redeem?code=${code}`;
  navigator.clipboard.writeText(link).then(() => {
    toast('Invite link copied to clipboard!');
  }).catch(() => {
    navigator.clipboard.writeText(code).then(() => {
      toast('Invite code copied!');
    });
  });
}

async function handleRedeemInvite(e) {
  e.preventDefault();
  const input = document.getElementById('redeem-code-input');
  const code = input.value;

  try {
    const result = await SupabaseService.redeemInvite(code);
    input.value = '';
    
    // Fetch partner display name for celebration overlay
    let partnerName = 'Partner';
    try {
      const pProfile = await SupabaseService.getProfile(result.user_a);
      if (pProfile) partnerName = pProfile.display_name || partnerName;
    } catch (e) {
      console.error(e);
    }
    
    triggerCelebration(partnerName);
  } catch (err) {
    toast(err.message);
  }
}

async function handleLeavePartnership() {
  if (!activePartnership) return;
  if (!confirm('Are you sure you want to disconnect from your partner? This ends the sync.')) return;

  try {
    if (partnerProfile) {
      const partnerName = partnerProfile.display_name || 'Partner';
      if (State.data.friends.balances[partnerName] !== undefined) {
        State.data.friends.balances[partnerName] = 0;
        State.saveState();
      }
    }
    await SupabaseService.leavePartnership(activePartnership.id);
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
      realtimeSubscription = null;
    }
    activePartnership = null;
    partnerProfile = null;
    showState('unlinked');
    toast('Disconnected from partner.');
  } catch (err) {
    toast(`Failed to leave: ${err.message}`);
  }
}

// ─── Realtime Subscriptions ────────────────────────────────────────
function setupUnlinkedRealtimeSubscription() {
  if (unlinkedSubscription) {
    unlinkedSubscription.unsubscribe();
  }

  unlinkedSubscription = supabase
    .channel('unlinked-partnership')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partnerships' },
      async (payload) => {
        console.log('Realtime change in partnerships table while unlinked:', payload);
        const p = payload.new;
        if (p && (p.user_a === currentUserId || p.user_b === currentUserId)) {
          if (p.status === 'active') {
            if (unlinkedSubscription) {
              unlinkedSubscription.unsubscribe();
              unlinkedSubscription = null;
            }
            
            // Get partner details
            let partnerName = 'Partner';
            try {
              const otherUserId = p.user_a === currentUserId ? p.user_b : p.user_a;
              const pProfile = await SupabaseService.getProfile(otherUserId);
              if (pProfile) partnerName = pProfile.display_name || partnerName;
            } catch (e) {
              console.error(e);
            }
            
            triggerCelebration(partnerName);
          }
        }
      }
    )
    .subscribe();
}

function triggerCelebration(partnerName) {
  const overlay = document.getElementById('celebration-overlay');
  const nameSpan = document.getElementById('celebrated-partner-name');
  if (overlay && nameSpan) {
    nameSpan.textContent = partnerName;
    overlay.style.display = 'flex';
  }
  toast(`🎉 Connected with ${partnerName}!`);
}

function setupRealtimeSubscription(partnershipId) {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }

  realtimeSubscription = supabase
    .channel(`partnership:${partnershipId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ledger_entries', filter: `partnership_id=eq.${partnershipId}` },
      async () => {
        console.log('Realtime ledger update detected');
        await refreshDashboard();
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
      (payload) => {
        console.log('Realtime notification received:', payload);
        toast(`📢 ${payload.new.message}`);
        refreshDashboard();
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'partnerships', filter: `id=eq.${partnershipId}` },
      async (payload) => {
        if (payload.new.status === 'ended') {
          toast('⚠️ Your partner has disconnected from the partnership.');
          activePartnership = null;
          partnerProfile = null;
          showState('unlinked');
        }
      }
    )
    .subscribe();
}

// ─── Dashboard Renderers ────────────────────────────────────────────
async function refreshDashboard() {
  if (!activePartnership) return;
  
  // 1. Set display name
  document.getElementById('partner-display-name').textContent = partnerProfile.display_name || partnerProfile.id.substring(0, 6);

  // 2. Fetch running net balance
  balanceInfo = await SupabaseService.getNetBalance(activePartnership.id);
  renderBalanceCard();

  // Sync to local Friends state to update Dashboard and Friends dropdown dynamically
  if (partnerProfile) {
    const partnerName = partnerProfile.display_name || 'Partner';
    if (!State.data.friends.list.includes(partnerName)) {
      // Add friend silently without full onboarding triggers
      State.data.friends.list.push(partnerName);
    }
    const isUserA = activePartnership.user_a.id === currentUserId;
    const localBalance = isUserA ? -balanceInfo.rawBalance : balanceInfo.rawBalance;
    
    State.data.friends.balances[partnerName] = localBalance;
    State.saveState();
  }

  // 3. Fetch recurring templates
  const templates = await SupabaseService.getRecurringTemplates(activePartnership.id);
  renderRecurringTemplates(templates);

  // 4. Fetch activity logs
  const expenses = await SupabaseService.getSharedExpenses(activePartnership.id);
  const ledger = await SupabaseService.getLedgerEntries(activePartnership.id);
  renderActivityLog(expenses, ledger);
}

function renderBalanceCard() {
  const valEl = document.getElementById('partner-balance-val');
  const descEl = document.getElementById('partner-balance-desc');
  const reminderBtn = document.getElementById('send-reminder-btn');

  if (balanceInfo.balance === 0) {
    valEl.textContent = '₹0';
    valEl.className = 'stat-value';
    descEl.textContent = 'You are all settled up!';
    if (reminderBtn) reminderBtn.style.display = 'none';
  } else {
    // Determine who owes whom
    // net_balance is positive: user_a owes user_b
    // net_balance is negative: user_b owes user_a
    const isUserA = activePartnership.user_a.id === currentUserId;
    const isDebtor = (balanceInfo.rawBalance > 0 && isUserA) || (balanceInfo.rawBalance < 0 && !isUserA);
    const amountStr = `₹${balanceInfo.balance.toFixed(2)}`;

    valEl.textContent = amountStr;
    if (isDebtor) {
      valEl.className = 'stat-value red';
      descEl.textContent = `You owe ${partnerProfile.display_name}`;
      if (reminderBtn) reminderBtn.style.display = 'none';
    } else {
      valEl.className = 'stat-value green';
      descEl.textContent = `${partnerProfile.display_name} owes you`;
      if (reminderBtn) reminderBtn.style.display = 'inline-flex';
    }
  }
}

function renderRecurringTemplates(templates) {
  const container = document.getElementById('partner-recurring-list');
  container.innerHTML = '';

  if (templates.length === 0) {
    container.innerHTML = '<div class="empty-state">No recurring bill templates active.</div>';
    return;
  }

  templates.forEach(t => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    
    // Icon
    const icon = document.createElement('div');
    icon.className = 'feed-icon';
    icon.textContent = '🔁';
    item.appendChild(icon);

    // Body
    const body = document.createElement('div');
    body.className = 'feed-body';
    
    const desc = document.createElement('div');
    desc.className = 'feed-desc';
    desc.style.fontWeight = '600';
    desc.textContent = t.title;
    body.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'feed-meta';
    const freqLabel = t.frequency === 'daily' ? 'Daily' : `Day ${t.day_of_month} Monthly`;
    meta.textContent = `Total: ₹${t.total_amount} | Split: ${t.split_type} | Repeat: ${freqLabel}`;
    body.appendChild(meta);
    item.appendChild(body);

    // Action buttons container
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '4px';

    // Log Template instance button
    const logBtn = document.createElement('button');
    logBtn.className = 'btn-ghost btn-sm';
    logBtn.textContent = '⚡ Log';
    logBtn.style.padding = '4px 8px';
    logBtn.style.width = 'auto';
    logBtn.style.fontWeight = 'bold';
    logBtn.addEventListener('click', async () => {
      logBtn.disabled = true;
      logBtn.textContent = 'Logging...';
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
        toast(`Logged shared bill: ${t.title}!`);
        await refreshDashboard();
      } catch (err) {
        toast(`Failed to log: ${err.message}`);
        logBtn.disabled = false;
        logBtn.textContent = '⚡ Log';
      }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-sm';
    delBtn.textContent = 'Delete';
    delBtn.style.padding = '4px 8px';
    delBtn.style.width = 'auto';
    delBtn.addEventListener('click', async () => {
      if (confirm('Delete this recurring template?')) {
        await SupabaseService.deleteRecurringTemplate(t.id);
        toast('Template deleted.');
        await refreshDashboard();
      }
    });
    
    actionContainer.appendChild(logBtn);
    actionContainer.appendChild(delBtn);
    item.appendChild(actionContainer);

    container.appendChild(item);
  });
}

function renderActivityLog(expenses, ledger) {
  const container = document.getElementById('partner-activity-list');
  container.innerHTML = '';

  // Combine ledger settlements and expenses
  const combined = [];

  expenses.forEach(e => {
    combined.push({
      id: e.id,
      date: new Date(e.created_at),
      type: 'expense',
      title: e.title,
      total: parseFloat(e.total_amount),
      added_by: e.added_by,
      user_a_owes: parseFloat(e.user_a_owes),
      user_b_owes: parseFloat(e.user_b_owes)
    });
  });

  ledger.filter(l => l.type === 'settlement').forEach(s => {
    combined.push({
      id: s.id,
      date: new Date(s.created_at),
      type: 'settlement',
      title: s.description,
      total: Math.abs(parseFloat(s.amount)),
      added_by: s.recorded_by
    });
  });

  // Sort descending
  combined.sort((a, b) => b.date - a.date);

  if (combined.length === 0) {
    container.innerHTML = '<div class="empty-state">No shared activity yet.</div>';
    return;
  }

  combined.forEach(item => {
    const el = document.createElement('div');
    el.className = 'feed-item';

    const icon = document.createElement('div');
    icon.className = 'feed-icon';
    icon.textContent = item.type === 'expense' ? '🧾' : '💸';
    el.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'feed-body';

    const desc = document.createElement('div');
    desc.className = 'feed-desc';
    desc.textContent = item.title;
    body.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'feed-meta';
    
    const adderName = item.added_by === currentUserId ? 'You' : partnerProfile.display_name;
    const formattedDate = item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    meta.textContent = `${adderName} on ${formattedDate}`;
    body.appendChild(meta);
    el.appendChild(body);

    // Value
    const val = document.createElement('div');
    val.className = 'feed-amount';
    val.textContent = `₹${item.total.toFixed(2)}`;
    el.appendChild(val);

    container.appendChild(el);
  });
}

// ─── Splitting Calculations UI ──────────────────────────────────────
function setSplitType(type) {
  splitType = type;
  
  // Hide all blocks
  document.getElementById('split-info-equal').style.display = 'none';
  document.getElementById('split-info-percent').style.display = 'none';
  document.getElementById('split-info-fixed').style.display = 'none';
  document.getElementById('split-info-itemized').style.display = 'none';

  // Show selected block
  document.getElementById(`split-info-${type}`).style.display = '';

  // Initialize block if needed
  if (type === 'itemized' && itemizedCount === 0) {
    // Add default row
    addItemizedRow('', 0, 'me');
  }
}

function updatePercentSplitValues() {
  const slider = document.getElementById('split-pct-slider');
  const myVal = slider.value;
  const partnerVal = 100 - myVal;

  document.getElementById('split-pct-my-val').textContent = myVal;
  document.getElementById('split-pct-partner-val').textContent = partnerVal;
}

function addItemizedRow(desc = '', amount = 0, payer = 'me') {
  const container = document.getElementById('itemized-list');
  const id = `itemized-row-${itemizedCount++}`;
  
  const row = document.createElement('div');
  row.className = 'feed-item';
  row.id = id;
  row.style.borderBottom = 'none';
  row.style.padding = '4px 0';
  row.style.gap = '6px';

  // Description
  const inputDesc = document.createElement('input');
  inputDesc.type = 'text';
  inputDesc.className = 'itemized-desc';
  inputDesc.placeholder = 'Item name';
  inputDesc.value = desc;
  inputDesc.style.flex = '2';
  inputDesc.style.padding = '6px';
  inputDesc.style.border = '1px solid var(--border)';
  inputDesc.style.borderRadius = 'var(--radius-sm)';
  row.appendChild(inputDesc);

  // Amount
  const inputAmt = document.createElement('input');
  inputAmt.type = 'number';
  inputAmt.className = 'itemized-amount';
  inputAmt.placeholder = 'Amount';
  inputAmt.value = amount || '';
  inputAmt.style.flex = '1';
  inputAmt.style.padding = '6px';
  inputAmt.style.border = '1px solid var(--border)';
  inputAmt.style.borderRadius = 'var(--radius-sm)';
  inputAmt.addEventListener('input', calculateItemizedTotals);
  row.appendChild(inputAmt);

  // Split select
  const selectPayer = document.createElement('select');
  selectPayer.className = 'itemized-split';
  selectPayer.style.flex = '1';
  selectPayer.style.padding = '6px';
  selectPayer.style.border = '1px solid var(--border)';
  selectPayer.style.borderRadius = 'var(--radius-sm)';
  
  const optMe = document.createElement('option');
  optMe.value = 'me';
  optMe.textContent = 'Your share';
  selectPayer.appendChild(optMe);

  const optPartner = document.createElement('option');
  optPartner.value = 'partner';
  optPartner.textContent = 'Partner share';
  selectPayer.appendChild(optPartner);

  const optEqual = document.createElement('option');
  optEqual.value = 'equal';
  optEqual.textContent = 'Split 50/50';
  selectPayer.appendChild(optEqual);

  selectPayer.value = payer;
  selectPayer.addEventListener('change', calculateItemizedTotals);
  row.appendChild(selectPayer);

  // Delete btn
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn-danger btn-sm';
  delBtn.textContent = '✕';
  delBtn.style.padding = '4px 8px';
  delBtn.style.width = 'auto';
  delBtn.addEventListener('click', () => {
    row.remove();
    calculateItemizedTotals();
  });
  row.appendChild(delBtn);

  container.appendChild(row);
  calculateItemizedTotals();
}

function calculateItemizedTotals() {
  let meTotal = 0;
  let partnerTotal = 0;

  const rows = document.querySelectorAll('#itemized-list .feed-item');
  rows.forEach(row => {
    const amt = parseFloat(row.querySelector('.itemized-amount').value) || 0;
    const split = row.querySelector('.itemized-split').value;

    if (split === 'me') {
      meTotal += amt;
    } else if (split === 'partner') {
      partnerTotal += amt;
    } else {
      // equal
      meTotal += amt / 2;
      partnerTotal += amt / 2;
    }
  });

  document.getElementById('itemized-total-me').textContent = meTotal.toFixed(2);
  document.getElementById('itemized-total-partner').textContent = partnerTotal.toFixed(2);

  // Auto-fill total amount
  const total = meTotal + partnerTotal;
  if (total > 0) {
    document.getElementById('shared-exp-amount').value = total.toFixed(2);
  }
}

// ─── Form Submission ────────────────────────────────────────────────
async function handleSharedExpenseSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('shared-exp-title').value;
  const totalAmount = parseFloat(document.getElementById('shared-exp-amount').value);
  const dueDate = document.getElementById('shared-exp-due').value || null;
  const category = document.getElementById('shared-exp-cat').value;
  const recurringVal = document.getElementById('shared-exp-recurring').value;
  const isRecurring = recurringVal === 'daily' || recurringVal === 'monthly';

  let userAOwes = 0;
  let userBOwes = 0;

  const isUserA = activePartnership.user_a.id === currentUserId;

  // Split calculation
  if (splitType === 'equal') {
    userAOwes = totalAmount / 2;
    userBOwes = totalAmount / 2;
  } else if (splitType === 'percent') {
    const myPct = parseFloat(document.getElementById('split-pct-slider').value);
    const partnerPct = 100 - myPct;
    
    const myOwes = totalAmount * (myPct / 100);
    const partnerOwes = totalAmount * (partnerPct / 100);

    userAOwes = isUserA ? myOwes : partnerOwes;
    userBOwes = isUserA ? partnerOwes : myOwes;
  } else if (splitType === 'fixed') {
    const fixedMe = parseFloat(document.getElementById('split-fixed-me').value) || 0;
    const fixedPartner = parseFloat(document.getElementById('split-fixed-partner').value) || 0;

    if (Math.abs((fixedMe + fixedPartner) - totalAmount) > 0.05) {
      document.getElementById('split-fixed-warn').style.display = '';
      return;
    }
    document.getElementById('split-fixed-warn').style.display = 'none';

    userAOwes = isUserA ? fixedMe : fixedPartner;
    userBOwes = isUserA ? fixedPartner : fixedMe;
  } else if (splitType === 'itemized') {
    const myOwes = parseFloat(document.getElementById('itemized-total-me').textContent) || 0;
    const partnerOwes = parseFloat(document.getElementById('itemized-total-partner').textContent) || 0;

    userAOwes = isUserA ? myOwes : partnerOwes;
    userBOwes = isUserA ? partnerOwes : myOwes;
  }

  // Create submission object
  const expenseData = {
    partnershipId: activePartnership.id,
    title,
    totalAmount,
    splitType,
    splitDetail: JSON.stringify({ splitType, userAOwes, userBOwes }),
    userAOwes,
    userBOwes,
    dueDate,
    category,
    isRecurring
  };

  try {
    // 1. Submit shared expense to DB
    const res = await SupabaseService.addSharedExpense(expenseData);
    
    // 2. If it's recurring, save a recurring template
    if (isRecurring && res) {
      const day = dueDate ? new Date(dueDate).getDate() : 1;
      await SupabaseService.addRecurringTemplate({
        partnershipId: activePartnership.id,
        title,
        totalAmount,
        splitType,
        splitDetail: JSON.stringify({ splitType, userAOwes, userBOwes }),
        dayOfMonth: day,
        category,
        frequency: recurringVal
      });
      toast(`Shared bill + ${recurringVal} recurring template added!`);
    } else {
      toast('Shared bill added successfully!');
    }

    // Reset Form
    document.getElementById('shared-expense-form').reset();
    setSplitType('equal');
    document.getElementById('itemized-list').innerHTML = '';
    itemizedCount = 0;

    // Refresh
    await refreshDashboard();
  } catch (err) {
    toast(`Failed to add: ${err.message}`);
  }
}

// ─── Settle Up Dialog Controls ────────────────────────────────────
function openSettleUpDialog() {
  const dialog = document.getElementById('dialog-settle-up');
  const info = document.getElementById('settle-up-info');
  const amountInput = document.getElementById('settle-amount');

  if (balanceInfo.balance === 0) {
    toast('You have no balance to settle!');
    return;
  }

  const isUserA = activePartnership.user_a.id === currentUserId;
  const isDebtor = (balanceInfo.rawBalance > 0 && isUserA) || (balanceInfo.rawBalance < 0 && !isUserA);

  if (isDebtor) {
    info.textContent = `You owe ${partnerProfile.display_name} ₹${balanceInfo.balance.toFixed(2)}`;
    // Pre-fill amount
    amountInput.value = balanceInfo.balance.toFixed(2);
  } else {
    info.textContent = `${partnerProfile.display_name} owes you ₹${balanceInfo.balance.toFixed(2)}`;
    amountInput.value = balanceInfo.balance.toFixed(2);
  }

  // Update payment deep links container
  updateSettleUpPaymentContainer();
  dialog.showModal();
}

function updateSettleUpPaymentContainer() {
  const method = document.getElementById('settle-method').value;
  const container = document.getElementById('settle-pay-btn-container');
  const link = document.getElementById('settle-pay-link');
  const amount = parseFloat(document.getElementById('settle-amount').value) || balanceInfo.balance;

  const isUserA = activePartnership.user_a.id === currentUserId;
  const isDebtor = (balanceInfo.rawBalance > 0 && isUserA) || (balanceInfo.rawBalance < 0 && !isUserA);

  // Deep links only apply if you are the one paying (debtor)
  if (!isDebtor) {
    container.style.display = 'none';
    return;
  }

  if (method === 'UPI' && partnerProfile.upi_id) {
    link.href = `upi://pay?pa=${partnerProfile.upi_id}&pn=${partnerProfile.display_name}&am=${amount.toFixed(2)}&cu=INR`;
    link.textContent = `Pay ₹${amount.toFixed(2)} via UPI`;
    container.style.display = '';
  } else if (method === 'PayPal') {
    // Mock PayPal.me link using display name
    const paypalName = partnerProfile.display_name.replace(/\s+/g, '').toLowerCase();
    link.href = `https://www.paypal.me/${paypalName}/${amount.toFixed(2)}`;
    link.textContent = `Pay ₹${amount.toFixed(2)} on PayPal`;
    container.style.display = '';
  } else {
    container.style.display = 'none';
  }
}

async function handleSettleUpSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('settle-amount').value);
  const method = document.getElementById('settle-method').value;

  const isUserA = activePartnership.user_a.id === currentUserId;
  const isDebtor = (balanceInfo.rawBalance > 0 && isUserA) || (balanceInfo.rawBalance < 0 && !isUserA);

  // Settlement amount direction
  // If user_a is debtor (user_a owes user_b): we need a NEGATIVE ledger entry to bring the positive balance down to 0
  // If user_a is creditor (user_b owes user_a): we need a POSITIVE entry (positive amount represents payment from user_b)
  let ledgerAmount = 0;
  if (isUserA) {
    ledgerAmount = isDebtor ? -amount : amount;
  } else {
    ledgerAmount = isDebtor ? amount : -amount;
  }

  const details = {
    description: `Settled ₹${amount.toFixed(2)} via ${method}`,
    partnerId: partnerProfile.id,
    payerName: profile.display_name || 'Partner'
  };

  try {
    await SupabaseService.settleBalance(activePartnership.id, ledgerAmount, details);
    toast('Settlement payment recorded successfully!');
    document.getElementById('dialog-settle-up').close();
    await refreshDashboard();
  } catch (err) {
    toast(`Failed to settle: ${err.message}`);
  }
}

async function handleSendReminder() {
  if (!activePartnership || !partnerProfile || balanceInfo.balance === 0) return;

  const btn = document.getElementById('send-reminder-btn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';

  try {
    const senderName = profile.display_name || 'Your partner';
    await SupabaseService.sendReminderNotification(
      activePartnership.id,
      partnerProfile.id,
      balanceInfo.balance,
      senderName
    );
    toast('Reminder sent to partner! 🔔');
  } catch (err) {
    console.error(err);
    toast(`Failed to send reminder: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
