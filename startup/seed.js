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

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin12345";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

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

  // Admin
  const adminSeed = await seedUser({
    username: adminUsername,
    password: adminPassword,
    email: adminEmail,
    roles: [Roles.ADMIN],
    balance: 0,
    activated: true,
  });

  // Test users (override defaults via env vars if needed)
  const testPassword = process.env.SEED_TEST_PASSWORD || "test12345";

  const client1Seed = await seedUser({
    username: process.env.SEED_CLIENT1_USERNAME || "ahmad.almasri",
    password: process.env.SEED_CLIENT1_PASSWORD || testPassword,
    email: process.env.SEED_CLIENT1_EMAIL || "ahmad.almasri@example.com",
    roles: [Roles.CLIENT],
    balance: Number(process.env.SEED_CLIENT1_BALANCE || 120),
    activated: true,
  });

  const client2Seed = await seedUser({
    username: process.env.SEED_CLIENT2_USERNAME || "salim.alwerfalli",
    password: process.env.SEED_CLIENT2_PASSWORD || testPassword,
    email: process.env.SEED_CLIENT2_EMAIL || "salim.alwerfalli@example.com",
    roles: [Roles.CLIENT],
    balance: Number(process.env.SEED_CLIENT2_BALANCE || 45),
    activated: true,
  });

  const client3Seed = await seedUser({
    username: process.env.SEED_CLIENT3_USERNAME || "yousef.alfarsi",
    password: process.env.SEED_CLIENT3_PASSWORD || testPassword,
    email: process.env.SEED_CLIENT3_EMAIL || "yousef.alfarsi@example.com",
    roles: [Roles.CLIENT],
    balance: Number(process.env.SEED_CLIENT3_BALANCE || 0),
    activated: false,
  });

  const customer1Seed = await seedUser({
    username: process.env.SEED_CUSTOMER1_USERNAME || "fatima.alzahra",
    password: process.env.SEED_CUSTOMER1_PASSWORD || testPassword,
    email: process.env.SEED_CUSTOMER1_EMAIL || "fatima.alzahra@example.com",
    roles: [Roles.CUSTOMER],
    balance: Number(process.env.SEED_CUSTOMER1_BALANCE || 250),
    activated: true,
  });

  const customer2Seed = await seedUser({
    username: process.env.SEED_CUSTOMER2_USERNAME || "omar.alsharif",
    password: process.env.SEED_CUSTOMER2_PASSWORD || testPassword,
    email: process.env.SEED_CUSTOMER2_EMAIL || "omar.alsharif@example.com",
    roles: [Roles.CUSTOMER],
    balance: Number(process.env.SEED_CUSTOMER2_BALANCE || 100),
    activated: true,
  });

  const customer3Seed = await seedUser({
    username: process.env.SEED_CUSTOMER3_USERNAME || "khadija.benali",
    password: process.env.SEED_CUSTOMER3_PASSWORD || testPassword,
    email: process.env.SEED_CUSTOMER3_EMAIL || "khadija.benali@example.com",
    roles: [Roles.CUSTOMER],
    balance: Number(process.env.SEED_CUSTOMER3_BALANCE || 410),
    activated: true,
  });

  const customer4Seed = await seedUser({
    username: process.env.SEED_CUSTOMER4_USERNAME || "mohamed.alqadi",
    password: process.env.SEED_CUSTOMER4_PASSWORD || testPassword,
    email: process.env.SEED_CUSTOMER4_EMAIL || "mohamed.alqadi@example.com",
    roles: [Roles.CUSTOMER],
    balance: Number(process.env.SEED_CUSTOMER4_BALANCE || 60),
    activated: false,
  });

  const adminUser = adminSeed.user;
  const client1 = client1Seed.user;
  const client2 = client2Seed.user;
  const client3 = client3Seed.user;
  const customer1 = customer1Seed.user;
  const customer2 = customer2Seed.user;
  const customer3 = customer3Seed.user;
  const customer4 = customer4Seed.user;

  const shouldSeedDemoData =
    String(process.env.SEED_ADMIN_DEMO_DATA || "true").toLowerCase() !==
    "false";
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

  const appTemplates = [
    {
      key: "app-driver-approved-c1",
      applicantUserId: client1._id,
      serviceType: ServiceTypes.DRIVER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-driver-approved-c1",
        fullName: "أحمد المصري",
        licenseNumber: "DRV-2211",
        vehicleType: "سيارة سيدان",
        seats: 4,
        serviceAreas: ["طرابلس", "الزاوية"],
        pricingModel: "لكل كيلومتر",
      },
    },
    {
      key: "app-property-approved-c2",
      applicantUserId: client2._id,
      serviceType: ServiceTypes.PROPERTY_OWNER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-property-approved-c2",
        propertyType: "شقة",
        city: "طرابلس",
        addressLine: "حي الأندلس",
        maxGuests: 5,
        nightlyPrice: 160,
        amenities: ["واي فاي", "تكييف", "موقف سيارات"],
      },
    },
    {
      key: "app-property-approved-c1",
      applicantUserId: client1._id,
      serviceType: ServiceTypes.PROPERTY_OWNER,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-property-approved-c1",
        propertyType: "شاليه",
        city: "زليتن",
        addressLine: "قرب البحر",
        maxGuests: 6,
        nightlyPrice: 190,
        amenities: ["واي فاي", "مطبخ", "موقف سيارات"],
      },
    },
    {
      key: "app-tourism-pending-c3",
      applicantUserId: client3._id,
      serviceType: ServiceTypes.TOURIST_SERVICES,
      status: ProviderApplication.Statuses.PENDING,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-tourism-pending-c3",
        providerName: "رحلات ليبيا السياحية",
        languages: ["العربية", "الإنجليزية"],
        experienceTitle: "جولة المغامرة الصحراوية",
        durationHours: 8,
        groupSizeMax: 12,
        price: 220,
        locations: ["لبدة الكبرى", "صبراتة"],
      },
    },
    {
      key: "app-tourism-approved-c1",
      applicantUserId: client1._id,
      serviceType: ServiceTypes.TOURIST_SERVICES,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-tourism-approved-c1",
        providerName: "دليل طرابلس",
        languages: ["العربية"],
        experienceTitle: "جولة المدينة القديمة",
        durationHours: 3,
        groupSizeMax: 10,
        price: 70,
        locations: ["المدينة القديمة", "السرايا الحمراء"],
      },
    },
    {
      key: "app-tourism-approved-c2",
      applicantUserId: client2._id,
      serviceType: ServiceTypes.TOURIST_SERVICES,
      status: ProviderApplication.Statuses.APPROVED,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-tourism-approved-c2",
        providerName: "بنغازي ترافل",
        languages: ["العربية", "الإنجليزية"],
        experienceTitle: "يوم في بنغازي",
        durationHours: 6,
        groupSizeMax: 15,
        price: 120,
        locations: ["كورنيش بنغازي", "وسط المدينة"],
      },
    },
    {
      key: "app-driver-rejected-c2",
      applicantUserId: client2._id,
      serviceType: ServiceTypes.DRIVER,
      status: ProviderApplication.Statuses.REJECTED,
      submittedData: {
        _seedTag: SEED_TAG,
        _seedKey: "app-driver-rejected-c2",
        fullName: "سالم الورفلي",
        licenseNumber: "DRV-9981",
        vehicleType: "سيارة دفع رباعي",
        seats: 6,
        serviceAreas: ["بنغازي"],
        pricingModel: "لكل رحلة",
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

  const bookingTemplates = [
    {
      key: "bk-001-requested",
      customerUserId: customer1._id,
      providerUserId: client1._id,
      appKey: "app-driver-approved-c1",
      status: Booking.Statuses.REQUESTED,
      amount: 80,
      paymentMethod: "none",
      bookingData: {
        pickupLocation: "قرقارش",
        dropoffLocation: "مطار معيتيقة",
        pickupAt: new Date(now + 1000 * 60 * 60 * 6).toISOString(),
        passengers: 2,
      },
    },
    {
      key: "bk-002-accepted",
      customerUserId: customer2._id,
      providerUserId: client1._id,
      appKey: "app-driver-approved-c1",
      status: Booking.Statuses.ACCEPTED,
      amount: 65,
      paymentMethod: "balance",
      bookingData: {
        pickupLocation: "وسط المدينة",
        dropoffLocation: "المدينة القديمة",
        pickupAt: new Date(now + 1000 * 60 * 60 * 2).toISOString(),
        passengers: 1,
      },
      providerDecision: { note: "تم التأكيد، السائق في الطريق" },
    },
    {
      key: "bk-003-completed",
      customerUserId: customer3._id,
      providerUserId: client2._id,
      appKey: "app-property-approved-c2",
      status: Booking.Statuses.COMPLETED,
      amount: 300,
      paymentMethod: "balance",
      bookingData: {
        checkIn: new Date(now - 1000 * 60 * 60 * 24 * 8).toISOString(),
        checkOut: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(),
        guests: 3,
      },
      providerDecision: { note: "تم تأكيد الحجز بنجاح" },
    },
    {
      key: "bk-004-rejected",
      customerUserId: customer4._id,
      providerUserId: client1._id,
      appKey: "app-driver-approved-c1",
      status: Booking.Statuses.REJECTED,
      amount: 90,
      paymentMethod: "none",
      bookingData: {
        pickupLocation: "حي الأندلس",
        dropoffLocation: "جنزور",
        pickupAt: new Date(now + 1000 * 60 * 60 * 12).toISOString(),
        passengers: 4,
      },
      providerDecision: { note: "السيارة غير متاحة حاليًا" },
    },
    {
      key: "bk-005-cancelled",
      customerUserId: customer1._id,
      providerUserId: client2._id,
      appKey: "app-property-approved-c2",
      status: Booking.Statuses.CANCELLED,
      amount: 150,
      paymentMethod: "balance",
      bookingData: {
        checkIn: new Date(now + 1000 * 60 * 60 * 24 * 2).toISOString(),
        checkOut: new Date(now + 1000 * 60 * 60 * 24 * 4).toISOString(),
        guests: 2,
      },
      customerDecision: { note: "تغيير في الخطة" },
    },
    {
      key: "bk-006-requested",
      customerUserId: customer2._id,
      providerUserId: client2._id,
      appKey: "app-property-approved-c2",
      status: Booking.Statuses.REQUESTED,
      amount: 220,
      paymentMethod: "none",
      bookingData: {
        checkIn: new Date(now + 1000 * 60 * 60 * 24 * 7).toISOString(),
        checkOut: new Date(now + 1000 * 60 * 60 * 24 * 10).toISOString(),
        guests: 4,
      },
    },
    {
      key: "bk-007-requested-tourism",
      customerUserId: customer1._id,
      providerUserId: client1._id,
      appKey: "app-tourism-approved-c1",
      status: Booking.Statuses.REQUESTED,
      amount: 140,
      paymentMethod: "none",
      bookingData: {
        date: new Date(now + 1000 * 60 * 60 * 24 * 3).toISOString(),
        participants: 2,
      },
    },
    {
      key: "bk-008-accepted-property",
      customerUserId: customer3._id,
      providerUserId: client1._id,
      appKey: "app-property-approved-c1",
      status: Booking.Statuses.ACCEPTED,
      amount: 190,
      paymentMethod: "balance",
      bookingData: {
        checkIn: new Date(now + 1000 * 60 * 60 * 24 * 5).toISOString(),
        checkOut: new Date(now + 1000 * 60 * 60 * 24 * 6).toISOString(),
        guests: 2,
      },
      providerDecision: { note: "تم تأكيد الحجز" },
    },
    {
      key: "bk-009-completed-tourism",
      customerUserId: customer2._id,
      providerUserId: client2._id,
      appKey: "app-tourism-approved-c2",
      status: Booking.Statuses.COMPLETED,
      amount: 360,
      paymentMethod: "balance",
      bookingData: {
        date: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
        participants: 3,
      },
      providerDecision: { note: "تمت الجولة بنجاح" },
    },
  ];

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
    `تمت إضافة بيانات تجريبية: ${appTemplates.length} طلبات مزودين، ${seededBookings.length} حجوزات.`,
  );
}

module.exports = { ensureSeedData };
