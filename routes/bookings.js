const express = require("express");
const router = express.Router();

const controller = require("../controllers/bookingController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { Roles } = require("../constants/roles");
const {
  bookingCreateValidation,
  bookingStatusUpdateValidation,
  validate,
} = require("../middleware/validation");

// Customer: create booking against an approved provider application
router.post(
  "/",
  auth,
  requireRole(Roles.CUSTOMER),
  bookingCreateValidation,
  validate,
  controller.create,
);

// Customer: list own bookings
router.get("/me", auth, requireRole(Roles.CUSTOMER), controller.getMyBookings);

// Provider (client): list bookings sent to them
router.get(
  "/inbox",
  auth,
  requireRole(Roles.CLIENT),
  controller.getProviderBookings,
);

// Customer or Provider: update status within allowed transitions
router.patch(
  "/:id/status",
  auth,
  bookingStatusUpdateValidation,
  validate,
  controller.updateStatus,
);

module.exports = router;
