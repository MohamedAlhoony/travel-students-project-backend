// Get a single term by id for a publication
exports.getPublicationTermById = async (req, res) => {
  try {
    const { publicationId, termId } = req.params;
    if (!isValidObjectId(publicationId) || !isValidObjectId(termId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid publicationId or termId" });
    }
    const publication =
      await Publication.findById(publicationId).select("terms");
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found" });
    }
    if (!publication.terms.includes(termId)) {
      return res.status(404).json({
        success: false,
        message: "Term not found in this publication",
      });
    }
    const term = await Term.findById(termId);
    if (!term) {
      return res
        .status(404)
        .json({ success: false, message: "Term not found" });
    }
    return res.json({ success: true, data: term });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
// Import the compliance rate helper from publicationController
const { recalculateSectorComplianceRate } = require("./publicationController");
// Fetch terms of a publication with pagination, search, and category filter
exports.getPublicationTerms = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const { page = 1, limit = 10, search, category } = req.query;
    if (!isValidObjectId(publicationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid publicationId" });
    }
    const publication =
      await Publication.findById(publicationId).select("terms");
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found" });
    }
    let filter = { _id: { $in: publication.terms } };
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }
    if (category) {
      filter.category = category;
    }
    const skip = (page - 1) * limit;
    const [terms, total] = await Promise.all([
      Term.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Term.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit);
    res.json({
      data: terms,
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
const mongoose = require("mongoose");

const Publication = require("../models/Publication");
const Term = require("../models/Term");

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value));
}

exports.addTermToPublication = async (req, res) => {
  try {
    const { publicationId } = req.params;

    if (!isValidObjectId(publicationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid publicationId" });
    }

    const { title, category, description } = req.body || {};
    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return res
        .status(400)
        .json({ success: false, message: "title is required" });
    }
    if (!category || typeof category !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "category is required" });
    }

    const publication = await Publication.findById(publicationId);
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found" });
    }

    const term = await Term.create({
      title: title.trim(),
      category,
      description,
      createdBy: req.userId || undefined,
    });

    if (!Array.isArray(publication.terms)) publication.terms = [];
    publication.terms.push(term._id);

    if (req.userId) {
      publication.updatedBy = req.userId;
    }

    // Recalculate complianceRate for all sectors
    if (Array.isArray(publication.sectors)) {
      for (const sectorEntry of publication.sectors) {
        // Add new term to termsCompliance for this sector
        if (!Array.isArray(sectorEntry.termsCompliance)) {
          sectorEntry.termsCompliance = [];
        }
        // Only add if not already present
        const exists = sectorEntry.termsCompliance.some(
          (tc) => tc.term && tc.term.toString() === term._id.toString(),
        );
        if (!exists) {
          sectorEntry.termsCompliance.push({
            term: term._id,
            complianceStatus: "neutral",
            isCompliedMessage: "",
          });
        }
        recalculateSectorComplianceRate(publication, sectorEntry);
      }
    }
    await publication.save();
    await publication.populate(["terms", "sectors.sector"]);
    return res.status(201).json({
      success: true,
      message: "Term added to publication successfully.",
      data: {
        term,
        publication,
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to add term to publication.",
      error: err.message,
    });
  }
};

exports.updatePublicationTerm = async (req, res) => {
  try {
    const { publicationId, termId } = req.params;

    if (!isValidObjectId(publicationId) || !isValidObjectId(termId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid publicationId or termId" });
    }

    const publication =
      await Publication.findById(publicationId).select("terms");
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found" });
    }

    const linked = Array.isArray(publication.terms)
      ? publication.terms.some((t) => String(t) === String(termId))
      : false;

    if (!linked) {
      return res.status(404).json({
        success: false,
        message: "Term not found in this publication.",
      });
    }

    const update = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
      if (
        typeof req.body.title !== "string" ||
        req.body.title.trim().length < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "title must be a non-empty string",
        });
      }
      update.title = req.body.title.trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "category")) {
      if (
        typeof req.body.category !== "string" ||
        req.body.category.trim().length < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "category must be a non-empty string",
        });
      }
      update.category = req.body.category;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
      update.description = req.body.description;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid fields to update. Provide title/category/description.",
      });
    }

    if (req.userId) {
      update.updatedBy = req.userId;
    }

    const term = await Term.findByIdAndUpdate(termId, update, { new: true });
    if (!term) {
      return res
        .status(404)
        .json({ success: false, message: "Term not found" });
    }

    return res.json({
      success: true,
      message: "Term updated successfully.",
      data: term,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to update term.",
      error: err.message,
    });
  }
};

exports.deletePublicationTerm = async (req, res) => {
  try {
    const { publicationId, termId } = req.params;

    if (!isValidObjectId(publicationId) || !isValidObjectId(termId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid publicationId or termId" });
    }

    const publication = await Publication.findById(publicationId);
    if (!publication) {
      return res
        .status(404)
        .json({ success: false, message: "Publication not found" });
    }

    const beforeCount = Array.isArray(publication.terms)
      ? publication.terms.length
      : 0;
    publication.terms = (
      Array.isArray(publication.terms) ? publication.terms : []
    ).filter((t) => String(t) !== String(termId));

    if (publication.terms.length === beforeCount) {
      return res.status(404).json({
        success: false,
        message: "Term not found in this publication.",
      });
    }

    if (req.userId) {
      publication.updatedBy = req.userId;
    }

    // Recalculate complianceRate for all sectors
    if (Array.isArray(publication.sectors)) {
      for (const sectorEntry of publication.sectors) {
        // Remove term from termsCompliance for this sector
        if (Array.isArray(sectorEntry.termsCompliance)) {
          sectorEntry.termsCompliance = sectorEntry.termsCompliance.filter(
            (tc) => tc.term && tc.term.toString() !== termId,
          );
        }
        recalculateSectorComplianceRate(publication, sectorEntry);
      }
    }
    await publication.save();
    await Term.findByIdAndDelete(termId);
    await publication.populate(["terms", "sectors.sector"]);
    return res.json({
      success: true,
      message: "Term removed from publication successfully.",
      data: publication,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to delete term.",
      error: err.message,
    });
  }
};
