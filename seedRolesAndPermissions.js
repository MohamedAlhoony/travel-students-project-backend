const mongoose = require("mongoose");
const Permission = require("./models/Permission");
const Role = require("./models/Role");
require("dotenv").config();

async function seedRolesAndPermissions() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Delete all roles and permissions
  await Permission.deleteMany({});
  await Role.deleteMany({});

  // Create all permissions
  const permissionsList = [
    // User permissions
    "user_create",
    "user_list",
    "user_view",
    "user_update",
    "user_delete",
    "user_reset_password",
    "user_activate",
    // Role permissions
    "role_create",
    "role_list",
    "role_view",
    "role_update",
    "role_delete",
    // Permission permissions
    "permission_create",
    "permission_list",
    "permission_view",
    "permission_update",
    "permission_delete",
    // Publication permissions
    "publication_create",
    "publication_list",
    "publication_update_sector_term_compliance",
    "publication_view",
    "publication_update",
    "publication_update_sector_compliance",
    "publication_update_review_status",
    "publication_update_review_state", // <-- Added new permission
    "publication_list_needs_review",
    "publication_delete",
    "publication_sector_list",
    "publication_update_sector_deadline", // <-- Added new permission
    "publication_update_sector_evidence", // <-- Added new permission
    // Publication term permissions (manage terms inside a publication)
    "publication_term_create",
    "publication_term_update",
    "publication_term_delete",
    "publication_term_list",
    "publication_term_view",
    // New permission for listing compliance terms of a sector in a publication
    "publication_sector_compliance_terms_list",
    // Sector permissions
    "sector_create",
    "sector_list",
    "sector_view",
    "sector_update",
    "sector_delete",
    // Report permissions
    "report_generate",
  ];
  const permissions = await Permission.insertMany(
    permissionsList.map((name) => ({
      name,
      description: name.replace(/_/g, " "),
    })),
  );

  // Create legal advisor role (can review publications)
  const legalAdvisorPerms = permissions
    .filter((p) =>
      [
        "publication_list_needs_review",
        "publication_update_review_status",
        // "publication_list",
        "publication_term_list",
        "publication_term_view",
        "sector_view",
        "publication_view",
      ].includes(p.name),
    )
    .map((p) => p._id);

  const legalAdvisorRole = await Role.create({
    name: "LegalAdvisor",
    permissions: legalAdvisorPerms,
    description:
      "Can review and update advisor review status for publications needing review",
  });

  // Create super admin role
  const superAdminRole = await Role.create({
    name: "SuperAdmin",
    permissions: permissions.map((p) => p._id),
    description: "Super admin with all permissions",
  });

  // Create employee role (PubSectorCreatorViewer)
  const employeePerms = permissions
    .filter((p) =>
      [
        "publication_create",
        "publication_list",
        "publication_view",
        "sector_create",
        "sector_list",
        "sector_view",
      ].includes(p.name),
    )
    .map((p) => p._id);

  const employeeRole = await Role.create({
    name: "Employee",
    permissions: employeePerms,
    description: "Can view and create publications and sectors only",
  });

  // Create manager role (all CRUD on sectors and publications)
  const managerPerms = permissions
    .filter((p) =>
      [
        "publication_create",
        "publication_list",
        "publication_view",
        "publication_update",
        "publication_update_sector_compliance",
        "publication_update_sector_evidence",
        "publication_update_review_status",
        "publication_update_review_state", // <-- Added to manager
        "publication_term_create",
        "publication_term_update",
        "publication_term_delete",
        "publication_delete",
        "sector_create",
        "sector_list",
        "sector_view",
        "sector_update",
        "sector_delete",
      ].includes(p.name),
    )
    .map((p) => p._id);

  const managerRole = await Role.create({
    name: "Manager",
    permissions: managerPerms,
    description: "Can perform all CRUD operations on sectors and publications",
  });

  console.log("Roles and permissions seeded.");
  mongoose.disconnect();
}

seedRolesAndPermissions().catch(console.error);
