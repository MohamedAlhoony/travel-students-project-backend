const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const auth = require("../middleware/auth");
const permission = require("../middleware/permission");

// Sector -> Publications -> Compliance report
// GET /reports/sectors supports: sectorId,parent,type,search,fromDate,toDate,classification,reviewState,
// includePublications,includeTerms,pubLimit,page,limit,sort,direction
router.get(
  "/sectors",
  auth,
  permission("report_generate"),
  reportController.getSectorsPublicationsComplianceReport,
);

module.exports = router;
