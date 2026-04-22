const mongoose = require("mongoose");
const { SERVICE_TYPE_VALUES } = require("../constants/serviceTypes");

const BookingStatuses = Object.freeze({
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
});

const bookingSchema = new mongoose.Schema(
  {
    customerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    providerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProviderApplication",
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      required: true,
      enum: SERVICE_TYPE_VALUES,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(BookingStatuses),
      default: BookingStatuses.REQUESTED,
      index: true,
    },
    bookingData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    providerDecision: {
      decidedAt: Date,
      note: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
    customerDecision: {
      decidedAt: Date,
      note: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
  },
  { timestamps: true },
);

bookingSchema.statics.Statuses = BookingStatuses;

module.exports = mongoose.model("Booking", bookingSchema);
