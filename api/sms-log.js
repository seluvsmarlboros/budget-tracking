/* Vercel Serverless Function: api/sms-log.js */
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID keys matching send-reminder.js and client
const VAPID_KEYS = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ',
  privateKey: process.env.VAPID_PRIVATE_KEY || '3OFFjZPnQvqOXYwPGtyhd_5d8xEQt7_KtyLImNcNVzk'
};

webpush.setVapidDetails(
  'mailto:support@unispend.app',
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

// Parse SMS using same logic as client
function parseUPIAndSMS(text) {
  if (!text) return null;
  const textClean = text.replace(/\s+/g, ' ').trim();
  let amount = null;
  let description = '';
  let type = 'expense';

  const patternBefore = /(?:Rs\.?|INR|₹)\s*(\d+(?:\.\d{2})?)/i;
  const patternAfter = /(\d+(?:\.\d{2})?)\s*(?:Rs\.?|INR|₹)/i;

  const amtMatch = textClean.match(patternBefore) || textClean.match(patternAfter);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1]);
  }

  if (/credited|received|deposited|added|refund/i.test(textClean)) {
    type = 'income';
  } else if (/debited|sent|spent|paid|charged|declined/i.test(textClean)) {
    type = 'expense';
  }

  const patterns = [
    /paid\s+to\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\s+balance|\.)/i,
    /sent\s+(?:Rs\.?|INR)?\s*\d*(?:\.\d{2})?\s+to\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\.)/i,
    /transferred\s+to\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\.)/i,
    /spent\s+(?:at|on)\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\.)/i,
    /payment\s+to\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\.)/i,
    /charged\s+(?:at|for|by)\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\.)/i,
    /to\s+([A-Za-z0-9\s\-&@\.]+?)(?:\s+via|\s+ref|\s+on|\s+a\/c|\.)/i
  ];

  for (const pattern of patterns) {
    const match = textClean.match(pattern);
    if (match && match[1]) {
      description = match[1].trim();
      break;
    }
  }

  if (!description) {
    description = type === 'income' ? 'Bank Deposit' : 'UPI Payment';
  }

  description = description.replace(/(?:\s+vpa\s+.*|@\w+|ref.*|a\/c.*)/i, '').trim();
  if (description.length > 40) {
    description = description.substring(0, 40) + '...';
  }

  return {
    amount,
    description,
    type,
    date: new Date().toISOString().split('T')[0]
  };
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://rzqwybcxxduvlntkittv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_svAhbKhIH8dBnwFvs_IcfQ_tnZ05pPQ';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // CORS configuration
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

    const { userId } = req.query;
    if (!userId || userId === 'local' || userId.length < 20) {
      return res.status(400).json({ error: 'Valid authenticated userId UUID is required. Please sign in to UniSpend to generate your personalized webhook link.' });
    }

    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch {}
    }

    const text = payload.text || payload.body || (typeof req.body === 'string' ? req.body : null);
    if (!text) {
      return res.status(400).json({ error: 'SMS text body is empty' });
    }

    console.log(`[sms-log] Processing SMS for user ${userId}:`, text);
    const parsed = parseUPIAndSMS(text);
    if (!parsed || !parsed.amount) {
      return res.status(422).json({ error: 'Failed to extract transaction details or amount from text' });
    }

    // 1. Insert a notification record of type 'pending_transaction'
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        message: JSON.stringify(parsed),
        type: 'pending_transaction',
        is_read: false
      });

    if (error) {
      console.error('[sms-log] Supabase error:', error);
      return res.status(500).json({ error: `Database write failed: ${error.message}` });
    }

    // 2. Direct Web Push Notification dispatch to user's registered device
    let pushResult = 'Push sub not registered';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_subscription')
        .eq('id', userId)
        .maybeSingle();

      if (profile && profile.push_subscription) {
        const sub = typeof profile.push_subscription === 'string'
          ? JSON.parse(profile.push_subscription)
          : profile.push_subscription;

        const notificationPayload = JSON.stringify({
          title: 'UniSpend Auto-Track',
          body: `Auto-tracked: ₹${parsed.amount} for ${parsed.description}`,
          url: './index.html#activity'
        });

        await webpush.sendNotification(sub, notificationPayload);
        pushResult = 'Web Push notification sent!';
      }
    } catch (pushErr) {
      console.error('[sms-log] Direct webpush error:', pushErr.message);
      pushResult = `Push: ${pushErr.message}`;
    }

    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(`Logged ₹${parsed.amount} for ${parsed.description}! (${pushResult})`);
  } catch (err) {
    console.error('[sms-log] Exception:', err);
    return res.status(500).json({ error: `Function Exception: ${err.message}` });
  }
}
