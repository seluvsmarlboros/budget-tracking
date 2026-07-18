/* UPI and Banking SMS notification parser (js/smsParser.js) */

export function parseUPIAndSMS(text) {
  if (!text) return null;

  // Standardize spaces and remove newlines
  const textClean = text.replace(/\s+/g, ' ').trim();
  let amount = null;
  let description = '';
  let type = 'expense'; // Default to expense

  // 1. Extract Amount
  // Matches "Rs. 150.00", "Rs 150", "INR 150", "Rs.150", "150.00 INR", "₹150", "150 ₹"
  const patternBefore = /(?:Rs\.?|INR|₹)\s*(\d+(?:\.\d{2})?)/i;
  const patternAfter = /(\d+(?:\.\d{2})?)\s*(?:Rs\.?|INR|₹)/i;

  const amtMatch = textClean.match(patternBefore) || textClean.match(patternAfter);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1]);
  }

  // 2. Extract Type (Expense vs Income)
  if (/credited|received|deposited|added|refund/i.test(textClean)) {
    type = 'income';
  } else if (/debited|sent|spent|paid|charged|declined/i.test(textClean)) {
    type = 'expense';
  }

  // 3. Extract Merchant/Recipient Description
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

  // Fallback description names
  if (!description) {
    description = type === 'income' ? 'Bank Deposit' : 'UPI Payment';
  }

  // Clean description from extra handles, VPAs, or references
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
