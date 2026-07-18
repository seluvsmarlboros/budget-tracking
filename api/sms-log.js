/* Vercel Serverless Function: api/sms-log.js */
const { createClient } = require('@supabase/supabase-js');

// Parse SMS using same logic as client
function parseUPIAndSMS(text) {
  if (!text) return null;
  const textClean = text.replace(/\s+/g, ' ').trim();
  let amount = null;
  let description = '';
  let type = 'expense';

  const amtMatch = textClean.match(/(?:Rs\.?|INR)\s*(\d+(?:\.\d{2})?)/i) || 
                   textClean.match(/(\d+(?:\.\d{2})?)\s*(?:Rs\.?|INR)/i);
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

  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const payload = req.body;
  const text = payload.text || payload.body;
  if (!text) {
    return res.status(400).json({ error: 'SMS text body is empty' });
  }

  console.log(`[sms-log] Processing SMS for user ${userId}:`, text);
  const parsed = parseUPIAndSMS(text);
  if (!parsed || !parsed.amount) {
    return res.status(422).json({ error: 'Failed to extract transaction details or amount from text' });
  }

  // Insert a notification record of type 'pending_transaction'
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

  return res.status(200).json({ success: true, parsed });
};
