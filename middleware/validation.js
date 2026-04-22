const { body, validationResult } = require("express-validator");
const { ROLE_VALUES } = require("../constants/roles");
const { SERVICE_TYPE_VALUES } = require("../constants/serviceTypes");
const Booking = require("../models/Booking");

// Validation rules
const userCreateValidation = [
  body("username")
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage("Username must be 3-32 chars"),
  body("password")
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage("Password must be 8-64 chars"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email"),
  body("roles")
    .optional()
    .isArray()
    .withMessage("roles must be an array")
    .bail()
    .custom((roles) =>
      roles.every((r) => ROLE_VALUES.includes(String(r).toLowerCase())),
    )
    .withMessage(`roles must be one of: ${ROLE_VALUES.join(", ")}`),
  body("activated")
    .optional()
    .isBoolean()
    .withMessage("activated must be boolean"),
];

const userLoginValidation = [
  body("username")
    .isString()
    .trim()
    .isLength({ min: 1, max: 32 })
    .withMessage("username is required"),
  body("password")
    .isString()
    .isLength({ min: 1, max: 64 })
    .withMessage("password is required"),
];

const customerRegisterValidation = [
  body("username")
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage("Username must be 3-32 chars"),
  body("password")
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage("Password must be 8-64 chars"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email"),
];

const passwordResetValidation = [
  body("username")
    .isString()
    .trim()
    .isLength({ min: 1, max: 32 })
    .withMessage("username is required"),
  body("newPassword")
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage("newPassword must be 8-64 chars"),
];

const roleValidation = [
  body("name")
    .optional()
    .isString()
    .trim()
    .custom((value) => ROLE_VALUES.includes(String(value).toLowerCase()))
    .withMessage(`Role name must be one of: ${ROLE_VALUES.join(", ")}`),
];

const clientApplicationRegisterValidation = [
  body("username")
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage("Username must be 3-32 chars"),
  body("password")
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage("Password must be 8-64 chars"),
  body("email").optional().isEmail().normalizeEmail(),
  body("serviceType")
    .isString()
    .trim()
    .custom((value) =>
      SERVICE_TYPE_VALUES.includes(String(value).toLowerCase()),
    )
    .withMessage(
      `serviceType must be one of: ${SERVICE_TYPE_VALUES.join(", ")}`,
    ),
  body("submittedData")
    .isObject()
    .withMessage("submittedData must be an object"),
];

const applicationDecisionValidation = [
  body("note")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("note must be <= 2000 chars"),
];

const bookingCreateValidation = [
  body("applicationId")
    .isMongoId()
    .withMessage("applicationId must be a valid MongoId"),
  body("bookingData").isObject().withMessage("bookingData must be an object"),
];

const bookingStatusUpdateValidation = [
  body("status")
    .isString()
    .trim()
    .custom((value) =>
      Object.values(Booking.Statuses).includes(String(value).toLowerCase()),
    )
    .withMessage(
      `status must be one of: ${Object.values(Booking.Statuses).join(", ")}`,
    ),
  body("note")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("note must be <= 2000 chars"),
];

// Middleware to check validation result
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = {
  userCreateValidation,
  userLoginValidation,
  customerRegisterValidation,
  passwordResetValidation,
  roleValidation,
  clientApplicationRegisterValidation,
  applicationDecisionValidation,
  bookingCreateValidation,
  bookingStatusUpdateValidation,
  validate,
};
