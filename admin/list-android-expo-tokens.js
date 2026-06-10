const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const admin = require("firebase-admin");

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function listAndroidAndExpoTokens() {
  const usersSnap = await db.collection("users").get();
  console.log("📱 Android and Expo tokens in Firestore:");

  for (const userDoc of usersSnap.docs) {
    const tokensSnap = await userDoc.ref.collection("pushTokens").get();
    tokensSnap.forEach(tDoc => {
      const data = tDoc.data();
      if (data.platform === "android" || (data.expoPushToken && data.expoPushToken.startsWith("ExponentPushToken"))) {
        console.log(`👤 User: ${userDoc.data().email || userDoc.id} (${userDoc.id})`);
        console.log(`  - Token ID: ${tDoc.id}`);
        console.log(`    Platform: ${data.platform}`);
        console.log(`    Expo: ${data.expoPushToken}`);
        console.log(`    Native: ${data.nativePushToken}`);
        console.log(`    Enabled: ${data.enabled}`);
      }
    });
  }
}

listAndroidAndExpoTokens().catch(console.error);
