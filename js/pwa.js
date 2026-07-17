/* Progressive Web App Client Logic (js/pwa.js) */

import { toast } from './app.js';
import { SupabaseService } from './supabase.js';

// VAPID Public Key — Generate this using `npx web-push generate-vapid-keys`
// This key will be replaced by the user's generated key, providing a fallback default.
const VAPID_PUBLIC_KEY = "BF7IgezFiN_M2HBCufmwj2yionG4AbT91NDwBZj5tqmrLK5U7pnL-de7DrPiFYZIW5FgFfzSvyQTGZGd5s2bdeQ";
const SUBSCRIBE_ENDPOINT = "/api/subscribe";

export async function initPWA() {
  console.log("PWA: Initializing client service worker...");
  
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('PWA: Service Worker registered successfully, scope:', reg.scope);
      
      // Notify user when a new service worker is installing/installed
      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                toast('Update downloaded! Please close and reopen the app to apply changes.');
              }
            }
          };
        }
      };

      // Auto check active subscription state to align toggle states
      await checkSubscriptionState();
    } catch (err) {
      console.error('PWA: Service Worker registration failed:', err);
    }
  }

  // Bind settings panel click handlers
  const pushToggle = document.getElementById('settings-push-toggle');
  if (pushToggle) {
    pushToggle.addEventListener('change', handlePushToggleChange);
  }
}

// Check if user is already subscribed and check toggle state in Settings
async function checkSubscriptionState() {
  const toggle = document.getElementById('settings-push-toggle');
  if (!toggle) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toggle.disabled = true;
    const label = document.getElementById('settings-push-label');
    if (label) label.textContent = "Push Alerts (Unsupported on this browser)";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    toggle.checked = !!sub;
    
    // Update text label to match state
    const label = document.getElementById('settings-push-label');
    if (label) {
      label.textContent = sub ? "Push Alerts Enabled" : "Enable Push Alerts";
    }
  } catch (err) {
    console.error("PWA: Error checking push subscription status:", err);
  }
}

// Toggle handler triggered by user gesture
async function handlePushToggleChange(e) {
  const toggle = e.target;
  const label = document.getElementById('settings-push-label');

  if (toggle.checked) {
    toggle.disabled = true;
    if (label) label.textContent = "Requesting permission...";
    
    try {
      const success = await requestPushSubscription();
      if (success) {
        if (label) label.textContent = "Push Alerts Enabled";
        toast("Web Push notifications enabled successfully! 🔔");
      } else {
        toggle.checked = false;
        if (label) label.textContent = "Enable Push Alerts";
        toast("Failed to enable notifications.");
      }
    } catch (err) {
      console.error(err);
      toggle.checked = false;
      if (label) label.textContent = "Enable Push Alerts";
      toast(`Alert setup error: ${err.message}`);
    } finally {
      toggle.disabled = false;
    }
  } else {
    toggle.disabled = true;
    if (label) label.textContent = "Disabling alerts...";
    try {
      const success = await unsubscribePush();
      if (success) {
        if (label) label.textContent = "Enable Push Alerts";
        toast("Unsubscribed from notifications.");
      } else {
        toggle.checked = true;
        if (label) label.textContent = "Push Alerts Enabled";
      }
    } catch (err) {
      console.error(err);
      toggle.checked = true;
      if (label) label.textContent = "Push Alerts Enabled";
      toast(`Error unsubscribing: ${err.message}`);
    } finally {
      toggle.disabled = false;
    }
  }
}

// Request permission and create subscription payload
async function requestPushSubscription() {
  if (!('Notification' in window)) {
    throw new Error("This browser does not support desktop notifications.");
  }

  // iOS 16.4+ standalone requirement check
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS && !isStandalone) {
    throw new Error("iOS Web Push requires this app to be installed. Please add it to your Home Screen first.");
  }

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error("Notification permission denied.");
  }

  // 2. Register subscription
  const reg = await navigator.serviceWorker.ready;
  
  // Clean up any old subscription first
  const existingSub = await reg.pushManager.getSubscription();
  if (existingSub) {
    await existingSub.unsubscribe();
  }

  // Subscribe using converted VAPID key
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  console.log("PWA: Web Push Subscription created:", JSON.stringify(subscription));

  // 3. Save subscription payload to Supabase
  await SupabaseService.savePushSubscription(subscription);

  return true;
}

// Unsubscribe helper
async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const success = await sub.unsubscribe();
    if (success) {
      // Remove subscription from Supabase
      await SupabaseService.removePushSubscription();
      return true;
    }
  }
  return false;
}

// VAPID base64 key converter helper
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
