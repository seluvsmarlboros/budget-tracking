import { createClient } from '@supabase/supabase-js';

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

    const { subscription, userId } = payload;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription payload.' });
    }

    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: subscription })
        .eq('id', userId);

      if (error) {
        return res.status(500).json({ error: `Supabase save error: ${error.message}` });
      }
    }

    return res.status(201).json({ message: 'Subscription processed successfully.' });
  } catch (err) {
    console.error('[subscribe] Exception:', err);
    return res.status(500).json({ error: `Function Exception: ${err.message}` });
  }
}
