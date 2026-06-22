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

    // Wallet balance (simple internal accounting).
    // Stored as a Number (currency units). Keep it non-negative.
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Review rank for customers (clients)
    // Rating scale from 1-5, only applicable for customers
    reviewRank: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function () {
          // Only validate reviewRank if user has CUSTOMER role
          return (
            !this.roles.includes(Roles.CUSTOMER) ||
            (this.reviewRank >= 1 && this.reviewRank <= 5)
          );
        },
        message: "Review rank must be between 1 and 5 for customers",
      },
    },

    // Additional fields for review tracking
    reviewCount: {
      type: Number,
      default: 0,
    },

    // Store individual reviews
    reviews: [
      {
        customerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reviewRank: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
