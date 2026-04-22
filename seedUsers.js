const mongoose = require("mongoose");
const User = require("./models/User");
const Role = require("./models/Role");
require("dotenv").config();

async function seedUsers() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Delete all users
  await User.deleteMany({});

  // Find roles
  const superAdminRole = await Role.findOne({ name: "SuperAdmin" });
  const managerRole = await Role.findOne({ name: "Manager" });
  const employeeRole = await Role.findOne({ name: "Employee" });
  const legalAdvisorRole = await Role.findOne({ name: "LegalAdvisor" });

  if (!superAdminRole || !managerRole || !employeeRole || !legalAdvisorRole) {
    console.error(
      "SuperAdmin, Manager, Employee, or Legal Advisor role not found. Please run the roles and permissions seeder first.",
    );
    mongoose.disconnect();
    return;
  }

  // Create users with hashed passwords
  const bcrypt = require("bcryptjs");
  const usersRaw = [
    {
      username: "mohamed",
      password: "Mohamed@1234",
      email: "mohamed@example.com",
      emailAppPassword: "ftwhpbsgwtxzfjhr",
      canSendEmail: true,
      roles: [superAdminRole._id],
    },
    {
      username: "adam",
      password: "Adam@1234",
      email: "adam@example.com",
      roles: [superAdminRole._id],
    },
    {
      username: "moayed",
      password: "Moayed@1234",
      email: "moayed@example.com",
      roles: [superAdminRole._id],
    },
    {
      username: "abduladeem",
      password: "Abduladeem@1234",
      email: "abduladeem@example.com",
      roles: [superAdminRole._id],
    },
    {
      username: "mustafa",
      password: "Mustafa@1234",
      email: "mustafa@example.com",
      roles: [superAdminRole._id],
    },
    {
      username: "mohamedothman",
      password: "Othman@1234",
      email: "m.othman@moamalat.net",
      roles: [legalAdvisorRole._id],
    },
  ];

  const users = await Promise.all(
    usersRaw.map(async (user) => {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(user.password, salt);
      return { ...user, password: hash };
    }),
  );

  await User.insertMany(users);

  console.log("All users (including superadmin) seeded.");
  mongoose.disconnect();
}

seedUsers().catch(console.error);
