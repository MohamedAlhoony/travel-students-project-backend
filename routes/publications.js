const express = require("express");
const router = express.Router();
const publicationController = require("../controllers/publicationController");
const auth = require("../middleware/auth");
const permission = require("../middleware/permission");
const { publicationValidation, validate } = require("../middleware/validation");
// const upload = require("../middleware/publicationFileUpload");

router.post(
  "/",
  auth,
  permission("publication_create"),
  //   upload.single("file"),
  // publicationValidation,
  validate,
  publicationController.create,
);
// New route: fetch compliance terms of a sector in a publication with pagination and filters
router.get(
  "/:publicationId/sectors/:sectorId/compliance-terms",
  auth,
  permission("publication_sector_compliance_terms_list"),
  publicationController.getSectorComplianceTerms,
);
router.get(
  "/",
  auth,
  permission("publication_list"),
  publicationController.getAll,
);
router.get(
  "/needs-review",
  auth,
  permission("publication_list_needs_review"),
  publicationController.getNeedsReview,
);
router.get(
  "/:id",
  auth,
  permission("publication_view"),
  publicationController.getById,
);
router.put(
  "/:id",
  auth,
  permission("publication_update"),
  //   upload.single("file"),
  publicationController.update,
);
router.patch(
  "/:publicationId/sectors/:sectorId/isComplied",
  auth,
  permission("publication_update_sector_compliance"),
  publicationController.updateSectorCompliance,
);
router.delete(
  "/:id",
  auth,
  permission("publication_delete"),
  publicationController.delete,
);

router.get(
  "/:id/sectors",
  auth,
  permission("publication_sector_list"),
  publicationController.getPublicationSectors,
);

router.patch(
  "/:id/advisor-review",
  auth,
  permission("publication_update_review_status"),
  publicationController.updateAdvisorReview,
);
// Route to update reviewState with unique permission
router.patch(
  "/:id/review-state",
  auth,
  permission("publication_update_review_state"),
  publicationController.updateReviewState,
);
// Update term compliance for a sector in a publication
router.patch(
  "/:publicationId/sectors/:sectorId/term-compliance",
  auth,
  permission("publication_update_sector_term_compliance"),
  publicationController.updateSectorTermCompliance,
);
// Update deadline for a sector in a publication (unique permission)
router.patch(
  "/:publicationId/sectors/:sectorId/deadline",
  auth,
  permission("publication_update_sector_deadline"),
  publicationController.updateSectorDeadline,
);

// Update evidence for a sector in a publication (unique permission)
router.patch(
  "/:publicationId/sectors/:sectorId/evidence",
  auth,
  permission("publication_update_sector_evidence"),
  publicationController.updateSectorEvidence,
);

// Delete evidence for a sector in a publication (same permission)
router.delete(
  "/:publicationId/sectors/:sectorId/evidence",
  auth,
  permission("publication_update_sector_evidence"),
  publicationController.deleteSectorEvidence,
);
module.exports = router;
