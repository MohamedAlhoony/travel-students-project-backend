const bcrypt = require("bcryptjs");
const Role = require("../models/Role");
const User = require("../models/User");
const ProviderApplication = require("../models/ProviderApplication");
const Booking = require("../models/Booking");
const BalanceTransaction = require("../models/BalanceTransaction");
const { ROLE_VALUES, Roles } = require("../constants/roles");
const { ServiceTypes } = require("../constants/serviceTypes");

const SEED_TAG = "seed-admin-demo-v1";

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

async function ensureSeedData() {
  // Roles are fixed; ensure the collection contains them for listing.
  await Promise.all(
    ROLE_VALUES.map((name) =>
      Role.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true }),
    ),
  );

  // Remove roles that are no longer part of the enum (e.g. old 'user')
  await Role.deleteMany({ name: { $nin: ROLE_VALUES } });

  // ── Wipe all previous providers and customers ────────────────────────────────
  const oldProviderAndCustomerUsers = await User.find({
    roles: { $in: [Roles.CLIENT, Roles.CLIENT, Roles.CUSTOMER] },
  }).select("_id");
  const oldUserIds = oldProviderAndCustomerUsers.map((u) => u._id);

  if (oldUserIds.length) {
    await Booking.deleteMany({
      $or: [
        { customerUserId: { $in: oldUserIds } },
        { providerUserId: { $in: oldUserIds } },
      ],
    });
    await ProviderApplication.deleteMany({
      applicantUserId: { $in: oldUserIds },
    });
    await BalanceTransaction.deleteMany({
      userId: { $in: oldUserIds },
    });
    await User.deleteMany({ _id: { $in: oldUserIds } });
    console.log(
      `Removed ${oldUserIds.length} old provider/customer user(s) and their related data.`,
    );
  }

  async function seedUser({
    username,
    password,
    email,
    roles,
    balance,
    activated,
  }) {
    const existing = await User.findOne({ username });
    if (existing) {
      // Ensure new fields exist on older DBs.
      const updates = {};
      if (existing.balance === undefined) {
        updates.balance = typeof balance === "number" ? balance : 0;
      }
      if (typeof activated === "boolean" && existing.activated !== activated) {
        updates.activated = activated;
      }
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: existing._id }, { $set: updates });
      }
      const refreshed = await User.findById(existing._id);
      return { created: false, user: refreshed || existing };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await User.create({
      username,
      email,
      passwordHash,
      roles,
      activated: typeof activated === "boolean" ? activated : true,
      balance: typeof balance === "number" ? balance : 0,
    });
    console.log(`Seeded user '${username}' with roles [${roles.join(", ")}].`);
    return { created: true, user: created };
  }

  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminSeed = await seedUser({
    username: "admin",
    password: "admin12345",
    email: "admin@example.com",
    roles: [Roles.ADMIN],
    balance: 0,
    activated: true,
  });

  const testPassword = "test12345";

  // ── 2 Driver Providers ───────────────────────────────────────────────────────
  const provider_driver_1_Seed = await seedUser({
    username: "khalid.almasri",
    password: testPassword,
    email: "khalid.almasri@example.com",
    roles: [Roles.CLIENT],
    balance: 320,
    activated: true,
  });

  const provider_driver_2_Seed = await seedUser({
    username: "omar.alwerfalli",
    password: testPassword,
    email: "omar.alwerfalli@example.com",
    roles: [Roles.CLIENT],
    balance: 180,
    activated: true,
  });

  // ── 2 Property Owner Providers ───────────────────────────────────────────────
  const provider_property_1_Seed = await seedUser({
    username: "fatima.alzahra",
    password: testPassword,
    email: "fatima.alzahra@example.com",
    roles: [Roles.CLIENT],
    balance: 540,
    activated: true,
  });

  const provider_property_2_Seed = await seedUser({
    username: "maryam.bensalem",
    password: testPassword,
    email: "maryam.bensalem@example.com",
    roles: [Roles.CLIENT],
    balance: 275,
    activated: true,
  });

  // ── 2 Tourist Services Providers ─────────────────────────────────────────────
  const provider_tourism_1_Seed = await seedUser({
    username: "yusuf.alfarsi",
    password: testPassword,
    email: "yusuf.alfarsi@example.com",
    roles: [Roles.CLIENT],
    balance: 410,
    activated: true,
  });

  const provider_tourism_2_Seed = await seedUser({
    username: "salim.alqadi",
    password: testPassword,
    email: "salim.alqadi@example.com",
    roles: [Roles.CLIENT],
    balance: 90,
    activated: false,
  });

  const adminUser = adminSeed.user;
  const providerDriver1 = provider_driver_1_Seed.user;
  const providerDriver2 = provider_driver_2_Seed.user;
  const providerProperty1 = provider_property_1_Seed.user;
  const providerProperty2 = provider_property_2_Seed.user;
  const providerTourism1 = provider_tourism_1_Seed.user;
  const providerTourism2 = provider_tourism_2_Seed.user;

  const shouldSeedDemoData = true;
  if (!shouldSeedDemoData) {
    return;
  }

  // Re-seed demo entities in an idempotent way using a seed marker.
  await Booking.deleteMany({ "bookingData._seedTag": SEED_TAG });
  await ProviderApplication.deleteMany({ "submittedData._seedTag": SEED_TAG });
  await BalanceTransaction.deleteMany({
    note: new RegExp(`\\[${SEED_TAG}\\]`),
  });

  const now = Date.now();

  // ── Provider Applications (2 per service type = 6 total) ────────────────────
  const appTemplates = [
    // ── Driver × 2 ────────────────────────────────────────────────────────────
    {
      key: "app-driver-1",
      applicantUserId: providerDriver1._id,
      serviceType: ServiceTypes.DRIVER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        fullName: "خالد أحمد المصري",
        licenseNumber: "DRV-1001",
        vehicleType: "سيارة سيدان",
        vehicleModel: "تويوتا كامري 2021",
        seats: 4,
        serviceAreas: ["طرابلس", "الزاوية", "صبراتة"],
        pricingModel: "لكل كيلومتر",
        pricePerKm: 2.5,
        languages: ["العربية"],
        yearsOfExperience: 7,
      },
    },
    {
      key: "app-driver-2",
      applicantUserId: providerDriver2._id,
      serviceType: ServiceTypes.DRIVER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        fullName: "عمر محمود الورفلي",
        licenseNumber: "DRV-1002",
        vehicleType: "سيارة دفع رباعي",
        vehicleModel: "ميتسوبيشي باجيرو 2020",
        seats: 7,
        serviceAreas: ["بنغازي", "طبرق", "درنة"],
        pricingModel: "لكل رحلة",
        pricePerTrip: 120,
        languages: ["العربية", "الإنجليزية"],
        yearsOfExperience: 5,
      },
    },

    // ── Property Owner × 2 ────────────────────────────────────────────────────
    {
      key: "app-property-1",
      applicantUserId: providerProperty1._id,
      serviceType: ServiceTypes.PROPERTY_OWNER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        ownerName: "فاطمة الزهراء",
        propertyType: "شقة مفروشة",
        city: "طرابلس",
        addressLine: "شارع الحرية، حي السلام، الطابق الثالث",
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 1,
        nightlyPrice: 120,
        amenities: ["واي فاي", "تكييف", "موقف سيارات", "مطبخ مجهز", "تلفزيون"],
        checkInTime: "14:00",
        checkOutTime: "12:00",
        minimumNights: 1,
      },
    },
    {
      key: "app-property-2",
      applicantUserId: providerProperty2._id,
      serviceType: ServiceTypes.PROPERTY_OWNER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        ownerName: "مريم بن سالم",
        propertyType: "شاليه ساحلي",
        city: "زليتن",
        addressLine: "منطقة الجمال، على بُعد 200 متر من الشاطئ",
        maxGuests: 8,
        bedrooms: 3,
        bathrooms: 2,
        nightlyPrice: 220,
        amenities: [
          "واي فاي",
          "تكييف",
          "موقف سيارات",
          "حمام سباحة",
          "حديقة خاصة",
          "مطبخ مجهز",
          "شواء خارجي",
        ],
        checkInTime: "15:00",
        checkOutTime: "11:00",
        minimumNights: 2,
      },
    },

    // ── Tourist Services × 2 ──────────────────────────────────────────────────
    {
      key: "app-tourism-1",
      applicantUserId: providerTourism1._id,
      serviceType: ServiceTypes.TOURIST_SERVICES,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        providerName: "يوسف الفارسي للسياحة",
        companyName: "رحلات طرابلس السياحية",
        languages: ["العربية", "الإنجليزية"],
        experienceTitle: "جولة في المدينة القديمة وقلعة الشط",
        description:
          "جولة مميزة تأخذك عبر تاريخ طرابلس العريق من المدينة القديمة وأسواقها الشعبية وصولاً إلى السرايا الحمراء الشامخة.",
        durationHours: 3,
        groupSizeMax: 15,
        price: 60,
        locations: [
          "المدينة القديمة",
          "السرايا الحمراء",
          "قلعة الشط",
          "سوق الجمعة",
        ],
        availableDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
        includesTransport: true,
        includesMeals: false,
      },
    },
    {
      key: "app-tourism-2",
      applicantUserId: providerTourism2._id,
      serviceType: ServiceTypes.TOURIST_SERVICES,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        providerName: "سالم القاضي للسياحة",
        companyName: "بنغازي للسياحة والتراث",
        languages: ["العربية", "الفرنسية"],
        experienceTitle: "رحلة صحراوية مميزة في النفوسة",
        description:
          "تجربة استثنائية في أعماق الصحراء الليبية، تشمل ركوب الخيل والإقامة في خيمة تقليدية ومشاهدة النجوم.",
        durationHours: 8,
        groupSizeMax: 10,
        price: 150,
        locations: ["جبل نفوسة", "قصر الحاج", "غريان"],
        availableDays: ["الجمعة", "السبت"],
        includesTransport: true,
        includesMeals: true,
      },
    },
  ];

  const applicationByKey = {};
  for (const tpl of appTemplates) {
    const decision =
      tpl.status === ProviderApplication.Statuses.PENDING
        ? undefined
        : {
            decidedByUserId: adminUser._id,
            decidedAt: new Date(now - 1000 * 60 * 60 * 24 * 5),
            note: `[${SEED_TAG}] قرار تجريبي من الإدارة`,
          };

    const created = await ProviderApplication.create({
      applicantUserId: tpl.applicantUserId,
      serviceType: tpl.serviceType,
      status: tpl.status,
      submittedData: tpl.submittedData,
      adminDecision: decision,
      createdAt: new Date(
        now - 1000 * 60 * 60 * 24 * (2 + Math.floor(Math.random() * 45)),
      ),
      updatedAt: new Date(
        now - 1000 * 60 * 60 * 24 * (1 + Math.floor(Math.random() * 20)),
      ),
    });

    applicationByKey[tpl.key] = created;
  }

  // No bookings for this simplified version
  const bookingTemplates = [];

  const seededBookings = [];
  for (const tpl of bookingTemplates) {
    const app = applicationByKey[tpl.appKey];
    if (!app) continue;

    const created = await Booking.create({
      customerUserId: tpl.customerUserId,
      providerUserId: tpl.providerUserId,
      applicationId: app._id,
      serviceType: app.serviceType,
      status: tpl.status,
      bookingData: {
        ...tpl.bookingData,
        _seedTag: SEED_TAG,
        _seedKey: tpl.key,
      },
      amount: roundMoney(tpl.amount),
      payment: {
        method: tpl.paymentMethod,
      },
      providerDecision: tpl.providerDecision
        ? {
            decidedAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
            note: tpl.providerDecision.note,
          }
        : undefined,
      customerDecision: tpl.customerDecision
        ? {
            decidedAt: new Date(now - 1000 * 60 * 60 * 24),
            note: tpl.customerDecision.note,
          }
        : undefined,
      createdAt: new Date(
        now - 1000 * 60 * 60 * 24 * (1 + Math.floor(Math.random() * 50)),
      ),
      updatedAt: new Date(
        now - 1000 * 60 * 60 * 12 * (1 + Math.floor(Math.random() * 30)),
      ),
    });

    seededBookings.push(created);
  }

  const transactions = [];
  for (const b of seededBookings) {
    if (b.payment?.method !== "balance" || !Number.isFinite(Number(b.amount)))
      continue;
    const amount = roundMoney(Number(b.amount));

    transactions.push({
      userId: b.customerUserId,
      createdByUserId: adminUser._id,
      type: BalanceTransaction.Types.BOOKING_DEBIT,
      amount: -Math.abs(amount),
      balanceAfter: 0,
      relatedBookingId: b._id,
      note: `[${SEED_TAG}] خصم رصيد تجريبي للحجز`,
      createdAt: b.createdAt,
      updatedAt: b.createdAt,
    });

    if (b.status === Booking.Statuses.COMPLETED) {
      transactions.push({
        userId: b.providerUserId,
        createdByUserId: adminUser._id,
        type: BalanceTransaction.Types.BOOKING_PAYOUT,
        amount: Math.abs(amount),
        balanceAfter: 0,
        relatedBookingId: b._id,
        note: `[${SEED_TAG}] صرف رصيد تجريبي لمزود الخدمة`,
        createdAt: b.updatedAt,
        updatedAt: b.updatedAt,
      });
    }

    if (
      b.status === Booking.Statuses.REJECTED ||
      b.status === Booking.Statuses.CANCELLED
    ) {
      transactions.push({
        userId: b.customerUserId,
        createdByUserId: adminUser._id,
        type: BalanceTransaction.Types.BOOKING_REFUND,
        amount: Math.abs(amount),
        balanceAfter: 0,
        relatedBookingId: b._id,
        note: `[${SEED_TAG}] استرجاع رصيد تجريبي للحجز`,
        createdAt: b.updatedAt,
        updatedAt: b.updatedAt,
      });
    }
  }

  if (transactions.length) {
    await BalanceTransaction.insertMany(transactions);
  }

  console.log(
    `تمت إضافة البيانات التجريبية: ${appTemplates.length} طلبات مزودين` +
      ` (${appTemplates.length / 3} سائقين، ${appTemplates.length / 3} ملاك عقارات، ${appTemplates.length / 3} مزودي خدمات سياحية).`,
  );
}

module.exports = { ensureSeedData };
