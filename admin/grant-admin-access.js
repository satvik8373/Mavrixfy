/**
 * Grant Admin Access Script
 * 
 * This script grants admin access to an existing Mavrixfy user.
 * 
 * Usage:
 *   node grant-admin-access.js your-email@example.com
 * 
 * Prerequisites:
 *   1. Firebase Admin SDK service account key (download from Firebase Console)
 *   2. Place the key file in this directory as 'service-account.json'
 *   3. Install dependencies: npm install firebase-admin
 */

const admin = require('firebase-admin');
const readline = require('readline');

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    let val = trimmed.substring(firstEq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    val = val.replace(/\\n/g, '\n');
    env[key] = val;
  });
  return env;
}

// Initialize Firebase Admin
try {
  let credential;
  try {
    const serviceAccount = require('./service-account.json');
    credential = admin.credential.cert(serviceAccount);
  } catch (err) {
    const env = loadEnvLocal();
    const projectId = process.env.FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY || env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      credential = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      });
    } else {
      throw new Error('Could not find service-account.json or credentials in .env.local');
    }
  }

  admin.initializeApp({
    credential
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Error: Could not initialize Firebase Admin SDK');
  console.error(error.message);
  console.error('');
  console.error('To fix this:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save the file as "service-account.json" in the admin directory or define credentials in .env.local');
  console.error('');
  process.exit(1);
}

const db = admin.firestore();

// Admin roles
const ROLES = {
  super_admin: 'Full access to all features',
  content_editor: 'Manage songs, playlists, artists',
  moderator: 'Content moderation and user management',
  analyst: 'View analytics only (read-only)'
};

async function grantAdminAccess(email, role = 'super_admin') {
  try {
    console.log(`\n🔍 Looking up user: ${email}...`);
    
    // Get user from Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    
    console.log(`✅ Found user: ${userRecord.displayName || 'Unknown'} (${uid})`);
    
    // Check if user document exists
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.error(`❌ Error: User document not found in Firestore`);
      console.error(`   The user needs to sign in to the Mavrixfy app first to create their profile.`);
      process.exit(1);
    }
    
    console.log(`\n📝 Granting admin access...`);
    console.log(`   Role: ${role}`);
    console.log(`   Description: ${ROLES[role]}`);
    
    // Update user document with admin fields
    await db.collection('users').doc(uid).update({
      role: 'admin',
      isAdmin: true,
      adminRole: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`\n✅ SUCCESS! Admin access granted to ${email}`);
    console.log(`\nNext steps:`);
    console.log(`1. Make sure Firestore rules are deployed: firebase deploy --only firestore:rules`);
    console.log(`2. Go to http://localhost:3001/login`);
    console.log(`3. Sign in with email: ${email}`);
    console.log(`4. Use your existing Mavrixfy password`);
    console.log(`\n🎉 You're all set!`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`\nThe user ${email} does not exist in Firebase Authentication.`);
      console.error(`Please sign up in the Mavrixfy app first.`);
    }
    
    process.exit(1);
  }
}

async function revokeAdminAccess(email) {
  try {
    console.log(`\n🔍 Looking up user: ${email}...`);
    
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    
    console.log(`✅ Found user: ${userRecord.displayName || 'Unknown'} (${uid})`);
    console.log(`\n📝 Revoking admin access...`);
    
    // Remove admin fields
    await db.collection('users').doc(uid).update({
      role: admin.firestore.FieldValue.delete(),
      isAdmin: admin.firestore.FieldValue.delete(),
      adminRole: admin.firestore.FieldValue.delete(),
      adminPermissions: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`\n✅ Admin access revoked from ${email}`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function listAdmins() {
  try {
    console.log(`\n📋 Listing all admin users...\n`);
    
    const snapshot = await db.collection('users')
      .where('isAdmin', '==', true)
      .get();
    
    if (snapshot.empty) {
      console.log('No admin users found.');
      return;
    }
    
    console.log(`Found ${snapshot.size} admin(s):\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📧 ${data.email || 'No email'}`);
      console.log(`   Name: ${data.displayName || data.fullName || 'Unknown'}`);
      console.log(`   Role: ${data.adminRole || 'super_admin'}`);
      console.log(`   UID: ${doc.id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Interactive mode
async function interactive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  
  console.log('\n🎛️  Mavrixfy Admin Access Manager\n');
  console.log('1. Grant admin access');
  console.log('2. Revoke admin access');
  console.log('3. List all admins');
  console.log('4. Exit\n');
  
  const choice = await question('Choose an option (1-4): ');
  
  if (choice === '1') {
    const email = await question('\nEnter user email: ');
    console.log('\nAvailable roles:');
    Object.entries(ROLES).forEach(([key, desc], i) => {
      console.log(`${i + 1}. ${key} - ${desc}`);
    });
    const roleChoice = await question('\nChoose role (1-4, default: 1): ');
    const roleKeys = Object.keys(ROLES);
    const role = roleKeys[parseInt(roleChoice) - 1] || 'super_admin';
    
    rl.close();
    await grantAdminAccess(email, role);
    
  } else if (choice === '2') {
    const email = await question('\nEnter user email: ');
    rl.close();
    await revokeAdminAccess(email);
    
  } else if (choice === '3') {
    rl.close();
    await listAdmins();
    
  } else {
    rl.close();
    console.log('Goodbye!');
  }
  
  process.exit(0);
}

// Command line mode
const args = process.argv.slice(2);

if (args.length === 0) {
  // No arguments - run interactive mode
  interactive();
} else if (args[0] === 'list') {
  listAdmins().then(() => process.exit(0));
} else if (args[0] === 'revoke' && args[1]) {
  revokeAdminAccess(args[1]).then(() => process.exit(0));
} else if (args[0] && args[0].includes('@')) {
  // Email provided - grant access
  const email = args[0];
  const role = args[1] || 'super_admin';
  grantAdminAccess(email, role).then(() => process.exit(0));
} else {
  console.log('\n📖 Usage:');
  console.log('  node grant-admin-access.js                    # Interactive mode');
  console.log('  node grant-admin-access.js user@example.com   # Grant super_admin access');
  console.log('  node grant-admin-access.js user@example.com content_editor  # Grant specific role');
  console.log('  node grant-admin-access.js list               # List all admins');
  console.log('  node grant-admin-access.js revoke user@example.com  # Revoke access');
  console.log('\nAvailable roles:');
  Object.entries(ROLES).forEach(([key, desc]) => {
    console.log(`  - ${key}: ${desc}`);
  });
  console.log('');
  process.exit(1);
}
