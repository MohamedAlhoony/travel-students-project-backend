const mongoose = require("mongoose");

const categories = [
  "Publication",
  "Law",
  "Legislation",
  "Regulation",
  "Policy",
  "Report",
  // Add more categories as needed
];

const TermSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, enum: categories, required: true },
  description: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Term", TermSchema);
