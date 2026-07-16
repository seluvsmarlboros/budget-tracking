/* Node.js Express Server for PWA Web Push (server.js) */

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve the PWA static client files
app.use(express.static(path.join(__dirname, './')));

// In-Memory Database to store active subscriptions
// In a production app, persist these objects to PostgreSQL / Supabase profiles.
let subscriptions = [];

// ─── VAPID CONFIGURATION ────────────────────────────────────────────
// Generate your own keys using: npx web-push generate-vapid-keys
const VAPID_KEYS = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ',
  privateKey: process.env.VAPID_PRIVATE_KEY || '3OFFjZPnQvqOXYwPGtyhd_5d8xEQt7_KtyLImNcNVzk'
};

// Set VAPID Details
// The mailto must be a valid email or URL domain
webpush.setVapidDetails(
  'mailto:support@unispend.app',
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

// ─── API ENDPOINTS ──────────────────────────────────────────────────

// Save User Subscription Payload
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription payload.' });
  }

  // Check if subscription already exists to avoid duplicates
  const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
    console.log(`[Push Server] New PWA subscription registered. Total: ${subscriptions.length}`);
  }

  res.status(201).json({ message: 'Subscription saved successfully.' });
});

// Remove Subscription Payload (Unsubscribe)
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  
  if (endpoint) {
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    console.log(`[Push Server] Subscription removed. Total: ${subscriptions.length}`);
  }
  
  res.status(200).json({ message: 'Unsubscribed successfully.' });
});

// Background Trigger Route: Trigger a notification to all subscribers
app.post('/api/send-reminder', async (req, res) => {
  const { title, body, url } = req.body;

  if (subscriptions.length === 0) {
    return res.status(404).json({ error: 'No active subscribers found.' });
  }

  const notificationPayload = JSON.stringify({
    title: title || 'UniSpend Alert',
    body: body || 'Friendly budget reminder: Keep tracking your expenses today!',
    url: url || './index.html'
  });

  const sendPromises = subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, notificationPayload);
    } catch (err) {
      console.error(`[Push Server] Failed to send push to endpoint: ${subscription.endpoint}`, err.message);
      // Remove stale subscriptions (e.g. status 410 Gone / Expired)
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
      }
    }
  });

  await Promise.all(sendPromises);
  res.status(200).json({ message: `Attempted to push notifications to ${subscriptions.length} clients.` });
});

// Startup Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 UniSpend Web Push Server running on port ${PORT}`);
  console.log(`📁 Serving client static directory: ${path.join(__dirname, './')}`);
  console.log(`💡 Generate VAPID keys: npx web-push generate-vapid-keys`);
  console.log(`====================================================`);
});
