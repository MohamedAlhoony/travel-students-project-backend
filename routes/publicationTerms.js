// Get terms of a publication with pagination, search, and category filter

const express = require("express");

const router = express.Router({ mergeParams: true });

const auth = require("../middleware/auth");
const permission = require("../middleware/permission");

const publicationTermController = require("../controllers/publicationTermController");
router.get(
  "/",
  auth,
  permission("publication_term_list"),
  publicationTermController.getPublicationTerms,
);
// Add a single term to a publication
router.post(
  "/",
  auth,
  permission("publication_term_create"),
  publicationTermController.addTermToPublication,
);

// Update a single term that belongs to a publication

// Get a single term by id
router.get(
  "/:termId",
  auth,
  permission("publication_term_view"),
  publicationTermController.getPublicationTermById,
);

// Update a single term that belongs to a publication
router.patch(
  "/:termId",
  auth,
  permission("publication_term_update"),
  publicationTermController.updatePublicationTerm,
);

// Delete a single term from a publication (and delete the Term document)
router.delete(
  "/:termId",
  auth,
  permission("publication_term_delete"),
  publicationTermController.deletePublicationTerm,
);

module.exports = router;
