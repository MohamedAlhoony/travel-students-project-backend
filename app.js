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
    privateKey:
      "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDBCQgV60iEWmvU\nltoPHE9Ftd7l3xpZgwgKVRPdA8B6Z/PAG+c9IwzuduV8zwKEeRSL5C9f+XOHV62s\n7ep/tG9h7Q4wZnBxQSbxuvxLZC3qnLuBe1chMZD+bSsA3EEgVCKVQaWJwPrMH3gq\nGnM2O6ChUvQtPVvgbHYcfWmHsMjI8Hw7JW7tcO054nz7I8eaCPV80/vOiwTFJMEl\nI+FBgNN81+hv3bH/5F02QIN8d1GhQj3c3uLUMI6uRjbRxNMOWF7lALGXrPWNjSn6\nkQMYCcuH56uBLeVZBc+Mc6Qy98pdTBzQwnxRQ1TuffPPw0ZTcLMSp2FJ2aWBtXZ4\nbWrtxva1AgMBAAECggEACVYh5JWCgDKzZnV8l7obZ3Hz4i0xSng/XYIrhmDirWKO\n9Cq+7qkRItnwIMioBLcQ54pvQPaBJpNDqWQnsTeNiTBjCecNtAMEgP3PROig6k91\n9KRKwyZxLq0iPrw1QvzVLPm43PnPGsWNSIc9xupWMZdTWHpp3psmxBsyWhRfeCbi\nXwxuoctPWZg78E/SNPB4z3KUUBgKfC25nH1fJQCWZd6xsI82CoEWXPDgB7HCO3m8\n4wG3clgd82HP+ff8iM7m3sYvQm7vUIsfrAJKF6xwqKIOR/GbGtdLxsEnPDzu+7y0\n3IrmxSrSdwOw18xQISvFPAhwr02k7qVq/V+jdqtI3QKBgQDw1ahuxSiHhLIkfET3\nqwE/ZbAQd9NOVr3YeZb0vBL/Ec5jznvaTCbBV0Z5fJpS7Bkky11wFLdM+HUf+he1\nquWEG6N9joPEppyt67a1b9f0fYMvi7YBGr4bFNFQtN+vVrIhMYwjOp3c9DdzTqzI\ncmizSmQ9/20wv3wKPXkfwxSXCwKBgQDNMNTAFBjRFKrNffgUy3TCrf0f1Agvjotl\n5haawnl95qkXXvisjLS8We0OCkAMMTKQ+PAB4s1OaghRWR/3ah3ezWn2AkvsR7zk\neQrAog/s45GnQ3pDFixsDUalTiwiA5slXzxIciaKSqMp88o1p5nrendRHqgB2+1G\n+8N+fZRBPwKBgE2vXcl9Z3lvYFdMjqKlUp20m3p0bIDUkiCF+B+xmx8UC1M+g80C\ny22KTX1aqB0fc2ze/KDuzcHSU1WhQoyjN63JjI8vrWl9pQSlCCa2kR6YbfykQG1S\nxwfNS0eRUKYqfQMgDGhAvDNNw6U6N5ng7c0HrhYhkoMrAUP8WFnaf4XJAoGAYG9v\nvep0E2fEMpnei19nu8tr6JaNVlSHHVf7DbcSxGIw3EQNWYMzukYFTJDyswg4PLxS\niIBgf1cEG79ob66W5UzjXPSNXDoHA9YDgK9qDqqRnOvwvTDhpdLDfhN0WHQbaYAN\n4/qKNHqJnsDuKzNe+rXu99gRm/YR2UegBIXetJ8CgYBgXjDwb2j9EkLNuh1cCrgU\nz9Qctl4EkC/GG/hl4DJmKnTLiFZRvR1Cqp09E2/PCaP5V/8rGTuFf6GBh6nSksGf\nrk7bzKepUbgliPc4G0gyJCYpovfczL7Kl2FD33zGYGPKv5cpuX+WFFFajTqjaP1l\ntOo+hMlHeANnQzbdj++5Sg==\n-----END PRIVATE KEY-----\n",
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
