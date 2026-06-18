const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");
let db = null;

function initFirebase() {
  const keyPath = path.resolve(__dirname, "./firebase-service-account.json");

  if (!fs.existsSync(keyPath)) {
    console.warn(
      "⚠️  firebase-service-account.json not found, skipping Firebase init.",
    );
    return;
  }

  let serviceAccount;
  try {
    const raw = fs.readFileSync(keyPath, "utf8");
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    console.warn(
      "⚠️  Failed to parse firebase-service-account.json:",
      err.message,
    );
    return;
  }

  const requiredFields = ["project_id", "client_email", "private_key"];
  const missingFields = requiredFields.filter((f) => !serviceAccount[f]);
  if (missingFields.length > 0) {
    console.warn(
      "⚠️  Missing fields in service account:",
      missingFields.join(", "),
    );
    return;
  }

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
      "Firestore is not initialized. Check your firebase-service-account.json.",
    );
  return db;
}

module.exports = { getDb, FieldValue };
