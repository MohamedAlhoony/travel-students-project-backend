const express = require("express");
const router = express.Router();
const sectorController = require("../controllers/sectorController");
const auth = require("../middleware/auth");
const permission = require("../middleware/permission");
const { sectorValidation, validate } = require("../middleware/validation");

router.post(
  "/",
  auth,
  permission("sector_create"),
  sectorValidation,
  validate,
  sectorController.create,
);
router.get("/", auth, permission("sector_list"), sectorController.getAll);
router.get("/:id", auth, permission("sector_view"), sectorController.getById);
router.put("/:id", auth, permission("sector_update"), sectorController.update);
router.delete(
  "/:id",
  auth,
  permission("sector_delete"),
  sectorController.delete,
);

module.exports = router;
