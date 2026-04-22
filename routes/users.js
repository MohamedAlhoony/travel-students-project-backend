const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");
const permission = require("../middleware/permission");
const { userValidation, validate } = require("../middleware/validation");

router.post(
  "/",
  auth,
  permission("user_create"),
  userValidation,
  validate,
  userController.create,
);
router.get("/profile", auth, userController.profile);
router.get("/", auth, permission("user_list"), userController.getAll);
router.get("/:id", auth, permission("user_view"), userController.getById);
router.put("/:id", auth, permission("user_update"), userController.update);
router.delete("/:id", auth, permission("user_delete"), userController.delete);
router.post("/login", userValidation, validate, userController.login);
router.post(
  "/reset-password",
  auth,
  permission("user_reset_password"),
  userValidation,
  validate,
  userController.resetPassword,
);
router.patch(
  "/:id/activation",
  auth,
  permission("user_activate"),
  userController.updateUserActivation,
);
module.exports = router;
