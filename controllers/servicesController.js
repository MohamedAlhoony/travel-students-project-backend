const ProviderApplication = require("../models/ProviderApplication");

exports.listApprovedServices = async (req, res) => {
  try {
    const { serviceType, page = 1, limit = 20 } = req.query;
    const normalizedServiceType = serviceType
      ? String(serviceType).toLowerCase()
      : undefined;

    const matchStage = {
      status: ProviderApplication.Statuses.APPROVED,
      ...(normalizedServiceType ? { serviceType: normalizedServiceType } : {}),
    };

    const skip = (Number(page) - 1) * Number(limit);
    const lim = Number(limit);

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "applicantUserId",
          foreignField: "_id",
          as: "provider",
        },
      },
      { $unwind: "$provider" },
      { $match: { "provider.activated": true } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          meta: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: lim },
            {
              $project: {
                applicantUserId: "$provider",
                serviceType: 1,
                status: 1,
                submittedData: 1,
                adminDecision: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
            {
              $addFields: {
                "applicantUserId.passwordHash": "$$REMOVE",
              },
            },
          ],
        },
      },
    ];

    const result = await ProviderApplication.aggregate(pipeline);
    const meta = (result &&
      result[0] &&
      result[0].meta &&
      result[0].meta[0]) || {
      total: 0,
    };
    const apps = (result && result[0] && result[0].data) || [];
    const total = meta.total || 0;

    res.json({
      success: true,
      data: apps,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.max(1, Math.ceil(total / Number(limit))),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to list services.",
      error: err.message,
    });
  }
};
