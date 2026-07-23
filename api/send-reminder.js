import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Fallback VAPID keys matching original Express backend
const VAPID_KEYS = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ',
  privateKey: process.env.VAPID_PRIVATE_KEY || '3OFFjZPnQvqOXYwPGtyhd_5d8xEQt7_KtyLImNcNVzk'
};

webpush.setVapidDetails(
  'mailto:support@unispend.app',
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

const supabaseUrl = process.env.SUPABASE_URL || 'https://rzqwybcxxduvlntkittv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_svAhbKhIH8dBnwFvs_IcfQ_tnZ05pPQ';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch {}
    }

    let targetSubscriptions = [];
    let notificationTitle = 'UniSpend Alert';
    let notificationBody = 'Friendly budget reminder: Keep tracking your expenses today!';
    let notificationUrl = './index.html';

    // 1. Detect if it's a Supabase Database Webhook trigger
    if (payload && payload.record && payload.table === 'notifications') {
      const { user_id, message, type } = payload.record;
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('push_subscription')
        .eq('id', user_id)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: `Failed to fetch profile: ${error.message}` });
      }

      if (profile && profile.push_subscription) {
        targetSubscriptions.push({
          userId: user_id,
          subscription: profile.push_subscription
        });
      }

      notificationBody = message || notificationBody;
      
      if (type === 'reminder') {
        notificationTitle = 'UniSpend Budget Reminder';
        notificationUrl = './index.html?tab=partner';
      } else if (type === 'partner_joined') {
        notificationTitle = 'UniSpend Partnership';
        notificationUrl = './index.html?tab=partner';
      } else if (type === 'settled') {
        notificationTitle = 'UniSpend Settlement';
        notificationUrl = './index.html?tab=partner';
      }
    } 
    // 2. Direct API call targeting a specific user ID
    else if (payload && (payload.userId || payload.user_id)) {
      const userId = payload.userId || payload.user_id;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('push_subscription')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: `Failed to fetch profile: ${error.message}` });
      }

      if (profile && profile.push_subscription) {
        targetSubscriptions.push({
          userId,
          subscription: profile.push_subscription
        });
      }

      notificationTitle = payload.title || notificationTitle;
      notificationBody = payload.body || notificationBody;
      notificationUrl = payload.url || notificationUrl;
    }
    // 3. Broadcast to all active subscriptions
    else {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, push_subscription')
        .not('push_subscription', 'is', null);

      if (error) {
        return res.status(500).json({ error: `Failed to fetch profiles: ${error.message}` });
      }

      if (profiles && profiles.length > 0) {
        targetSubscriptions = profiles.map(p => ({
          userId: p.id,
          subscription: p.push_subscription
        }));
      }

      notificationTitle = payload.title || notificationTitle;
      notificationBody = payload.body || notificationBody;
      notificationUrl = payload.url || notificationUrl;
    }

    if (targetSubscriptions.length === 0) {
      return res.status(404).json({ error: 'No active subscribers found.' });
    }

    const notificationPayload = JSON.stringify({
      title: notificationTitle,
      body: notificationBody,
      url: notificationUrl
    });

    let succeeded = 0;
    let failed = 0;
    const sendPromises = targetSubscriptions.map(async ({ userId, subscription }) => {
      try {
        await webpush.sendNotification(subscription, notificationPayload);
        succeeded++;
      } catch (err) {
        console.error(`[Push serverless] Failed to send push:`, err.message);
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('profiles')
            .update({ push_subscription: null })
            .eq('id', userId);
        }
      }
    });

    await Promise.all(sendPromises);
    
    return res.status(200).json({
      message: `Attempted to push notifications to ${targetSubscriptions.length} clients.`,
      stats: { succeeded, failed }
    });
  } catch (err) {
    console.error('[send-reminder] Exception:', err);
    return res.status(500).json({ error: `Function Exception: ${err.message}` });
  }
}
