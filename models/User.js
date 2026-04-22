const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLE_VALUES, Roles } = require("../constants/roles");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    roles: {
      type: [String],
      default: [Roles.CUSTOMER],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) && arr.every((r) => ROLE_VALUES.includes(r)),
        message: `roles must be one of: ${ROLE_VALUES.join(", ")}`,
      },
    },
    activated: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function (password) {
  return bcrypt.hash(password, 10);
};

function sanitize(userDoc) {
  if (!userDoc) return userDoc;
  const obj =
    typeof userDoc.toObject === "function" ? userDoc.toObject() : userDoc;
  delete obj.passwordHash;
  return obj;
}

userSchema.statics.sanitize = sanitize;

module.exports = mongoose.model("User", userSchema);
