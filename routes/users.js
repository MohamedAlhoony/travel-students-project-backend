const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { Roles } = require("../constants/roles");
const {
  userCreateValidation,
  userLoginValidation,
  customerRegisterValidation,
  passwordResetValidation,
  validate,
} = require("../middleware/validation");

// Public: customer register
router.post(
  "/register",
  customerRegisterValidation,
  validate,
  userController.registerCustomer,
);

router.post(
  "/",
  auth,
  requireRole(Roles.ADMIN),
  userCreateValidation,
  validate,
  userController.create,
);
router.get("/profile", auth, userController.profile);
router.get(
  "/clients",
  auth,
  requireRole(Roles.ADMIN),
  userController.listClients,
);
router.get("/", auth, requireRole(Roles.ADMIN), userController.getAll);
router.get("/:id", auth, userController.getById);
router.put("/:id", auth, userController.update);
router.delete("/:id", auth, requireRole(Roles.ADMIN), userController.delete);
router.post("/login", userLoginValidation, validate, userController.login);
router.post(
  "/reset-password",
  auth,
  requireRole(Roles.ADMIN),
  passwordResetValidation,
  validate,
  userController.resetPassword,
);
router.patch(
  "/:id/activation",
  auth,
  requireRole(Roles.ADMIN),
  userController.updateUserActivation,
);
module.exports = router;
