/* Receipt Scanning (OCR) Controller (js/ocr.js) */
import { toast } from './app.js';

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

export function initOCR() {
  const ocrBtn = document.getElementById('btn-ocr-receipt');
  const fileInput = document.getElementById('ocr-file-input');

  if (!ocrBtn || !fileInput) return;

  ocrBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    toast('Loading OCR engine...');
    ocrBtn.disabled = true;
    const originalContent = ocrBtn.innerHTML;
    ocrBtn.textContent = '⏳';

    try {
      await loadTesseract();
      toast('Reading receipt content...');
      
      const result = await window.Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      console.log('[OCR Text Scan]:', text);

      // Parse Amount from text
      const parsedAmount = parseAmountFromText(text);
      if (parsedAmount) {
        document.getElementById('log-amount').value = parsedAmount;
        toast(`Autofilled: ₹${parsedAmount}! 🧾`);
      } else {
        toast('Scan complete. No numeric totals found. Please type manually.');
      }

      // Parse Description from text
      const parsedDesc = parseDescriptionFromText(text);
      if (parsedDesc) {
        document.getElementById('log-desc').value = parsedDesc;
      }

      // Default Date if empty
      const dateInput = document.getElementById('log-date');
      if (!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }

    } catch (err) {
      console.error(err);
      toast(`OCR Scan failed: ${err.message}`);
    } finally {
      ocrBtn.disabled = false;
      ocrBtn.innerHTML = originalContent;
      fileInput.value = '';
    }
  });
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
