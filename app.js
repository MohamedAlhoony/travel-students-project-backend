require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");

const app = express();
const { seedStandards } = require("./startup/seedStandards");

// ─── MIDDLEWARE ───────────────────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("*", cors());
app.use(express.json());
app.use(morgan("combined"));

// ─── FIREBASE BOOT + TEST ─────────────────────────────
require("./firebase");

async function testFirestore() {
  try {
    const { getDb } = require("./firebase");
    const db = getDb();

    console.log("🔍 Testing Firestore — reading fcmTokens...");

    const snapshot = await db.collection("fcmTokens").get();

    if (snapshot.empty) {
      console.warn("⚠️  fcmTokens collection is empty or does not exist.");
      return;
    }

    console.log(`✅ fcmTokens fetched — total docs: ${snapshot.size}`);
    console.log("─────────────────────────────────────");

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`[${index + 1}] Document ID: ${doc.id}`);
      Object.entries(data).forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`);
      });
      console.log("─────────────────────────────────────");
    });
  } catch (err) {
    console.error("❌ Firestore test failed:", err.message);
  }
}

testFirestore();

// ─── MONGODB ──────────────────────────────────────────
if (!process.env.MONGO_URI) {
  console.warn("⚠️  MONGO_URI is not set.");
}

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ─── BASE ROUTE ───────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Viaplex System API");
});

// ─── ROUTES ───────────────────────────────────────────
app.use("/api/roles", require("./routes/roles"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/applications", require("./routes/providerApplications"));
app.use("/api/services", require("./routes/services"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/standards", require("./routes/Standards"));

// ─── GLOBAL ERROR HANDLER ─────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── START SERVER ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
