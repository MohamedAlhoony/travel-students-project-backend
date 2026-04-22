const mongoose = require("mongoose");
const { ROLE_VALUES } = require("../constants/roles");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ROLE_VALUES,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Role", roleSchema);
