import { db } from "../app.js"; // Import the Firestore instance from app.js

// 1. Get all tokens (reusable everywhere)
export async function getAllTokens() {
  const snapshot = await db.collection("users").get();

  return snapshot.docs.map((doc) => doc.data().expoPushToken).filter(Boolean);
}

export async function sendPushNotification(title, body, data = {}) {
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
