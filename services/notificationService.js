const { getDb } = require("../firebase");

// ─── GET ALL TOKENS ───────────────────────────────────
async function getAllTokens() {
  const db = getDb();
  const snapshot = await db.collection("fcmTokens").get();

  if (snapshot.empty) {
    console.warn("⚠️  No FCM tokens found in Firestore.");
    return [];
  }
  const tokens = snapshot.docs.map((doc) => doc.data().token).filter(Boolean);

  console.log(`📱 Found ${tokens.length} FCM token(s)`);
  return tokens;
}

// ─── CHUNK ARRAY HELPER ───────────────────────────────
function chunkArray(array, size) {
  const chunks = [];
  const copy = [...array]; // avoid mutating original
  while (copy.length) {
    chunks.push(copy.splice(0, size));
  }
  return chunks;
}

// ─── SEND PUSH NOTIFICATION ───────────────────────────
async function sendPushNotification(title, body, data = {}, email = null) {
  if (!title || !body) {
    throw new Error("title and body are required.");
  }

  let tokens = [];

  if (email) {
    // Get tokens for specific email
    const db = getDb();
    const snapshot = await db
      .collection("fcmTokens")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      console.warn(`⚠️  No tokens found for email: ${email}`);
      return { sent: false, count: 0, results: [] };
    }

    tokens = snapshot.docs.map((doc) => doc.data().token).filter(Boolean);
    console.log(`📱 Found ${tokens.length} token(s) for email: ${email}`);
  } else {
    // Get all tokens
    tokens = await getAllTokens();
  }

  if (tokens.length === 0) {
    console.warn("⚠️  No tokens to send to.");
    return { sent: false, count: 0, results: [] };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  const chunks = chunkArray(messages, 100);
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(
      `📤 Sending chunk ${i + 1}/${chunks.length} (${chunk.length} messages)...`,
    );

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ Chunk ${i + 1} HTTP error ${response.status}:`,
          errorText,
        );
        failureCount += chunk.length;
        results.push({
          chunk: i + 1,
          status: "http_error",
          code: response.status,
          error: errorText,
        });
        continue;
      }

      const json = await response.json();
      const chunkResults = json.data ?? [];

      chunkResults.forEach((result, idx) => {
        if (result.status === "ok") {
          successCount++;
          results.push({ token: chunk[idx].to, status: "ok" });
        } else {
          failureCount++;
          console.warn(
            `⚠️  Token failed [${result.status}]:`,
            result.message ?? "unknown error",
          );
          results.push({
            token: chunk[idx].to,
            status: result.status,
            message: result.message ?? "unknown error",
          });
        }
      });
    } catch (err) {
      console.error(`❌ Chunk ${i + 1} network error:`, err.message);
      failureCount += chunk.length;
      results.push({
        chunk: i + 1,
        status: "network_error",
        error: err.message,
      });
    }
  }

  console.log(
    `✅ Push complete — success: ${successCount}, failed: ${failureCount}`,
  );

  return {
    sent: successCount > 0,
    total: tokens.length,
    successCount,
    failureCount,
    results,
  };
}

// ─── SEND TO SPECIFIC TOKENS ──────────────────────────
async function sendToTokens(tokens = [], title, body, data = {}) {
  if (!tokens.length) throw new Error("tokens array is empty.");
  if (!title || !body) throw new Error("title and body are required.");

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo push error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return json.data ?? [];
}

// ─── SEND TO SPECIFIC USER ────────────────────────────
async function sendToUser(userId, title, body, data = {}) {
  const db = getDb();
  const snapshot = await db
    .collection("fcmTokens")
    .where("userId", "==", userId)
    .get();

  if (snapshot.empty) {
    console.warn(`⚠️  No tokens found for userId: ${userId}`);
    return { sent: false, count: 0 };
  }

  const tokens = snapshot.docs.map((doc) => doc.data().token).filter(Boolean);
  const results = await sendToTokens(tokens, title, body, data);

  return { sent: true, count: tokens.length, results };
}

module.exports = {
  getAllTokens,
  sendPushNotification,
  sendToTokens,
  sendToUser,
};
