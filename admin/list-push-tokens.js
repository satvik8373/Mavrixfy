const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const admin = require("firebase-admin");

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
}

const db = admin.firestore();

async function listTokens() {
  console.log("🔍 Fetching registered push tokens...");
  const usersSnap = await db.collection("users").get();
  let totalTokens = 0;

  for (const userDoc of usersSnap.docs) {
    const tokensSnap = await userDoc.ref.collection("pushTokens").get();
    if (!tokensSnap.empty) {
      console.log(`\n👤 User: ${userDoc.data().email || userDoc.id} (${userDoc.id})`);
      tokensSnap.forEach(tDoc => {
        const data = tDoc.data();
        console.log(`  - ID: ${tDoc.id}`);
        console.log(`    Platform: ${data.platform || "unknown"}`);
        console.log(`    Expo Token: ${data.expoPushToken || "none"}`);
        console.log(`    Native Token: ${data.nativePushToken || "none"}`);
        console.log(`    Enabled: ${data.enabled}`);
        totalTokens++;
      });
    }
  }

  console.log(`\n✅ Finished. Total tokens found: ${totalTokens}`);
}

listTokens().catch(console.error);
