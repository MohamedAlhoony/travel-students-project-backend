const express = require("express");
const router = express.Router();
const {
  getStandards,
  updateStandards,
} = require("../controllers/standardsController");

// GET /api/standards - Get current standards
router.get("/", getStandards);

// PUT /api/standards - Update standards
router.put("/", updateStandards);

module.exports = router;
