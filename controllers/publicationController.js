const Term = require("../models/Term");
const Publication = require("../models/Publication");

exports.create = async (req, res) => {
  try {
    // Default reviewState if not provided
    let reviewState = req.body.reviewState;
    if (!reviewState) {
      reviewState = "does_not_need_review";
    }

    const publicationData = {
      ...req.body,
      reviewState,
      createdBy: req.userId ? req.userId : undefined,
    };

    // Add classification if provided
    if (req.body.classification) {
      publicationData.classification = req.body.classification;
    }

    const publication = await Publication.create(publicationData);
    res.status(201).json({
      success: true,
      message: "Publication created successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to create publication.",
      error: err.message,
    });
  }
};
// Update deadline for a sector in a publication (unique permission)
exports.updateSectorDeadline = async (req, res) => {
  try {
    const { publicationId, sectorId } = req.params;
    const { deadline } = req.body;
    if (!deadline) {
      return res.status(400).json({ error: "Deadline is required" });
    }
    const publication = await Publication.findById(publicationId);
    if (!publication) {
      return res.status(404).json({ error: "Publication not found" });
    }

    // Find sector by array entry _id (sector entry id)
    const sectorEntry = Array.isArray(publication.sectors)
      ? publication.sectors.find((s) => s && String(s._id) === String(sectorId))
      : undefined;
    if (!sectorEntry) {
      return res.status(404).json({ error: "Sector not found in publication" });
    }
    sectorEntry.deadline = new Date(deadline);
    await publication.save();
    await publication.populate("sectors.sector");
    res.json({
      success: true,
      message: "Sector deadline updated successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "date",
      order = "desc",
      sector,
      fromDate,
      toDate,
      search,
      classification,
      reviewState,
    } = req.query;
    const filter = {};
    if (sector) filter["sectors.sector"] = sector;
    if (classification) filter.classification = classification;
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { relatedInfo: { $regex: search, $options: "i" } },
      ];
    }
    // Filter for publications by reviewState
    if (reviewState) {
      filter.reviewState = reviewState;
    }
    // Allow sorting on any field, default to descending
    const sortObj = {};
    sortObj[sort] = order === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;
    const [publications, total] = await Promise.all([
      Publication.find(filter)
        // .populate("sectors.sector") // REMOVE: do not populate sectors here
        // .populate("terms") // REMOVE: do not populate terms here
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit)),
      Publication.countDocuments(filter),
    ]);
    // Remove terms and sectors from each publication object and add counts
    const publicationsWithCounts = publications.map((pub) => {
      const pubObj = pub.toObject();
      // Add termsCount property
      pubObj.termsCount = Array.isArray(pubObj.terms) ? pubObj.terms.length : 0;
      // Add sectorsCount property
      pubObj.sectorsCount = Array.isArray(pubObj.sectors)
        ? pubObj.sectors.length
        : 0;
      delete pubObj.terms;
      delete pubObj.sectors;
      return pubObj;
    });
    const totalPages = Math.ceil(total / limit);
    res.json({
      data: publicationsWithCounts,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id)
      .populate({ path: "createdBy", select: "username email _id" })
      .populate({ path: "updatedBy", select: "username email _id" })
      .populate({ path: "reviewedBy", select: "username email _id" })
      .populate({ path: "sectors.sector", select: "_id name" });
    if (!publication) return res.status(404).json({ error: "Not found" });
    const pubObj = publication.toObject();
    // Only return sector name and id
    pubObj.sectors = Array.isArray(pubObj.sectors)
      ? pubObj.sectors
          .map((s) =>
            s.sector && typeof s.sector === "object"
              ? { _id: s.sector._id, name: s.sector.name }
              : null,
          )
          .filter(Boolean)
      : [];
    // Add termsCount property and remove terms
    pubObj.termsCount = Array.isArray(publication.terms)
      ? publication.terms.length
      : 0;
    delete pubObj.terms;
    res.json(pubObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const updateData = { ...req.body };
    // If sectors are being updated, merge old and new sectors and remove sectors not in payload
    if (Array.isArray(updateData.sectors)) {
      const publicationOld = await Publication.findById(req.params.id);
      if (publicationOld && Array.isArray(publicationOld.sectors)) {
        const oldSectors = publicationOld.sectors;
        const oldSectorIds = oldSectors.map((s) => s.sector.toString());
        const newSectorIds = updateData.sectors.map((s) =>
          s.sector && s.sector.toString ? s.sector.toString() : s.sector,
        );

        // Remove old sectors not present in new payload
        const keptOldSectors = oldSectors.filter((s) =>
          newSectorIds.includes(s.sector.toString()),
        );

        // Find new sectors not present in old
        const newSectorObjs = updateData.sectors.filter((s) => {
          const sectorId =
            s.sector && s.sector.toString ? s.sector.toString() : s.sector;
          return !oldSectorIds.includes(sectorId);
        });

        // Initialize termsCompliance for new sectors
        const publicationTermIds = Array.isArray(publicationOld.terms)
          ? publicationOld.terms.map((t) => t.toString())
          : [];
        for (let sectorObj of newSectorObjs) {
          sectorObj.termsCompliance = [];
          for (let termId of publicationTermIds) {
            sectorObj.termsCompliance.push({
              term: termId,
              complianceStatus: "neutral",
            });
          }
        }
        // Merge kept old sectors and new sectors (with termsCompliance)
        updateData.sectors = [...keptOldSectors, ...newSectorObjs];
      }
    }

    // Prevent reviewState update from this route
    if (Object.prototype.hasOwnProperty.call(updateData, "reviewState")) {
      return res
        .status(400)
        .json({ error: "Cannot update reviewState from this route" });
    }
    // Add classification if provided
    if (req.body.classification) {
      updateData.classification = req.body.classification;
    }

    if (req.userId) {
      updateData.updatedBy = req.userId;
    }

    const publication = await Publication.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    ).populate("sectors.sector");
    if (!publication) return res.status(404).json({ error: "Not found" });
    res.json({
      success: true,
      message: "Publication updated successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update evidence for a sector in a publication.
// Allowed only if the sector's complianceRate is 100%.
exports.updateSectorEvidence = async (req, res) => {
  try {
    const { publicationId, sectorId } = req.params;
    const { evidence } = req.body;

    if (typeof evidence !== "string") {
      return res.status(400).json({
        success: false,
        message: "evidence must be a string.",
      });
    }

    const publication = await Publication.findById(publicationId);
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found." });
    }

    // Find sector by array entry _id (sector entry id)
    const sectorEntry = Array.isArray(publication.sectors)
      ? publication.sectors.find((s) => s && String(s._id) === String(sectorId))
      : undefined;
    if (!sectorEntry) {
      return res
        .status(404)
        .json({ success: false, message: "Sector not found in publication." });
    }

    // Compute complianceRate from termsCompliance to avoid stale stored values.
    const publicationTermIds = Array.isArray(publication.terms)
      ? publication.terms.map((t) => t.toString())
      : [];
    const totalTerms = publicationTermIds.length;
    const compliedCount = Array.isArray(sectorEntry.termsCompliance)
      ? sectorEntry.termsCompliance.filter(
          (tc) =>
            tc?.term &&
            publicationTermIds.includes(tc.term.toString()) &&
            tc.complianceStatus === "complied",
        ).length
      : 0;
    const computedComplianceRate =
      totalTerms > 0 ? Math.round((compliedCount / totalTerms) * 100) : 0;

    if (computedComplianceRate !== 100) {
      return res.status(400).json({
        success: false,
        message:
          "Evidence can only be updated when the sector complianceRate is 100%.",
      });
    }

    sectorEntry.evidence = evidence;
    if (req.userId) {
      publication.updatedBy = req.userId;
    }

    await publication.save();
    await publication.populate("sectors.sector");

    return res.json({
      success: true,
      message: "Sector evidence updated successfully.",
      data: publication,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// NEW: Delete evidence for a sector in a publication.
exports.deleteSectorEvidence = async (req, res) => {
  try {
    const { publicationId, sectorId } = req.params;

    const publication = await Publication.findById(publicationId);
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found." });
    }

    // Find sector by array entry _id (sector entry id)
    const sectorEntry = Array.isArray(publication.sectors)
      ? publication.sectors.find((s) => s && String(s._id) === String(sectorId))
      : undefined;
    if (!sectorEntry) {
      return res
        .status(404)
        .json({ success: false, message: "Sector not found in publication." });
    }

    sectorEntry.evidence = undefined;
    if (req.userId) {
      publication.updatedBy = req.userId;
    }

    await publication.save();
    await publication.populate("sectors.sector");

    return res.json({
      success: true,
      message: "Sector evidence deleted successfully.",
      data: publication,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update reviewState with unique permission and logic
exports.updateReviewState = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewState, message } = req.body; // <-- add message
    const allowedStates = ["pending_review", "does_not_need_review"];
    if (!allowedStates.includes(reviewState)) {
      return res.status(400).json({
        error:
          "reviewState can only be set to pending_review or does_not_need_review",
      });
    }
    const publication = await Publication.findById(id);
    if (!publication) {
      return res.status(404).json({ error: "Publication not found" });
    }
    if (publication.reviewState === "reviewed") {
      return res.status(400).json({
        error: "Cannot update reviewState when it is already reviewed",
      });
    }
    publication.reviewState = reviewState;
    if (typeof message === "string") {
      publication.reviewMessage = message; // <-- set reviewMessage if provided
    }
    publication.updatedBy = req.userId || publication.updatedBy;
    await publication.save();
    res.json({
      success: true,
      message: "Review state updated successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const publication = await Publication.findByIdAndDelete(req.params.id);
    if (!publication) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update isComplied for a specific sector in a publication
exports.updateSectorCompliance = async (req, res) => {
  try {
    const { publicationId, sectorId } = req.params;
    let { isComplied, isCompliedMessage } = req.body;
    const allowedStatuses = ["complied", "uncomplied", "neutral"];
    // Normalize empty string/null/undefined to "neutral"
    if (isComplied === null || isComplied === undefined || isComplied === "") {
      isComplied = "neutral";
    }
    if (!allowedStatuses.includes(isComplied)) {
      return res.status(400).json({
        error: "isComplied must be one of: complied, uncomplied, or neutral",
      });
    }
    const publication = await Publication.findById(publicationId);
    if (!publication)
      return res.status(404).json({ error: "Publication not found" });
    // Find sector by array entry _id (sector entry id)
    const sectorEntry = Array.isArray(publication.sectors)
      ? publication.sectors.find((s) => s && String(s._id) === String(sectorId))
      : undefined;
    if (!sectorEntry)
      return res.status(404).json({ error: "Sector not found in publication" });
    sectorEntry.isComplied = isComplied;
    if (typeof isCompliedMessage === "string") {
      sectorEntry.isCompliedMessage = isCompliedMessage;
    }
    await publication.save();
    await publication.populate("sectors.sector");
    res.json({
      success: true,
      message: "Sector compliance updated successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Helper to recalculate complianceRate for a sector
function recalculateSectorComplianceRate(publication, sectorEntry) {
  const publicationTermIds = Array.isArray(publication.terms)
    ? publication.terms.map((t) => t.toString())
    : [];
  const termsCompliance = Array.isArray(sectorEntry.termsCompliance)
    ? sectorEntry.termsCompliance.filter(
        (tc) => tc.term && publicationTermIds.includes(tc.term.toString()),
      )
    : [];
  const totalTerms = publicationTermIds.length;
  const compliedCount = termsCompliance.filter(
    (tc) => tc.complianceStatus === "complied",
  ).length;
  sectorEntry.complianceRate =
    totalTerms > 0 ? Math.round((compliedCount / totalTerms) * 100) : 0;
}

// Get paginated/filterable sectors for a publication
exports.getPublicationSectors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "name",
      order = "asc",
      search,
      type,
      isComplied, // <-- add isComplied to query params
      complianceRateStatus, // <-- new: "complied", "partially_complied", "not_complied"
    } = req.query;
    const { id } = req.params;
    const publication = await Publication.findById(id)
      .populate("sectors.sector")
      .lean();

    // Do not populate terms of sectors; only fetch sectors as stored in publication
    if (!publication)
      return res.status(404).json({ error: "Publication not found" });
    let sectorsArr = publication.sectors || [];
    // Filter by type
    if (type) {
      sectorsArr = sectorsArr.filter((s) => s.sector && s.sector.type === type);
    }
    // Filter by search (name)
    if (search) {
      const regex = new RegExp(search, "i");
      sectorsArr = sectorsArr.filter(
        (s) => s.sector && regex.test(s.sector.name),
      );
    }
    // Filter by isComplied
    if (typeof isComplied !== "undefined") {
      sectorsArr = sectorsArr.filter(
        (s) => String(s.isComplied) === String(isComplied),
      );
    }

    // --- Compliance Rate Calculation and Filtering ---
    // Calculate complianceRate for each sector if not present
    // Do not recalculate complianceRate, just use the value as stored in each sector

    // Filter by complianceRateStatus if provided
    if (complianceRateStatus) {
      if (complianceRateStatus === "complied") {
        sectorsArr = sectorsArr.filter((s) => s.complianceRate === 100);
      } else if (complianceRateStatus === "partially_complied") {
        sectorsArr = sectorsArr.filter(
          (s) => s.complianceRate > 0 && s.complianceRate < 100,
        );
      } else if (complianceRateStatus === "not_complied") {
        sectorsArr = sectorsArr.filter((s) => s.complianceRate === 0);
      }
    }
    // --- End Compliance Rate Filtering ---

    // Sort
    sectorsArr = sectorsArr.sort((a, b) => {
      if (!a.sector || !b.sector) return 0;
      const aVal = a.sector[sort] || "";
      const bVal = b.sector[sort] || "";
      if (aVal < bVal) return order === "asc" ? -1 : 1;
      if (aVal > bVal) return order === "asc" ? 1 : -1;
      return 0;
    });

    // Pagination
    const total = sectorsArr.length;
    const totalPages = Math.ceil(total / limit);
    const paged = sectorsArr.slice((page - 1) * limit, page * limit);

    // --- Add deadline to each sector in the response and remove termsCompliance ---
    const pagedWithDeadline = paged.map((s) => {
      const { termsCompliance, ...rest } = s;
      return {
        ...rest,
        entryId: s.entryId || null, // expose entryId to clients
        deadline: s.deadline || null,
      };
    });

    res.json({
      data: pagedWithDeadline,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Update advisorReview of a publication (legal advisor only)
exports.updateAdvisorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { advisorReview, reviewMessage } = req.body;
    const allowedStatuses = ["neutral", "related", "unrelated"];
    if (!allowedStatuses.includes(advisorReview)) {
      return res.status(400).json({
        error: "advisorReview must be one of: neutral, related, or unrelated",
      });
    }
    // Only allow update if reviewState is 'pending_review'
    const publication = await Publication.findById(id);
    if (!publication)
      return res.status(404).json({ error: "Publication not found" });
    if (publication.reviewState !== "pending_review") {
      return res.status(400).json({
        error:
          "Advisor review can only be updated when reviewState is 'pending_review'",
      });
    }
    publication.advisorReview = advisorReview;
    publication.reviewMessage =
      typeof reviewMessage === "string" ? reviewMessage : undefined;
    publication.reviewState = "reviewed";
    publication.reviewedBy = req.userId || publication.reviewedBy;
    await publication.save();
    res.json({
      success: true,
      message: "Advisor review updated successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get publications that need legal advisor review
exports.getNeedsReview = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "date",
      order = "desc",
      category,
      sector,
      fromDate,
      toDate,
      search,
      classification, // <-- add classification filter
    } = req.query;
    const filter = { reviewState: "pending_review" };
    if (category) filter.category = category;
    if (sector) filter["sectors.sector"] = sector;
    if (classification) filter.classification = classification; // <-- filter by classification
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { relatedInfo: { $regex: search, $options: "i" } },
      ];
    }
    const sortObj = {};
    sortObj[sort] = order === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;
    const [publications, total] = await Promise.all([
      Publication.find(filter)
        // .populate("sectors.sector") // do not populate sectors here
        // .populate("terms") // do not populate terms here
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit)),
      Publication.countDocuments(filter),
    ]);
    // Remove terms and sectors from each publication object and add counts
    const publicationsWithCounts = publications.map((pub) => {
      const pubObj = pub.toObject();
      pubObj.termsCount = Array.isArray(pubObj.terms) ? pubObj.terms.length : 0;
      pubObj.sectorsCount = Array.isArray(pubObj.sectors)
        ? pubObj.sectors.length
        : 0;
      delete pubObj.terms;
      delete pubObj.sectors;
      return pubObj;
    });
    const totalPages = Math.ceil(total / limit);
    res.json({
      data: publicationsWithCounts,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update compliance for a term within a sector in a publication
exports.updateSectorTermCompliance = async (req, res) => {
  try {
    const { publicationId, sectorId } = req.params;
    const { termId, complianceStatus, isCompliedMessage, deadline } = req.body;
    if (!termId || !complianceStatus) {
      return res.status(400).json({
        success: false,
        message: "termId and complianceStatus are required.",
      });
    }
    if (!["complied", "uncomplied", "neutral"].includes(complianceStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "complianceStatus must be one of: complied, uncomplied, neutral.",
      });
    }
    const publication = await Publication.findById(publicationId);
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found." });
    }
    // Find sector by array entry _id (sector entry id)
    const sectorEntry = Array.isArray(publication.sectors)
      ? publication.sectors.find((s) => s && String(s._id) === String(sectorId))
      : undefined;
    if (!sectorEntry) {
      return res
        .status(404)
        .json({ success: false, message: "Sector not found in publication." });
    }
    // Find or add the term compliance entry
    let tc = sectorEntry.termsCompliance.find(
      (t) => t.term.toString() === termId,
    );
    if (tc) {
      tc.complianceStatus = complianceStatus;
      if (isCompliedMessage !== undefined)
        tc.isCompliedMessage = isCompliedMessage;
      if (deadline !== undefined) tc.deadline = deadline;
    } else {
      sectorEntry.termsCompliance.push({
        term: termId,
        complianceStatus,
        isCompliedMessage,
        deadline,
      });
    }
    // Recalculate compliance rate for this sector only
    recalculateSectorComplianceRate(publication, sectorEntry);
    await publication.save();
    await publication.populate("sectors.sector");
    res.json({
      success: true,
      message: "Sector term compliance updated successfully.",
      data: publication,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getSectorComplianceTerms = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      complianceRateStatus, // "complied", "partially_complied", "not_complied"
    } = req.query;
    const { publicationId, sectorId } = req.params;

    // Fetch publication with terms populated (for search/category filter)
    const publication = await Publication.findById(publicationId)
      .populate({
        path: "terms",
        select: "_id title category",
      })
      .lean();
    if (!publication)
      return res.status(404).json({ error: "Publication not found" });

    // Find the sector entry by _id
    const sectorEntry = Array.isArray(publication.sectors)
      ? publication.sectors.find((s) => s && String(s._id) === String(sectorId))
      : undefined;
    if (!sectorEntry)
      return res.status(404).json({ error: "Sector not found in publication" });

    // Build a map of termId -> term for fast lookup
    const termMap = {};
    if (Array.isArray(publication.terms)) {
      for (const t of publication.terms) {
        termMap[String(t._id)] = t;
      }
    }

    // Prepare termsCompliance array with term info
    let termsComplianceArr = Array.isArray(sectorEntry.termsCompliance)
      ? sectorEntry.termsCompliance.map((tc) => {
          const term = termMap[String(tc.term)] || {};
          return {
            ...tc,
            term: tc.term,
            termName: term.title || "",
            termCategory: term.category || "",
          };
        })
      : [];

    // Filter by search (on term name)
    if (search) {
      const regex = new RegExp(search, "i");
      termsComplianceArr = termsComplianceArr.filter((tc) =>
        regex.test(tc.termName),
      );
    }

    // Filter by category
    if (category) {
      termsComplianceArr = termsComplianceArr.filter(
        (tc) => String(tc.termCategory) === String(category),
      );
    }

    // Filter by complianceRateStatus
    if (complianceRateStatus) {
      if (complianceRateStatus === "complied") {
        termsComplianceArr = termsComplianceArr.filter(
          (tc) => tc.complianceStatus === "complied",
        );
      } else if (complianceRateStatus === "partially_complied") {
        termsComplianceArr = termsComplianceArr.filter(
          (tc) => tc.complianceStatus === "neutral",
        );
      } else if (complianceRateStatus === "not_complied") {
        termsComplianceArr = termsComplianceArr.filter(
          (tc) => tc.complianceStatus === "uncomplied",
        );
      }
    }

    // Pagination
    const total = termsComplianceArr.length;
    const totalPages = Math.ceil(total / limit);
    const paged = termsComplianceArr.slice((page - 1) * limit, page * limit);

    res.json({
      data: paged,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.recalculateSectorComplianceRate = recalculateSectorComplianceRate; // Export for use in publicationTermController
