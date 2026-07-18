const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://rzqwybcxxduvlntkittv.supabase.co';
// Use service role key if available for write access, fallback to public key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_svAhbKhIH8dBnwFvs_IcfQ_tnZ05pPQ';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscription, userId } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription payload.' });
  }

  if (userId) {
    // If a userId is passed, save the subscription directly to their profile
    const { error } = await supabase
      .from('profiles')
      .update({ push_subscription: subscription })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: `Supabase save error: ${error.message}` });
    }
  }

  return res.status(201).json({ message: 'Subscription processed successfully.' });
};
