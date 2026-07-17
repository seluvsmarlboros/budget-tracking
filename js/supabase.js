/* Supabase Integration Service Module */

const SUPABASE_URL = "https://rzqwybcxxduvlntkittv.supabase.co";
const SUPABASE_KEY = "sb_publishable_svAhbKhIH8dBnwFvs_IcfQ_tnZ05pPQ";

// Initialize Supabase Client
export let supabase = null;

export function initSupabaseClient() {
  if (supabase) return supabase;
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

// Auto-run on load
initSupabaseClient();

export const SupabaseService = {
  // ─── Authentication & Profile ──────────────────────────────────────
  async sendMagicLink(email, displayName) {
    initSupabaseClient();
    if (!supabase) throw new Error("Supabase is not initialized");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName }
      }
    });
    if (error) throw error;
  },

  async signInWithGoogle() {
    initSupabaseClient();
    if (!supabase) throw new Error("Supabase is not initialized");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  },

  async verifyOTP(email, token) {
    initSupabaseClient();
    if (!supabase) throw new Error("Supabase is not initialized");
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) throw error;
    return data;
  },

  async getCurrentUser() {
    initSupabaseClient();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getProfile(userId) {
    initSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateProfile(profile) {
    initSupabaseClient();
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: profile.displayName || "",
      upi_id: profile.upiId || ""
    });
    if (error) throw error;
  },

  async signOut() {
    initSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  // ─── Partnership Invite / Join / Leave ──────────────────────────────
  async checkPartnerships() {
    initSupabaseClient();
    if (!supabase) return [];
    const user = await this.getCurrentUser();
    if (!user) return [];

    // Check for active partnerships
    const { data, error } = await supabase
      .from("partnerships")
      .select("*, user_a:profiles!partnerships_user_a_fkey(*), user_b:profiles!partnerships_user_b_fkey(*)")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq("status", "active");

    if (error) throw error;
    return data || [];
  },

  async checkPendingInvite() {
    initSupabaseClient();
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("partnerships")
      .select("*")
      .eq("user_a", user.id)
      .eq("status", "pending")
      .gt("invite_exp", new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async generateInvite() {
    initSupabaseClient();
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    // Clear any previous pending invite to prevent duplicate keys
    await supabase.from("partnerships").delete().eq("user_a", user.id).eq("status", "pending");

    // Generate random 6-character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 48); // 48h validity

    const { data, error } = await supabase
      .from("partnerships")
      .insert({
        user_a: user.id,
        status: "pending",
        invite_code: code,
        invite_exp: expiry.toISOString()
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async redeemInvite(code) {
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    // 1. Fetch pending partnership matching code
    const { data: p, error: fetchErr } = await supabase
      .from("partnerships")
      .select("*")
      .eq("invite_code", code.trim().toUpperCase())
      .eq("status", "pending")
      .gt("invite_exp", new Date().toISOString())
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!p) throw new Error("Invalid or expired invite code");

    // 2. Prevent self-pairing
    if (p.user_a === user.id) throw new Error("You cannot redeem your own invite code!");

    // 3. Update partnership status to active and set user_b
    const { data, error: updateErr } = await supabase
      .from("partnerships")
      .update({
        user_b: user.id,
        status: "active",
        invite_code: null,
        invite_exp: null
      })
      .eq("id", p.id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;

    // Send a system notification that partner joined
    await supabase.from("notifications").insert({
      user_id: p.user_a,
      type: "partner_joined",
      message: `${user.email.split('@')[0]} joined your partnership!`
    });

    return data;
  },

  async leavePartnership(partnershipId) {
    if (!supabase) return;
    const { error } = await supabase
      .from("partnerships")
      .update({ status: "ended" })
      .eq("id", partnershipId);

    if (error) throw error;
  },

  // ─── Shared Expenses ────────────────────────────────────────────────
  async getSharedExpenses(partnershipId) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("shared_expenses")
      .select("*")
      .eq("partnership_id", partnershipId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addSharedExpense(expense) {
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("shared_expenses")
      .insert({
        partnership_id: expense.partnershipId,
        added_by: user.id,
        title: expense.title,
        total_amount: expense.totalAmount,
        split_type: expense.splitType,
        split_detail: expense.splitDetail,
        user_a_owes: expense.userAOwes,
        user_b_owes: expense.userBOwes,
        due_date: expense.dueDate,
        category: expense.category || "Shared",
        is_recurring: expense.isRecurring || false,
        recurring_id: expense.recurringId || null,
        notes: expense.notes || ""
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Settle Up & Balance ───────────────────────────────────────────
  async getNetBalance(partnershipId) {
    if (!supabase) return { balance: 0, debtor: null, creditor: null };
    const { data, error } = await supabase
      .from("v_partnership_balance")
      .select("*")
      .eq("partnership_id", partnershipId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { balance: 0, debtor: null, creditor: null };

    return {
      balance: Math.abs(parseFloat(data.net_balance)),
      rawBalance: parseFloat(data.net_balance),
      user_a: data.user_a,
      user_b: data.user_b
    };
  },

  async settleBalance(partnershipId, amount, details) {
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("ledger_entries")
      .insert({
        partnership_id: partnershipId,
        type: "settlement",
        amount: amount,
        description: details.description || "Settle up payment",
        recorded_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    const recipient = details.partnerId;
    await supabase.from("notifications").insert({
      user_id: recipient,
      type: "settled",
      message: `${details.payerName} logged a payment of ₹${Math.abs(amount).toFixed(2)} to settle up.`
    });

    return data;
  },

  async sendReminderNotification(partnershipId, partnerId, amount, senderName) {
    initSupabaseClient();
    if (!supabase) return null;
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: partnerId,
        type: "reminder",
        message: `🔔 Friendly reminder from ${senderName}: You owe them ₹${amount.toFixed(2)}.`
      });

    if (error) throw error;
    return true;
  },

  // ─── Ledger Entries & Activity Feed ──────────────────────────────────
  async getLedgerEntries(partnershipId) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("*, recorded_by:profiles(*)")
      .eq("partnership_id", partnershipId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // ─── Recurring Bill Templates ────────────────────────────────────────
  async getRecurringTemplates(partnershipId) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("recurring_templates")
      .select("*")
      .eq("partnership_id", partnershipId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addRecurringTemplate(template) {
    initSupabaseClient();
    if (!supabase) return null;
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("recurring_templates")
      .insert({
        partnership_id: template.partnershipId,
        title: template.title,
        total_amount: template.totalAmount,
        split_type: template.splitType,
        split_detail: template.splitDetail,
        day_of_month: template.dayOfMonth,
        category: template.category || "Shared",
        created_by: user.id,
        frequency: template.frequency || "monthly"
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async toggleRecurringTemplate(templateId, isActive) {
    if (!supabase) return;
    const { error } = await supabase
      .from("recurring_templates")
      .update({ is_active: isActive })
      .eq("id", templateId);

    if (error) throw error;
  },

  async deleteRecurringTemplate(templateId) {
    if (!supabase) return;
    const { error } = await supabase
      .from("recurring_templates")
      .delete()
      .eq("id", templateId);

    if (error) throw error;
  },

  // ─── Notifications ──────────────────────────────────────────────────
  async getNotifications() {
    if (!supabase) return [];
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async markNotificationsRead() {
    if (!supabase) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
  },

  // ─── Web Push Notification Subscription ────────────────────────────
  async savePushSubscription(subscription) {
    initSupabaseClient();
    if (!supabase) throw new Error("Supabase is not initialized");
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated with Supabase");

    // Serialize subscription properly to pure JSON object matching JSONB column requirements
    const subscriptionJson = JSON.parse(JSON.stringify(subscription));

    const { error } = await supabase
      .from("profiles")
      .update({
        push_subscription: subscriptionJson
      })
      .eq("id", user.id);

    if (error) {
      throw new Error(`Supabase save error: ${error.message}`);
    }
    return true;
  },

  async removePushSubscription() {
    initSupabaseClient();
    if (!supabase) throw new Error("Supabase is not initialized");
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated with Supabase");

    const { error } = await supabase
      .from("profiles")
      .update({
        push_subscription: null
      })
      .eq("id", user.id);

    if (error) {
      throw new Error(`Supabase unsubscribe error: ${error.message}`);
    }
    return true;
  }
};
