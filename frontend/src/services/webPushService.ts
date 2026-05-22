import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import app, { db } from '@/lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

let _messaging: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance() {
  if (_messaging) return _messaging;
  const supported = await isSupported();
  if (!supported) throw new Error('Firebase Messaging not supported in this browser');
  _messaging = getMessaging(app);
  return _messaging;
}

/** Full registration flow — request permission, get token, save to Firestore */
export async function registerWebPush(userId: string): Promise<{ token: string | null; status: string }> {
  try {
    if (!('Notification' in window)) return { token: null, status: 'not_supported' };
    if (!('serviceWorker' in navigator)) return { token: null, status: 'no_sw' };
    if (!VAPID_KEY) return { token: null, status: 'no_vapid_key' };

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { token: null, status: 'denied' };
    if (permission !== 'granted') return { token: null, status: 'dismissed' };

    // Use the existing service worker (VitePWA) instead of creating a conflicting one
    const swReg = await navigator.serviceWorker.ready;
    const msg = await getMessagingInstance();
    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

    if (!token) return { token: null, status: 'no_token' };

    // Save token to Firestore
    const docId = `web_${token.slice(-28).replace(/[^a-zA-Z0-9]/g, '_')}`;
    await setDoc(
      doc(db, 'users', userId, 'pushTokens', docId),
      {
        enabled: true,
        platform: 'web',
        nativePushToken: token,
        nativePushTokenType: 'fcm-web',
        expoPushToken: null,
        notificationChannelId: null,
        deviceName: navigator.userAgent.slice(0, 120),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log('[WebPush] Registered successfully, token saved');
    return { token, status: 'granted' };
  } catch (err: any) {
    console.error('[WebPush] Registration failed:', err.message);
    return { token: null, status: 'error:' + err.message };
  }
}

/** Listen for foreground messages */
export async function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const msg = await getMessagingInstance();
    return onMessage(msg, (payload) => {
      // Show native notification even in foreground
      const { title, body, image } = payload.notification || {};
      if (title && Notification.permission === 'granted') {
        new Notification(title, {
          body: body || '',
          icon: '/mavrixfy-icons/mavrixfy-icon-maskable-192.png',
          image: image,
          data: payload.data,
        } as any);
      }
      callback(payload);
    });
  } catch {
    return () => {};
  }
}

/** Check current permission state without prompting */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
