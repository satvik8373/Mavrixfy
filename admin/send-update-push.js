const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const admin = require("firebase-admin");
const fetch = require("node-fetch"); // In Node 18+, fetch is built-in, but we'll use global.fetch or check if it exists

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Error: Firebase Admin credentials not found in env.");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  console.log("✅ Firebase Admin initialized successfully.");
}

const db = admin.firestore();
const messaging = admin.messaging();

async function sendExpoNotifications(tokens, title, body, data) {
  if (tokens.length === 0) return { success: 0, failed: 0 };

  console.log(`📡 Sending via Expo Push Service to ${tokens.length} tokens...`);
  const messages = tokens.map(to => ({
    to,
    title,
    body,
    sound: "default",
    channelId: "mavrixfy-default",
    priority: "high",
    badge: 1,
    data,
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
    
    const result = await res.json();
    let success = 0;
    let failed = 0;

    if (result.data) {
      result.data.forEach(r => {
        if (r.status === "ok") success++;
        else failed++;
      });
    }
    return { success, failed };
  } catch (err) {
    console.error("❌ Expo Send Error:", err);
    return { success: 0, failed: tokens.length };
  }
}

async function sendNativeAndroidNotifications(tokens, title, body, data) {
  if (tokens.length === 0) return 0;

  console.log(`🤖 Sending native FCM to ${tokens.length} Android devices...`);
  const messages = tokens.map(token => ({
    token,
    notification: { title, body },
    data,
    android: {
      priority: "high",
      notification: {
        channelId: "mavrixfy-default",
        sound: "default",
        color: "#1DB954",
      },
    },
  }));

  try {
    const response = await messaging.sendEach(messages);
    console.log(`✅ Android native FCM success count: ${response.successCount}`);
    return response.successCount;
  } catch (err) {
    console.error("❌ Android native FCM error:", err);
    return 0;
  }
}

async function sendNativeWebNotifications(tokens, title, body, data) {
  if (tokens.length === 0) return 0;

  console.log(`🌐 Sending native FCM to ${tokens.length} Web browsers...`);
  const messages = tokens.map(token => ({
    token,
    notification: { title, body },
    data,
  }));

  try {
    const response = await messaging.sendEach(messages);
    console.log(`✅ Web native FCM success count: ${response.successCount}`);
    return response.successCount;
  } catch (err) {
    console.error("❌ Web native FCM error:", err);
    return 0;
  }
}

async function runNotificationSender() {
  const title = "New Update Available! 🚀";
  const body = "Version 2.5.4 is now available on the Play Store! Update now for improved notifications and new features.";
  const payload = {
    route: "/(tabs)/settings", // Screen to redirect user to
    version: "2.5.4",
  };

  console.log("🔍 Fetching active push tokens from Firestore...");
  const usersSnap = await db.collection("users").get();
  
  const expoTokens = [];
  const nativeAndroidTokens = [];
  const nativeWebTokens = [];

  for (const userDoc of usersSnap.docs) {
    const tokensSnap = await userDoc.ref.collection("pushTokens").get();
    tokensSnap.forEach(tDoc => {
      const d = tDoc.data();
      if (d.enabled !== true) return;

      // 1. Expo Token
      if (d.expoPushToken && d.expoPushToken.startsWith("ExponentPushToken")) {
        expoTokens.push(d.expoPushToken);
      }
      
      // 2. Native Android FCM Token
      if (d.platform === "android" && d.nativePushToken) {
        nativeAndroidTokens.push(d.nativePushToken);
      }

      // 3. Web FCM Token
      if (d.platform === "web" && d.nativePushToken) {
        nativeWebTokens.push(d.nativePushToken);
      }
    });
  }

  console.log(`\n📋 Target devices summary:`);
  console.log(`   - Expo Tokens (Android/iOS): ${expoTokens.length}`);
  console.log(`   - Native Android FCM Tokens: ${nativeAndroidTokens.length}`);
  console.log(`   - Native Web FCM Tokens: ${nativeWebTokens.length}`);
  console.log("");

  // Send in parallel
  const [expoResult, androidResult, webResult] = await Promise.all([
    sendExpoNotifications(expoTokens, title, body, payload),
    sendNativeAndroidNotifications(nativeAndroidTokens, title, body, payload),
    sendNativeWebNotifications(nativeWebTokens, title, body, payload),
  ]);

  console.log("\n🏁 Delivery completed successfully:");
  console.log(`   - Expo Deliveries: ${expoResult.success} success, ${expoResult.failed} failed`);
  console.log(`   - Native Android FCM Deliveries: ${androidResult} success`);
  console.log(`   - Native Web FCM Deliveries: ${webResult} success`);
}

runNotificationSender().catch(console.error);
