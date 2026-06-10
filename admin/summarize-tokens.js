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

async function summarizeTokens() {
  const usersSnap = await db.collection("users").get();
  const summary = {};

  for (const userDoc of usersSnap.docs) {
    const tokensSnap = await userDoc.ref.collection("pushTokens").get();
    tokensSnap.forEach(tDoc => {
      const data = tDoc.data();
      const platform = data.platform || "unknown";
      const enabled = data.enabled === true;

      if (!summary[platform]) {
        summary[platform] = { total: 0, enabled: 0 };
      }

      summary[platform].total++;
      if (enabled) {
        summary[platform].enabled++;
      }
    });
  }

  console.log("📊 Token Registration Summary by Platform:");
  console.log(JSON.stringify(summary, null, 2));
}

summarizeTokens().catch(console.error);
