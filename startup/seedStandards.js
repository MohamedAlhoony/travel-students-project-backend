const Standards = require("../models/Standards");

async function seedStandards() {
  try {
    // Check if standards already exist
    const existingStandards = await Standards.findOne();

    if (existingStandards) {
      console.log("Standards already exist. Skipping seeding.");
      return;
    }

    // Create new standards with Arabic data
    const standardsData = {
      minReviewRank: 4,
      minReviewCount: 10,
      requiredDocuments: [
        "بطاقة الهوية",
        "شهادة الحسن السيرة",
        "شهادة الخبرة في المجال",
      ],
      verificationRequired: true,
      transportation: {
        enabled: true,
        minVehicleAge: 15,
        requiredInsurances: [
          "تأمين ضد الحوادث",
          "تأمين ضد السرقة",
          "تأمين ضد الأضرار للطرف الثالث",
        ],
        minCapacity: 4,
      },
      accommodation: {
        enabled: true,
        minRoomCount: 3,
        requiredAmenities: [
          "واي فاي",
          "تكييف",
          "مطبخ مجهز",
          "موقف سيارات",
          "تلفاز",
        ],
        qualityRatingThreshold: 4,
      },
      tourGuide: {
        enabled: true,
        requiredCertifications: [
          "شهادة مرشد سياحي معتمد",
          "شهادة إتقان اللغة الإنجليزية",
        ],
        minExperienceYears: 3,
        languages: ["العربية", "الإنجليزية", "الفرنسية"],
      },
      active: true,
    };

    const newStandards = new Standards(standardsData);
    await newStandards.save();

    console.log("Successfully seeded standards with Arabic data.");
  } catch (error) {
    console.error("Error seeding standards:", error.message);
  }
}

module.exports = { seedStandards };
