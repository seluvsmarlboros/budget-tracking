/**
 * NotificationService.js — Dispatches real native OS / Browser Web Push notifications
 * with deep-linking click handlers.
 */

export const NotificationService = {
  /**
   * Request notification permission if not yet granted
   */
  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission !== 'denied') {
      try {
        const res = await Notification.requestPermission();
        return res;
      } catch (e) {
        return Notification.permission;
      }
    }
    return Notification.permission;
  },

  /**
   * Dispatch a real OS notification with deep linking to targetUrl
   */
  async sendNotification(title, body, targetUrl = '#activity') {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    const permission = await this.requestPermission();
    if (permission !== 'granted') return false;

    const cleanHash = targetUrl.startsWith('#') ? targetUrl : `#${targetUrl}`;
    const fullUrl = `${window.location.origin}${window.location.pathname}${cleanHash}`;

    const notificationOptions = {
      body,
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png',
      tag: 'unispend-' + title.replace(/\s+/g, '-').toLowerCase(),
      renotify: true,
      data: { url: fullUrl }
    };

    // 1. Try Service Worker showNotification first if registered
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notificationOptions);
          return true;
        }
      } catch (e) {
        console.warn('[NotificationService] ServiceWorker showNotification fallback:', e);
      }
    }

    // 2. Fallback to standard browser Notification instance
    try {
      const n = new Notification(title, notificationOptions);
      n.onclick = () => {
        window.focus();
        if (cleanHash) {
          window.location.hash = cleanHash;
        }
        n.close();
      };
      return true;
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch notification:', err);
      return false;
    }
  }
};
