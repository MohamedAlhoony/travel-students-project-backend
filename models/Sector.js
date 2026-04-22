const mongoose = require("mongoose");

const SectorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sector",
    default: null,
  },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Sector" }],
  description: String,
  type: {
    type: String,
    enum: [
      "Department",
      "Administration",
      "Sector",
      "Center",
      "Office",
      "Other",
    ],
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  createdAt: { type: Date, default: Date.now },
  circularOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
});

module.exports = mongoose.model("Sector", SectorSchema);
