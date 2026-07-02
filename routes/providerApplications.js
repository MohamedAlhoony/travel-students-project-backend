const express = require("express");
const router = express.Router();

const controller = require("../controllers/providerApplicationController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { Roles } = require("../constants/roles");
const {
  clientApplicationRegisterValidation,
  clientApplicationCreateValidation,
  applicationDecisionValidation,
  validate,
} = require("../middleware/validation");

// Public: client registers + submits provider application
router.post(
  "/register",
  // clientApplicationRegisterValidation,
  // validate,
  controller.uploadFields,
  controller.registerClientApplication,
);

// Client: submit a new application under the same account
router.post(
  "/",
  auth,
  requireRole(Roles.CLIENT),
  // clientApplicationCreateValidation,
  // validate,
  controller.uploadOnlyImages,
  controller.createMyApplication,
);

// Client: view own applications
router.get(
  "/me",
  auth,
  requireRole(Roles.CLIENT),
  controller.getMyApplications,
);

// Admin: list & decide
router.get("/", auth, requireRole(Roles.ADMIN), controller.listApplications);

router.get(
  "/:id",
  auth,
  requireRole(Roles.ADMIN),
  controller.getApplicationById,
);

router.patch(
  "/:id/approve",
  auth,
  requireRole(Roles.ADMIN),
  applicationDecisionValidation,
  validate,
  controller.approve,
);

router.patch(
  "/:id/reject",
  auth,
  requireRole(Roles.ADMIN),
  applicationDecisionValidation,
  validate,
  controller.reject,
);

module.exports = router;
