const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { Roles } = require("../constants/roles");
const controller = require("../controllers/adminController");

// Admin dashboard data
router.get(
  "/dashboard",
  auth,
  requireRole(Roles.ADMIN),
  controller.getDashboard,
);

// Admin bookings management
router.get(
  "/bookings",
  auth,
  requireRole(Roles.ADMIN),
  controller.listBookings,
);

router.get(
  "/bookings/:id",
  auth,
  requireRole(Roles.ADMIN),
  controller.getBookingById,
);

module.exports = router;
