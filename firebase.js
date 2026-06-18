const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
let db = null;

function initFirebase() {
  // Check if required environment variables are present
  const requiredEnvVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar],
  );
  if (missingEnvVars.length > 0) {
    console.warn(
      "⚠️  Missing environment variables:",
      missingEnvVars.join(", "),
    );
    return;
  }

  // Create service account object from environment variables
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE || "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  };

  try {
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    });
    db = getFirestore();
    console.log("✅ Firebase Admin SDK initialized successfully");
  } catch (err) {
    console.warn("⚠️  Firebase initializeApp() failed:", err.message);
  }
}

initFirebase();

// ✅ Only export getDb() and FieldValue — never export db directly
function getDb() {
  if (!db)
    throw new Error(
      "Firestore is not initialized. Check your Firebase environment variables.",
    );
  return db;
}

module.exports = { getDb, FieldValue };
