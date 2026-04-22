const mongoose = require("mongoose");
const Sector = require("../models/Sector");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return defaultValue;
}

function toObjectId(value) {
  if (!value) return null;
  if (mongoose.Types.ObjectId.isValid(value))
    return new mongoose.Types.ObjectId(value);
  return null;
}

function toValidDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isMidnightUTC(d) {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function isDateOnlyString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function endOfDayUTC(d) {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

exports.getSectorsPublicationsComplianceReport = async (req, res) => {
  try {
    const now = new Date();

    const {
      // sector filters
      sectorId,
      parent,
      type,
      search,

      // publication filters
      fromDate,
      toDate,
      classification,
      reviewState,

      // options
      includePublications = "true",
      includeTerms = "false",
      pubLimit,

      // paging/sort
      page = 1,
      limit = 50,
      sort = "name",
      direction = "asc",
    } = req.query;

    const includePublicationsBool = parseBool(includePublications, true);
    const includeTermsBool = parseBool(includeTerms, false);

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const skipNum = (pageNum - 1) * limitNum;

    const pubLimitRaw = pubLimit ? Math.max(parseInt(pubLimit, 10) || 0, 0) : 0;
    const pubLimitNum = Math.min(pubLimitRaw, 500); // cap

    const sectorMatch = {};
    const sectorObjectId = toObjectId(sectorId);
    if (sectorObjectId) {
      sectorMatch._id = sectorObjectId;
    } else {
      const parentObjectId = toObjectId(parent);
      if (parentObjectId) sectorMatch.parent = parentObjectId;
      else if (
        typeof parent === "string" &&
        ["null", "none", "root"].includes(parent.trim().toLowerCase())
      ) {
        sectorMatch.parent = null;
      }
      if (type) sectorMatch.type = type;
      if (search)
        sectorMatch.name = {
          $regex: escapeRegex(String(search)),
          $options: "i",
        };
    }

    const publicationMatch = {};
    if (classification) publicationMatch.classification = classification;
    if (reviewState) publicationMatch.reviewState = reviewState;

    const fromD = toValidDateOrNull(fromDate);
    let toD = toValidDateOrNull(toDate);
    // If UI sends a date-only value (or midnight timestamp), treat toDate as inclusive end-of-day.
    if (toD && (isDateOnlyString(toDate) || isMidnightUTC(toD))) {
      toD = endOfDayUTC(toD);
    }
    if (fromD || toD) {
      publicationMatch.date = {};
      if (fromD) publicationMatch.date.$gte = fromD;
      if (toD) publicationMatch.date.$lte = toD;
    }

    const lookupPipeline = [];

    // only publications that contain this sector
    lookupPipeline.push({
      $match: {
        $expr: { $in: ["$$sectorId", "$sectors.sector"] },
      },
    });

    // publication filters
    if (Object.keys(publicationMatch).length > 0) {
      lookupPipeline.push({ $match: publicationMatch });
    }

    // keep deterministic order (newest first)
    lookupPipeline.push({ $sort: { date: -1, _id: -1 } });

    // pull the sector entry for this publication
    lookupPipeline.push({
      $addFields: {
        _sectorEntry: {
          $first: {
            $filter: {
              input: "$sectors",
              as: "s",
              cond: { $eq: ["$$s.sector", "$$sectorId"] },
            },
          },
        },
      },
    });

    // terms counts + effective compliance
    lookupPipeline.push({
      $addFields: {
        totalTerms: { $size: { $ifNull: ["$terms", []] } },
        compliedTerms: {
          $size: {
            $filter: {
              input: { $ifNull: ["$_sectorEntry.termsCompliance", []] },
              as: "tc",
              cond: { $eq: ["$$tc.complianceStatus", "complied"] },
            },
          },
        },
        uncompliedTerms: {
          $size: {
            $filter: {
              input: { $ifNull: ["$_sectorEntry.termsCompliance", []] },
              as: "tc",
              cond: { $eq: ["$$tc.complianceStatus", "uncomplied"] },
            },
          },
        },
        neutralTerms: {
          $size: {
            $filter: {
              input: { $ifNull: ["$_sectorEntry.termsCompliance", []] },
              as: "tc",
              cond: { $eq: ["$$tc.complianceStatus", "neutral"] },
            },
          },
        },

        hasEvidence: {
          $cond: [
            { $eq: [{ $type: "$_sectorEntry.evidence" }, "string"] },
            {
              $gt: [
                {
                  $strLenCP: {
                    $trim: {
                      input: "$_sectorEntry.evidence",
                    },
                  },
                },
                0,
              ],
            },
            false,
          ],
        },

        // total number of sectors linked to this publication (used for global KPI)
        relatedSectorsCount: { $size: { $ifNull: ["$sectors", []] } },
      },
    });

    lookupPipeline.push({
      $addFields: {
        deadline: "$_sectorEntry.deadline",
        effectiveComplianceRate: {
          $cond: [
            { $gt: [{ $ifNull: ["$_sectorEntry.complianceRate", -1] }, -1] },
            { $ifNull: ["$_sectorEntry.complianceRate", 0] },
            {
              $cond: [
                { $gt: ["$totalTerms", 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$compliedTerms", "$totalTerms"] },
                        100,
                      ],
                    },
                    0,
                  ],
                },
                0,
              ],
            },
          ],
        },
      },
    });

    lookupPipeline.push({
      $addFields: {
        isOverdue: {
          $and: [
            // deadline must be present and a valid BSON date
            { $eq: [{ $type: "$deadline" }, "date"] },
            { $lt: ["$deadline", now] },
            { $lt: ["$effectiveComplianceRate", 100] },
          ],
        },
      },
    });

    if (includeTermsBool) {
      lookupPipeline.push({
        $lookup: {
          from: "terms",
          localField: "terms",
          foreignField: "_id",
          as: "_termDocs",
        },
      });

      // Enrich terms with the compliance info for THIS sector (from _sectorEntry.termsCompliance)
      lookupPipeline.push({
        $addFields: {
          terms: {
            $map: {
              input: { $ifNull: ["$_sectorEntry.termsCompliance", []] },
              as: "tc",
              in: {
                $let: {
                  vars: {
                    termDoc: {
                      $first: {
                        $filter: {
                          input: { $ifNull: ["$_termDocs", []] },
                          as: "td",
                          cond: { $eq: ["$$td._id", "$$tc.term"] },
                        },
                      },
                    },
                  },
                  in: {
                    $mergeObjects: [
                      { $ifNull: ["$$termDoc", {}] },
                      {
                        complianceStatus: "$$tc.complianceStatus",
                        isCompliedMessage: "$$tc.isCompliedMessage",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      });
    }

    // NOTE: keep this as an inclusion-only projection.
    const publicationProject = {
      _id: 1,
      title: 1,
      classification: 1,
      date: 1,
      description: 1,
      relatedInfo: 1,
      reviewState: 1,
      advisorReview: 1,
      reviewMessage: 1,
      link: 1,
      createdAt: 1,
      deadline: 1,
      totalTerms: 1,
      compliedTerms: 1,
      uncompliedTerms: 1,
      neutralTerms: 1,
      effectiveComplianceRate: 1,
      isOverdue: 1,
      hasEvidence: 1,
      relatedSectorsCount: 1,
    };
    if (includeTermsBool) publicationProject.terms = 1;

    lookupPipeline.push({ $project: publicationProject });

    const sortDirection = String(direction).toLowerCase() === "desc" ? -1 : 1;
    const allowedSort = new Set([
      "name",
      "type",
      "createdAt",
      "publicationsCount",
      "overallComplianceRate",
      "overduePublicationsCount",
    ]);

    const pipeline = [];
    pipeline.push({ $match: sectorMatch });

    // parent info (for reporting)
    pipeline.push({
      $lookup: {
        from: "sectors",
        localField: "parent",
        foreignField: "_id",
        as: "parent",
      },
    });
    pipeline.push({
      $addFields: {
        parent: { $first: "$parent" },
      },
    });

    pipeline.push({
      $lookup: {
        from: "publications",
        let: { sectorId: "$_id" },
        pipeline: lookupPipeline,
        as: "publications",
      },
    });

    pipeline.push({
      $addFields: {
        publicationsCount: { $size: { $ifNull: ["$publications", []] } },
        sectorTotalTerms: { $sum: "$publications.totalTerms" },
        sectorCompliedTerms: { $sum: "$publications.compliedTerms" },
        sectorUncompliedTerms: { $sum: "$publications.uncompliedTerms" },
        sectorNeutralTerms: { $sum: "$publications.neutralTerms" },
        overduePublicationsCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$publications", []] },
              as: "p",
              cond: { $eq: ["$$p.isOverdue", true] },
            },
          },
        },
        reviewStateCounts: {
          pending_review: {
            $size: {
              $filter: {
                input: { $ifNull: ["$publications", []] },
                as: "p",
                cond: { $eq: ["$$p.reviewState", "pending_review"] },
              },
            },
          },
          reviewed: {
            $size: {
              $filter: {
                input: { $ifNull: ["$publications", []] },
                as: "p",
                cond: { $eq: ["$$p.reviewState", "reviewed"] },
              },
            },
          },
          does_not_need_review: {
            $size: {
              $filter: {
                input: { $ifNull: ["$publications", []] },
                as: "p",
                cond: { $eq: ["$$p.reviewState", "does_not_need_review"] },
              },
            },
          },
        },
      },
    });

    // If any publication-level filters are applied, only return sectors that have
    // at least one publication matching those filters.
    if (
      Object.prototype.hasOwnProperty.call(
        publicationMatch,
        "classification",
      ) ||
      Object.prototype.hasOwnProperty.call(publicationMatch, "reviewState") ||
      Object.prototype.hasOwnProperty.call(publicationMatch, "date")
    ) {
      pipeline.push({ $match: { publicationsCount: { $gt: 0 } } });
    }

    pipeline.push({
      $addFields: {
        overallComplianceRate: {
          $cond: [
            { $gt: ["$sectorTotalTerms", 0] },
            {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$sectorCompliedTerms", "$sectorTotalTerms"] },
                    100,
                  ],
                },
                0,
              ],
            },
            null,
          ],
        },
      },
    });

    // Apply publication inclusion/slicing last
    // pipeline.push({
    //   $addFields: {
    //     publications: includePublicationsBool
    //       ? pubLimitNum > 0
    //         ? { $slice: ["$publications", pubLimitNum] }
    //         : "$publications"
    //       : [],
    //   },
    // });

    const finalSortField = allowedSort.has(sort) ? sort : "name";
    pipeline.push({ $sort: { [finalSortField]: sortDirection, _id: 1 } });

    pipeline.push({
      $facet: {
        data: [
          { $skip: skipNum },
          { $limit: limitNum },

          // ADD: apply publication inclusion/slicing ONLY for returned rows
          {
            $addFields: {
              publications: includePublicationsBool
                ? pubLimitNum > 0
                  ? { $slice: ["$publications", pubLimitNum] }
                  : "$publications"
                : [],
            },
          },
        ],

        // CHANGE: split KPI pipelines (no nested $facet)
        kpisSector: [
          {
            $group: {
              _id: null,
              sectors: { $sum: 1 },
              totalPubs: { $sum: { $ifNull: ["$publicationsCount", 0] } },
              totalEvidence: {
                $sum: {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$publications", []] },
                      as: "p",
                      cond: { $eq: ["$$p.hasEvidence", true] },
                    },
                  },
                },
              },
              totalTerms: { $sum: { $ifNull: ["$sectorTotalTerms", 0] } },
              compliedTerms: { $sum: { $ifNull: ["$sectorCompliedTerms", 0] } },
              uncompliedTerms: {
                $sum: { $ifNull: ["$sectorUncompliedTerms", 0] },
              },
              neutralTerms: { $sum: { $ifNull: ["$sectorNeutralTerms", 0] } },
              totalOverdue: {
                $sum: { $ifNull: ["$overduePublicationsCount", 0] },
              },
              avgRate: { $avg: "$overallComplianceRate" },

              // KPI: count sector compliance INSIDE publications (sector-publication relations)
              // Based on each publication's effectiveComplianceRate for this sector.
              sectorsCompliant100: {
                $sum: {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$publications", []] },
                      as: "p",
                      cond: { $eq: ["$$p.effectiveComplianceRate", 100] },
                    },
                  },
                },
              },
              sectorsNotCompliant100: {
                $sum: {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$publications", []] },
                      as: "p",
                      cond: { $lt: ["$$p.effectiveComplianceRate", 100] },
                    },
                  },
                },
              },

              // NEW: Not Available (overallComplianceRate is null)
              sectorsNotAvailable: {
                $sum: {
                  $cond: [{ $eq: ["$overallComplianceRate", null] }, 1, 0],
                },
              },

              // Excellent: >= 90 (includes previous Outstanding)
              sectorsExcellent: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$overallComplianceRate", null] },
                        { $gte: ["$overallComplianceRate", 90] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Very Good: [80, 90)
              sectorsVeryGood: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$overallComplianceRate", null] },
                        { $gte: ["$overallComplianceRate", 80] },
                        { $lt: ["$overallComplianceRate", 90] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Good: [70, 80)
              sectorsGood: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$overallComplianceRate", null] },
                        { $gte: ["$overallComplianceRate", 70] },
                        { $lt: ["$overallComplianceRate", 80] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Fair: [60, 70)
              sectorsFair: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$overallComplianceRate", null] },
                        { $gte: ["$overallComplianceRate", 60] },
                        { $lt: ["$overallComplianceRate", 70] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Poor: < 60 (includes previous Poor + Fail)
              sectorsPoor: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$overallComplianceRate", null] },
                        { $lt: ["$overallComplianceRate", 60] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              sectors: 1,
              totalPubs: 1,
              totalEvidence: 1,
              totalTerms: 1,
              compliedTerms: 1,
              uncompliedTerms: 1,
              neutralTerms: 1,
              totalOverdue: 1,
              avgRate: 1,

              sectorsCompliant100: 1,
              sectorsNotCompliant100: 1,

              // NEW
              sectorsNotAvailable: 1,

              // ...existing bucket projections...
              sectorsExcellent: 1,
              sectorsVeryGood: 1,
              sectorsGood: 1,
              sectorsFair: 1,
              sectorsPoor: 1,
            },
          },
        ],

        kpisPubs: [
          { $unwind: "$publications" },
          { $match: { "publications._id": { $ne: null } } },
          {
            // dedupe across sectors (same publication can appear in multiple sectors)
            $group: {
              _id: "$publications._id",
              reviewState: { $first: "$publications.reviewState" },
              relatedSectorsCount: {
                $first: { $ifNull: ["$publications.relatedSectorsCount", 0] },
              },
            },
          },
          {
            $group: {
              _id: null,
              publicationsPending: {
                $sum: {
                  $cond: [{ $eq: ["$reviewState", "pending_review"] }, 1, 0],
                },
              },
              publicationsReviewed: {
                $sum: { $cond: [{ $eq: ["$reviewState", "reviewed"] }, 1, 0] },
              },

              // total number of sector relationships across unique publications
              totalRelatedSectors: { $sum: "$relatedSectorsCount" },
            },
          },
          {
            $project: {
              _id: 0,
              publicationsPending: 1,
              publicationsReviewed: 1,
              totalRelatedSectors: 1,
            },
          },
        ],

        meta: [{ $count: "total" }],
      },
    });

    // Get the total number of publications in the database (not just those linked to sectors)
    const Publication = require("../models/Publication");
    const totalPubsDb = await Publication.countDocuments({});

    // Get the total number of unique terms in the database
    const Term = require("../models/Term");
    const totalTermsDb = await Term.countDocuments({});

    const result = await Sector.aggregate(pipeline);

    const data = result?.[0]?.data || [];
    const total = result?.[0]?.meta?.[0]?.total || 0;

    const kpisSector = result?.[0]?.kpisSector?.[0] || {};
    const kpisPubs = result?.[0]?.kpisPubs?.[0] || {};

    const kpis = {
      sectors: kpisSector.sectors ?? 0,
      totalPubs: totalPubsDb, // Use the total number of publications in the DB
      totalEvidence: kpisSector.totalEvidence ?? 0,
      totalTerms: totalTermsDb, // Use the total number of unique terms in the DB
      compliedTerms: kpisSector.compliedTerms ?? 0,
      uncompliedTerms: kpisSector.uncompliedTerms ?? 0,
      neutralTerms: kpisSector.neutralTerms ?? 0,
      totalOverdue: kpisSector.totalOverdue ?? 0,
      avgRate: kpisSector.avgRate ?? null,

      sectorsCompliant100: kpisSector.sectorsCompliant100 ?? 0,
      sectorsNotCompliant100: kpisSector.sectorsNotCompliant100 ?? 0,

      // NEW
      sectorsNotAvailable: kpisSector.sectorsNotAvailable ?? 0,

      // ...existing buckets...
      sectorsExcellent: kpisSector.sectorsExcellent ?? 0,
      sectorsVeryGood: kpisSector.sectorsVeryGood ?? 0,
      sectorsGood: kpisSector.sectorsGood ?? 0,
      sectorsFair: kpisSector.sectorsFair ?? 0,
      sectorsPoor: kpisSector.sectorsPoor ?? 0,

      publicationsPending: kpisPubs.publicationsPending ?? 0,
      publicationsReviewed: kpisPubs.publicationsReviewed ?? 0,
      totalRelatedSectors: kpisPubs.totalRelatedSectors ?? 0,
    };

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      success: true,
      message: "Sector publications compliance report generated successfully.",
      data,
      kpis,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        filters: {
          sectorId: sectorObjectId ? String(sectorObjectId) : undefined,
          parent,
          type,
          search,
          fromDate: fromD ? fromDate : undefined,
          toDate: toD ? toDate : undefined,
          classification,
          reviewState,
        },
        options: {
          includePublications: includePublicationsBool,
          includeTerms: includeTermsBool,
          pubLimit: pubLimitNum || undefined,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to generate sector publications compliance report.",
      error: err.message,
    });
  }
};
