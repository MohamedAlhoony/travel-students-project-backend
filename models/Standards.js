const mongoose = require("mongoose");

const standardsSchema = new mongoose.Schema(
  {
    // General provider requirements
    minReviewRank: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
    minReviewCount: {
      type: Number,
      default: 5,
      min: 0,
    },
    requiredDocuments: [
      {
        type: String,
        trim: true,
      },
    ],
    verificationRequired: {
      type: Boolean,
      default: true,
    },

    // Service-specific standards
    transportation: {
      enabled: {
        type: Boolean,
        default: true,
      },
      minVehicleAge: {
        type: Number,
        default: 10, // years
      },
      requiredInsurances: [
        {
          type: String,
          trim: true,
        },
      ],
      minCapacity: {
        type: Number,
        default: 4,
      },
    },

    accommodation: {
      enabled: {
        type: Boolean,
        default: true,
      },
      minRoomCount: {
        type: Number,
        default: 5,
      },
      requiredAmenities: [
        {
          type: String,
          trim: true,
        },
      ],
      qualityRatingThreshold: {
        type: Number,
        default: 4,
        min: 1,
        max: 5,
      },
    },

    tourGuide: {
      enabled: {
        type: Boolean,
        default: true,
      },
      requiredCertifications: [
        {
          type: String,
          trim: true,
        },
      ],
      minExperienceYears: {
        type: Number,
        default: 2,
      },
      languages: [
        {
          type: String,
          trim: true,
        },
      ],
    },

    // Additional settings
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Standards", standardsSchema);
