require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
var admin = require("firebase-admin");
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

var serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "viaplex-62ec3",
    clientEmail: "101405265864261272823",
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = admin.firestore();
const messaging = admin.messaging();
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

export { admin, db, messaging };
