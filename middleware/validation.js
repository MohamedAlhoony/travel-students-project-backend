const { body, validationResult } = require("express-validator");

// Validation rules for each model
const userValidation = [
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

const roleValidation = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage("Role name must be 3-32 chars"),
  body("permissions").isArray().optional(),
];

const permissionValidation = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage("Permission name must be 3-32 chars"),
  body("description").optional().isString().isLength({ max: 128 }),
];

const publicationValidation = [
  body("title")
    .isString()
    .trim()
    .isLength({ min: 3, max: 1000 })
    .withMessage("Title must be 3-1000 chars"),
  body("category").isString().trim().isLength({ min: 3, max: 32 }),
  body("date").optional().isISO8601().toDate(),
  body("description").optional().isString().isLength({ max: 1024 }),
  // body("relatedInfo").optional().isString().isLength({ max: 1024 }),
  body("sectors").optional().isArray(),
  // Validate term titles if provided (for create/update with terms)
  body("terms").optional().isArray(),
  body("terms.*.title")
    .isString()
    .isLength({ min: 3, max: 1000 })
    .withMessage("Term title must be 3-1000 chars"),
  // File validation (PDF, max 5MB)
  (req, res, next) => {
    if (req.file) {
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "Only PDF files are allowed." });
      }
      if (req.file.size > 1 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds 1MB limit." });
      }
    }
    next();
  },
];

const sectorValidation = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 64 })
    .withMessage("Sector name must be 2-64 chars"),
  body("description").optional().isString().isLength({ max: 256 }),
  body("parent").optional().isString(),
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
  userValidation,
  roleValidation,
  permissionValidation,
  publicationValidation,
  sectorValidation,
  validate,
};
