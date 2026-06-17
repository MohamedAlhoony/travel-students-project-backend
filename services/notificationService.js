const { db } = require("../app"); // Import the initialized Firebase Admin SDK and Firestore instance

// 1. Get all tokens (reusable everywhere)
async function getAllTokens() {
  const snapshot = await db.collection("fcmTokens").get();

  return snapshot.docs.map((doc) => doc.data().token).filter(Boolean);
}

async function sendPushNotification(title, body, data = {}) {
  const tokens = await getAllTokens();

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  const chunks = [];

  while (messages.length) {
    chunks.push(messages.splice(0, 100));
  }

  for (const chunk of chunks) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
  }

  return { sent: true, count: tokens.length };
}

module.exports = { sendPushNotification, getAllTokens };
