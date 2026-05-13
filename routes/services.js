const express = require("express");
const router = express.Router();

const controller = require("../controllers/servicesController");

// Public: list approved services
router.get("/", controller.listApprovedServices);

// Public: get a single approved service by id
router.get("/:id", controller.getApprovedServiceById);

module.exports = router;
