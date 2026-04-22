const mongoose = require("mongoose");

const classifications = [
  "CBL", // Central Bank of Libya – مصرف ليبيا المركزي
  "NAC", // National Anti-Corruption Authority – الهيئة الوطنية لمكافحة الفساد
  "AB", // Audit Bureau – ديوان المحاسبة
  "ACA", // Administrative Control Authority – هيئة الرقابة الإدارية
  "MOF", // Ministry of Finance – وزارة المالية
  "FIU", // Financial Intelligence Unit – وحدة المعلومات المالية
  "NISSA", // National Information Security & Safety Authority – الهيئة الوطنية لأمن وسلامة المعلومات
];

const PublicationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  classification: { type: String, enum: classifications, required: true },
  date: { type: Date },
  description: String,
  relatedInfo: String,
  reviewState: {
    type: String,
    enum: ["pending_review", "reviewed", "does_not_need_review"],
    default: "does_not_need_review",
    required: true,
  }, // Review state: pending_review, reviewed, does_not_need_review
  advisorReview: {
    type: String,
    enum: ["neutral", "related", "unrelated"],
    default: "neutral",
    required: false,
  }, // Legal advisor review status
  reviewMessage: {
    type: String,
    required: false,
  }, // Message from legal advisor during review
  terms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Term" }], // Array of referenced terms
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  sectors: {
    type: [
      {
        sector: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Sector",
          required: true,
        },
        complianceRate: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
          required: false,
        }, // Percentage of terms complied to by this sector
        deadline: { type: Date }, // deadline date for sector to be compliant
        evidence: { type: String, trim: true }, // CHANGE: trim at schema level
        termsCompliance: [
          {
            term: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Term",
              required: true,
            },
            complianceStatus: {
              type: String,
              enum: ["complied", "uncomplied", "neutral"],
              default: "neutral",
              required: true,
            },
            isCompliedMessage: { type: String }, // optional message with the compliance status
          },
        ],
      },
    ],
    required: false, // <-- make sectors optional
    default: undefined,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  link: { type: String },
  // Optional file field for PDF uploads, max size 5MB
  //   file: {
  //     type: {
  //       filename: String,
  //       mimetype: {
  //         type: String,
  //         enum: ["application/pdf"],
  //       },
  //       size: {
  //         type: Number,
  //         max: 1 * 1024 * 1024, // 1MB
  //       },
  //       url: String, // If storing file URL/path
  //     },
  //     required: false,
  //   },
});

// // Ensure termsCompliance for each sector contains all publication terms before save/update
// function ensureTermsCompliance(doc) {
//   if (
//     doc.sectors &&
//     Array.isArray(doc.sectors) &&
//     doc.terms &&
//     doc.terms.length > 0
//   ) {
//     const publicationTermIds = doc.terms.map((t) => t.toString());
//     for (let sectorObj of doc.sectors) {
//       // Initialize termsCompliance if not present
//       if (!Array.isArray(sectorObj.termsCompliance)) {
//         sectorObj.termsCompliance = [];
//       }
//       // Add missing terms to termsCompliance
//       for (let termId of publicationTermIds) {
//         if (
//           !sectorObj.termsCompliance.some(
//             (c) => c.term && c.term.toString() === termId,
//           )
//         ) {
//           sectorObj.termsCompliance.push({
//             term: termId,
//             complianceStatus: "neutral",
//           });
//         }
//       }
//       // Optionally, remove termsCompliance entries for terms no longer in publication
//       sectorObj.termsCompliance = sectorObj.termsCompliance.filter((c) =>
//         publicationTermIds.includes(c.term.toString()),
//       );
//     }
//   }
// }

// Automatically calculate complianceRate for each sector before saving
// PublicationSchema.pre("save", function (next) {
//   ensureTermsCompliance(this);

//   if (this.sectors && Array.isArray(this.sectors)) {
//     const publicationTermIds = Array.isArray(this.terms)
//       ? this.terms.map((t) => t.toString())
//       : [];

//     for (let sectorObj of this.sectors) {
//       // NEW: normalize evidence (whitespace-only should not persist)
//       if (typeof sectorObj.evidence === "string") {
//         const trimmed = sectorObj.evidence.trim();
//         sectorObj.evidence = trimmed ? trimmed : undefined;
//       }

//       // Compute compliance rate when terms exist
//       if (
//         publicationTermIds.length > 0 &&
//         Array.isArray(sectorObj.termsCompliance)
//       ) {
//         let compliedCount = 0;
//         for (let termId of publicationTermIds) {
//           const tc = sectorObj.termsCompliance.find(
//             (c) =>
//               c.term &&
//               c.term.toString() === termId &&
//               c.complianceStatus === "complied",
//           );
//           if (tc) compliedCount++;
//         }
//         sectorObj.complianceRate = Math.round(
//           (compliedCount / publicationTermIds.length) * 100,
//         );
//       } else {
//         sectorObj.complianceRate = 0;
//       }

//       // If complianceRate is not 100%, automatically remove any existing evidence.
//       // This ensures evidence cannot persist after compliance drops below 100%.
//       if (
//         sectorObj.complianceRate !== 100 &&
//         typeof sectorObj.evidence === "string" &&
//         sectorObj.evidence.trim() !== ""
//       ) {
//         sectorObj.evidence = undefined;
//       }
//     }
//   }
//   next();
// });

// // Also ensure termsCompliance before update (findOneAndUpdate, updateOne, etc.)
// PublicationSchema.pre("findOneAndUpdate", async function (next) {
//   const update = this.getUpdate();
//   // If terms or sectors are being updated, ensure termsCompliance
//   if (
//     (update.terms || update.$set?.terms) &&
//     (update.sectors || update.$set?.sectors)
//   ) {
//     // Get the new terms and sectors from the update
//     const terms = update.terms || update.$set?.terms;
//     const sectors = update.sectors || update.$set?.sectors;
//     if (Array.isArray(terms) && Array.isArray(sectors)) {
//       const doc = { terms, sectors };
//       ensureTermsCompliance(doc);
//       // Write back to update object
//       if (update.terms) update.terms = doc.terms;
//       if (update.sectors) update.sectors = doc.sectors;
//       if (update.$set?.terms) update.$set.terms = doc.terms;
//       if (update.$set?.sectors) update.$set.sectors = doc.sectors;
//     }
//   }
//   next();
// });

module.exports = mongoose.model("Publication", PublicationSchema);
// Export ensureTermsCompliance for use in controllers
// module.exports.ensureTermsCompliance = ensureTermsCompliance;
