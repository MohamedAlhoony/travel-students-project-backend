const express = require("express");
const router = express.Router();

const controller = require("../controllers/servicesController");

// Public: list approved services
router.get("/", controller.listApprovedServices);

module.exports = router;
