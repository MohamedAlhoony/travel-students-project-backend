require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Logger
app.use(morgan("combined"));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("Compliance Registry System API");
});

// Routes
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/roles", require("./routes/roles"));
app.use("/api/users", require("./routes/users"));
app.use("/api/publications", require("./routes/publications"));
app.use(
  "/api/publications/:publicationId/terms",
  require("./routes/publicationTerms"),
);
app.use("/api/sectors", require("./routes/sectors"));
app.use("/api/reports", require("./routes/reports"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
