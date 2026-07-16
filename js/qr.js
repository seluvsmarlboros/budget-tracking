/* QR Code Scanner & Generator Controller */
import { State } from './state.js';

let html5QrScanner = null;

export function initQRScanner() {
  const btn = document.getElementById('btn-scan-qr');
  const dialog = document.getElementById('dialog-scan');
  const closeBtn = document.getElementById('close-scan-dialog');

  if (!btn) return;

  btn.addEventListener('click', () => {
    dialog.showModal();
    startScanning();
  });

  closeBtn.addEventListener('click', () => {
    stopScanning();
    dialog.close();
  });
}

function parseUPILink(urlText) {
  if (!urlText.startsWith('upi://pay?')) return null;
  try {
    const params = new URLSearchParams(urlText.substring(urlText.indexOf('?')));
    return {
      pa: params.get('pa') || '',
      pn: params.get('pn') || '',
      am: params.get('am') || '',
      tn: params.get('tn') || ''
    };
  } catch {
    return null;
  }
}

function startScanning() {
  if (typeof Html5Qrcode === 'undefined') {
    import('./app.js').then(m => m.toast('Scanner library loading... Try again.'));
    return;
  }

  html5QrScanner = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  html5QrScanner.start(
    { facingMode: "environment" },
    config,
    (decodedText) => {
      const upi = parseUPILink(decodedText);
      if (upi) {
        if (upi.am) {
          document.getElementById('log-amount').value = parseFloat(upi.am);
        }
        let desc = '';
        if (upi.pn) desc += upi.pn;
        if (upi.tn) desc += (desc ? ' - ' : '') + upi.tn;
        document.getElementById('log-desc').value = desc || 'UPI Payment';
        
        import('./app.js').then(m => {
          m.toast(`Scanned: ${upi.am ? '₹' + upi.am : ''} ${upi.pn ? 'to ' + upi.pn : ''}`);
        });

        stopScanning();
        document.getElementById('dialog-scan').close();
      } else {
        if (!isNaN(decodedText) && parseFloat(decodedText) > 0) {
          document.getElementById('log-amount').value = parseFloat(decodedText);
          import('./app.js').then(m => m.toast(`Scanned amount: ₹${decodedText}`));
          stopScanning();
          document.getElementById('dialog-scan').close();
        } else {
          import('./app.js').then(m => m.toast('Scanned text: ' + decodedText.substring(0, 30)));
        }
      }
    },
    () => {}
  ).catch(err => {
    console.error('Camera start failed', err);
    import('./app.js').then(m => m.toast('Camera error. Check permissions.'));
    document.getElementById('dialog-scan').close();
  });
}

function stopScanning() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      html5QrScanner = null;
    }).catch(err => {
      console.error('Failed to stop scanner', err);
    });
  }
}

export function showSplitQR(friend, amount) {
  const { user } = State.data;
  const upiId = user.upiId;

  if (!upiId) {
    import('./app.js').then(m => m.toast('Set your UPI ID in Settings to show QR!'));
    location.hash = '#settings';
    return;
  }

  const dialog = document.getElementById('dialog-qr-show');
  const container = document.getElementById('qrcode');
  const title = document.getElementById('qr-title');
  const desc = document.getElementById('qr-desc');
  const closeBtn = document.getElementById('close-qr-dialog');

  // Clear previous QR
  container.innerHTML = '';

  title.textContent = `Pay ${user.name || 'Alex'}`;
  desc.textContent = `${friend} can scan this to pay split share of ${user.currency || '₹'}${amount}`;

  const note = `Split share for ${friend}`;
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(user.name || 'Alex')}&am=${amount}&tn=${encodeURIComponent(note)}`;

  if (typeof QRCode === 'undefined') {
    import('./app.js').then(m => m.toast('QR library loading... Try again.'));
    return;
  }

  new QRCode(container, {
    text: upiUrl,
    width: 180,
    height: 180,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.M
  });

  dialog.showModal();

  closeBtn.addEventListener('click', () => {
    dialog.close();
  }, { once: true });
}
