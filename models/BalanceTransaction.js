const mongoose = require("mongoose");

const TransactionTypes = Object.freeze({
  TOPUP: "topup",
  ADMIN_ADJUST: "admin_adjust",
  BOOKING_DEBIT: "booking_debit",
  BOOKING_REFUND: "booking_refund",
  BOOKING_PAYOUT: "booking_payout",
});

const balanceTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TransactionTypes),
      index: true,
    },
    amount: {
      // Positive for credit, negative for debit
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    relatedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

balanceTransactionSchema.statics.Types = TransactionTypes;

module.exports = mongoose.model("BalanceTransaction", balanceTransactionSchema);
