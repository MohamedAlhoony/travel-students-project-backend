const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const auth = require("../middleware/auth");
const permission = require("../middleware/permission");
const { roleValidation, validate } = require("../middleware/validation");

router.post(
  "/",
  auth,
  permission("role_create"),
  roleValidation,
  validate,
  roleController.create,
);
router.get("/", auth, permission("role_list"), roleController.getAll);
router.get("/:id", auth, permission("role_view"), roleController.getById);
router.put("/:id", auth, permission("role_update"), roleController.update);
router.delete("/:id", auth, permission("role_delete"), roleController.delete);

module.exports = router;
