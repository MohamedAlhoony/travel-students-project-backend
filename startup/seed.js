const bcrypt = require("bcryptjs");
const Role = require("../models/Role");
const User = require("../models/User");
const { ROLE_VALUES, Roles } = require("../constants/roles");

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

  const existingAdmin = await User.findOne({ username: adminUsername });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      roles: [Roles.ADMIN],
      activated: true,
    });
    console.log(`Seeded admin user '${adminUsername}'.`);
  }
}

module.exports = { ensureSeedData };
