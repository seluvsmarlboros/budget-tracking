/* Receipt Scanning (OCR) Service Module (src/services/ocr.js) */

let tesseractLoaded = false;

function loadTesseract() {
  return new Promise((resolve, reject) => {
    if (tesseractLoaded || window.Tesseract) {
      tesseractLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tesseract.js@v4.0.1/dist/tesseract.min.js';
    script.onload = () => {
      tesseractLoaded = true;
      console.log('Tesseract.js loaded successfully from unpkg CDN');
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load OCR text-recognition engine. Check network.'));
    document.head.appendChild(script);
  });
}

export async function scanReceipt(file, onStatusUpdate = () => {}) {
  if (!file) return null;

  onStatusUpdate('Loading OCR engine...');
  await loadTesseract();

  onStatusUpdate('Reading receipt content...');
  const result = await window.Tesseract.recognize(file, 'eng');
  const text = result.data.text;
  console.log('[OCR Text Scan]:', text);

  // Parse Amount from text
  const amount = parseAmountFromText(text);

  // Parse Description from text
  const description = parseDescriptionFromText(text);

  return {
    amount,
    description,
    date: new Date().toISOString().split('T')[0]
  };
}

function parseAmountFromText(text) {
  const lines = text.split('\n');
  let amount = null;

  // Regular expressions to check for common total rows
  const totalKeywords = /total|amount|sum|due|pay|pay|rs\.|inr|subtotal|balance/i;

  for (const line of lines) {
    if (totalKeywords.test(line)) {
      // Find digit sequences like "40.00" or "150"
      const match = line.match(/\d+(?:\.\d{2})?/);
      if (match) {
        const val = parseFloat(match[0]);
        if (val > 0 && (!amount || val > amount)) {
          amount = val; // Target highest amount row in case of subtotal vs total
        }
      }
    }
  }

  // Fallback: search for first currency decimal value if no matches
  if (!amount) {
    for (const line of lines) {
      const match = line.match(/\d+\.\d{2}/);
      if (match) {
        const val = parseFloat(match[0]);
        if (val > 0 && (!amount || val > amount)) {
          amount = val;
        }
      }
    }
  }

  return amount;
}

function parseDescriptionFromText(text) {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3 && !/date|time|cashier|receipt|invoice|tax|total|amount/i.test(l));

  if (lines.length > 0) {
    // Return first valid line as description vendor (e.g. store name)
    return lines[0].substring(0, 30);
  }
  return 'Receipt Scan';
}
