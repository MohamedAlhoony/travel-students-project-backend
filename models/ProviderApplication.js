const mongoose = require("mongoose");
const { SERVICE_TYPE_VALUES } = require("../constants/serviceTypes");

const ApplicationStatuses = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const applicationSchema = new mongoose.Schema(
  {
    applicantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      enum: Object.values(ApplicationStatuses),
      default: ApplicationStatuses.PENDING,
      index: true,
    },
    submittedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Store images as buffer data with metadata
    images: [
      {
        data: Buffer,
        contentType: String,
        originalName: String,
      },
    ],
    registrationImages: [
      {
        data: Buffer,
        contentType: String,
        originalName: String,
      },
    ],
    adminDecision: {
      decidedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      decidedAt: {
        type: Date,
      },
      note: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
  },
  { timestamps: true },
);

applicationSchema.statics.Statuses = ApplicationStatuses;

module.exports = mongoose.model("ProviderApplication", applicationSchema);
