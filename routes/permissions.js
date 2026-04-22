const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const auth = require("../middleware/auth");
const permission = require("../middleware/permission");
const { permissionValidation, validate } = require("../middleware/validation");

router.post(
  "/",
  auth,
  permission("permission_create"),
  permissionValidation,
  validate,
  permissionController.create,
);
router.get(
  "/",
  auth,
  permission("permission_list"),
  permissionController.getAll,
);
router.get(
  "/:id",
  auth,
  permission("permission_view"),
  permissionController.getById,
);
router.put(
  "/:id",
  auth,
  permission("permission_update"),
  permissionController.update,
);
router.delete(
  "/:id",
  auth,
  permission("permission_delete"),
  permissionController.delete,
);

module.exports = router;
