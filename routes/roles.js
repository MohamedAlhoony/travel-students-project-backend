const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { Roles } = require("../constants/roles");
const { roleValidation, validate } = require("../middleware/validation");

router.post(
  "/",
  auth,
  requireRole(Roles.ADMIN),
  roleValidation,
  validate,
  roleController.create,
);
router.get("/", auth, roleController.getAll);
router.get("/:id", auth, roleController.getById);
router.put("/:id", auth, requireRole(Roles.ADMIN), roleController.update);
router.delete("/:id", auth, requireRole(Roles.ADMIN), roleController.delete);

module.exports = router;
