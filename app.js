require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const admin = require("firebase-admin");
const app = express();

const { ensureSeedData } = require("./startup/seed");

// Enable CORS for all origins
// Note: When `credentials: true`, CORS cannot use a literal `*` origin.
// Using `origin: true` reflects the request origin and effectively allows all.
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

// Logger
app.use(morgan("combined"));

// MongoDB connection
if (!process.env.MONGO_URI) {
  console.warn("MONGO_URI is not set; API will not be able to access MongoDB.");
}

// Fixed Firebase Admin SDK initialization
try {
  // Option 1: Using service account key file (recommended)
  // Make sure you have the service account key file in your project
  const serviceAccount = require("./firebase-service-account.json");

  admin.initializeApp({
    credential: admin.cert({
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
      projectId: serviceAccount.project_id,
    }),
  });

  console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
  console.warn(
    "Failed to initialize Firebase Admin SDK with service account file:",
    error.message,
  );

  // // Option 2: Using environment variables (fallback)
  // try {
  //   const serviceAccount = {
  //     type: "service_account",
  //     projectId: process.env.FIREBASE_PROJECT_ID,
  //     privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  //     privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  //     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  //     clientId: process.env.FIREBASE_CLIENT_ID,
  //     authUri: "https://accounts.google.com/o/oauth2/auth",
  //     tokenUri: "https://oauth2.googleapis.com/token",
  //     authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs",
  //     clientX509CertUrl: process.env.FIREBASE_CLIENT_CERT_URL,
  //   };

  //   const firebaseApp = admin.initializeApp({
  //     credential: admin.credential.cert(serviceAccount),
  //   });

  //   console.log("Firebase Admin SDK initialized with environment variables");
  // } catch (envError) {
  //   console.error("Failed to initialize Firebase Admin SDK:", envError.message);
  //   // Initialize with default credentials (for Google Cloud environments)
  //   const firebaseApp = admin.initializeApp();
  //   console.log("Firebase Admin SDK initialized with default credentials");
  // }
}

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("MongoDB connected");
    await ensureSeedData();
  })
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("Compliance Registry System API");
});

// Routes
app.use("/api/roles", require("./routes/roles"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/applications", require("./routes/providerApplications"));
app.use("/api/services", require("./routes/services"));
app.use("/api/bookings", require("./routes/bookings"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { admin };
