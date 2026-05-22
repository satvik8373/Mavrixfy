import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey ||
      clientEmail.includes('xxxxx') || privateKey.includes('YOUR_PRIVATE_KEY')) {
    throw new Error('Firebase Admin credentials not configured.');
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

// Send to Expo Push Service (handles Android FCM + iOS APNs automatically)
async function sendExpoNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ delivered: number; failed: number }> {
  if (tokens.length === 0) return { delivered: 0, failed: 0 };

  const messages = tokens.map(to => ({
    to,
    title: title,
    channelId: 'mavrixfy-default',
    priority: 'high',
    badge: 1,
    icon: 'https://mavrixfy.site/mavrixfy-icons/mavrixfy-icon-maskable-192.png',
  }));

  // Expo push API accepts up to 100 per request
  let delivered = 0;
  let failed = 0;

  const batches = [];
  for (let i = 0; i < messages.length; i += 100) {
    batches.push(messages.slice(i, i + 100));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(batch),
        });
        const result = await res.json() as { data: { status: string }[] };
        let bDelivered = 0;
        let bFailed = 0;
        result.data?.forEach(r => {
          if (r.status === 'ok') bDelivered++;
          else bFailed++;
        });
        return { bDelivered, bFailed };
      } catch {
        return { bDelivered: 0, bFailed: batch.length };
      }
    })
  );

  results.forEach(({ bDelivered, bFailed }) => {
    delivered += bDelivered;
    failed += bFailed;
  });

  return { delivered, failed };
}

// Send to web via Firebase Admin SDK (FCM web tokens)
async function sendWebNotifications(
  app: App,
  tokens: string[],
  title: string,
  body: string,
  imageUrl?: string,
  route?: string,
  notificationId?: string
): Promise<{ delivered: number; invalidTokens: string[] }> {
  if (tokens.length === 0) return { delivered: 0, invalidTokens: [] };

  const messaging = getMessaging(app);
  const invalidTokens: string[] = [];
  let delivered = 0;

  const batches: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    batches.push(tokens.slice(i, i + 500));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const messages = batch.map(token => ({
        token,
        notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
        data: {
          ...(route ? { route } : {}),
          ...(notificationId ? { notificationId } : {}),
        },
        webpush: {
          notification: {
            title,
            badge: 'https://mavrixfy.site/mavrixfy-icons/mavrixfy-icon-maskable-192.png',
            ...(imageUrl ? { image: imageUrl } : {}),
            requireInteraction: false,
            vibrate: [200, 100, 200],
            tag: 'mavrixfy',
            renotify: true,
          },
          fcmOptions: { link: route ? `https://mavrixfy.site/${route}` : 'https://mavrixfy.site/home' },
        },
      }));

      const response = await messaging.sendEach(messages);
      const bInvalidTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        const code = res.error?.code;
        if (code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered') {
          bInvalidTokens.push(batch[idx]);
        }
      });
      return { successCount: response.successCount, bInvalidTokens };
    })
  );

  results.forEach(({ successCount, bInvalidTokens }) => {
    delivered += successCount;
    invalidTokens.push(...bInvalidTokens);
  });

  return { delivered, invalidTokens };
}

export async function POST(req: NextRequest) {
  try {
    const app = getAdminApp();
    const db  = getFirestore(app);
    const { title, message, imageUrl, route, notificationId, platform } = await req.json();

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const targetPlatform: string = platform || 'all';

    // Collect all tokens grouped by type
    const usersSnap = await db.collection('users').get();
    const expoTokens: string[]   = []; // Expo push tokens → Android + iOS
    const webTokens: string[]    = []; // FCM web tokens → browser
    const androidFcmTokens: string[] = []; // Native Android FCM tokens
    const tokenDocRefs: { ref: FirebaseFirestore.DocumentReference; token: string }[] = [];

    const tokenDocPromises = usersSnap.docs.map(userDoc => userDoc.ref.collection('pushTokens').get());
    const tokenDocsSnaps = await Promise.all(tokenDocPromises);

    for (const tokensSnap of tokenDocsSnaps) {
      for (const t of tokensSnap.docs) {
        const d = t.data();
        if (!d.enabled) continue;

        // Expo push token (works for both Android + iOS via Expo service)
        if (d.expoPushToken?.startsWith('ExponentPushToken')) {
          if (targetPlatform === 'all' || targetPlatform === 'android' || targetPlatform === 'ios') {
            expoTokens.push(d.expoPushToken);
          }
          continue;
        }

        // Web FCM token
        if (d.platform === 'web' && d.nativePushToken) {
          if (targetPlatform === 'all' || targetPlatform === 'web') {
            webTokens.push(d.nativePushToken);
            tokenDocRefs.push({ ref: t.ref, token: d.nativePushToken });
          }
          continue;
        }

        // Native Android FCM token
        if (d.platform === 'android' && d.nativePushTokenType === 'android' && d.nativePushToken) {
          if (targetPlatform === 'all' || targetPlatform === 'android') {
            androidFcmTokens.push(d.nativePushToken);
          }
          continue;
        }

        // iOS native APNs tokens — skip, use Expo token instead
        // (raw APNs tokens require Apple certificates, use expoPushToken path)
      }
    }

    const data: Record<string, string> = {
      ...(route ? { route } : {}),
      ...(notificationId ? { notificationId } : {}),
    };

    // Send in parallel
    const [expoResult, webResult, androidResult] = await Promise.all([
      sendExpoNotifications(expoTokens, title, message, data),
      sendWebNotifications(app, webTokens, title, message, imageUrl, route, notificationId),
      // Android native FCM via Admin SDK
      androidFcmTokens.length > 0
        ? (async () => {
            const messaging = getMessaging(app);
            let delivered = 0;
            const batches: string[][] = [];
            for (let i = 0; i < androidFcmTokens.length; i += 500) {
              batches.push(androidFcmTokens.slice(i, i + 500));
            }
            const results = await Promise.all(
              batches.map(async (batch) => {
                const msgs = batch.map(token => ({
                  token,
                  notification: { title, body: message },
                  data,
                  android: {
                    priority: 'high' as const,
                    notification: {
                      channelId: 'mavrixfy-default',
                      sound: 'default',
                      color: '#1DB954',
                      icon: 'notification_icon',
                    },
                  },
                }));
                const r = await messaging.sendEach(msgs);
                return r.successCount;
              })
            );
            results.forEach(successCount => {
              delivered += successCount;
            });
            return { delivered };
          })()
        : Promise.resolve({ delivered: 0 }),
    ]);

    // Disable invalid web tokens
    if (webResult.invalidTokens.length > 0) {
      const invalidTokensSet = new Set(webResult.invalidTokens);
      const updates: Promise<any>[] = [];
      for (const { token, ref } of tokenDocRefs) {
        if (invalidTokensSet.has(token)) {
          updates.push(ref.update({ enabled: false }));
        }
      }
      await Promise.all(updates);
    }

    const totalDelivered = expoResult.delivered + webResult.delivered + androidResult.delivered;
    const totalTokens = expoTokens.length + webTokens.length + androidFcmTokens.length;

    if (notificationId) {
      await db.collection('notifications').doc(notificationId).update({
        delivered: totalDelivered,
        status: 'sent',
        breakdown: {
          expo: expoResult.delivered,
          web: webResult.delivered,
          android: androidResult.delivered,
        },
      });
    }

    return NextResponse.json({
      delivered: totalDelivered,
      total: totalTokens,
      breakdown: {
        expo: { delivered: expoResult.delivered, tokens: expoTokens.length },
        web:  { delivered: webResult.delivered,  tokens: webTokens.length },
        android: { delivered: androidResult.delivered, tokens: androidFcmTokens.length },
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
