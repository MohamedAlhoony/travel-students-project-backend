const Sector = require("../models/Sector");

exports.create = async (req, res) => {
  try {
    // Validate type field
    const allowedTypes = [
      "Department",
      "Administration",
      "Sector",
      "Center",
      "Office",
      "Other",
    ];
    if (!req.body.type || !allowedTypes.includes(req.body.type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing sector type. Allowed values: ${allowedTypes.join(", ")}`,
      });
    }
    const sector = await Sector.create({
      ...req.body,
      createdBy: req.userId ? req.userId : undefined,
    });
    // If parent is provided, add this sector to parent's children
    if (sector.parent) {
      await Sector.findByIdAndUpdate(sector.parent, {
        $push: { children: sector._id },
      });
    }
    res.status(201).json({
      success: true,
      message: "Sector created successfully.",
      data: sector,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to create sector.",
      error: err.message,
    });
  }
};

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "name",
      parent,
      search,
      direction = "asc",
      type,
      withChildren,
      id,
    } = req.query;
    const filter = {};
    if (id) {
      filter._id = id;
    } else {
      if (parent) filter.parent = parent;
      if (search) {
        filter.name = { $regex: search, $options: "i" };
      }
      if (type) {
        filter.type = type;
      }
    }
    const skip = (page - 1) * limit;
    const sortDirection = direction === "desc" ? -1 : 1;
    const sortObj = {};
    // Only add to sortObj if not sorting by childrenCount
    if (sort !== "childrenCount") {
      sortObj[sort] = sortDirection;
    }

    // Fetch sectors (no children population)
    const [sectors, total] = await Promise.all([
      Sector.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .populate("parent"), // <-- populate parent sector
      Sector.countDocuments(filter),
    ]);

    // Get children counts for all sectors in one query
    const sectorIds = sectors.map((s) => s._id);
    const childrenCounts = await Sector.aggregate([
      { $match: { parent: { $in: sectorIds } } },
      { $group: { _id: "$parent", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    childrenCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    // Add only childrenCount property, do not include children array
    let sectorsWithChildrenCount = sectors.map((sector) => {
      const obj = sector.toObject();
      obj.childrenCount = countMap[sector._id.toString()] || 0;
      delete obj.children;
      return obj;
    });

    // Filter for only sectors with children if requested
    if (withChildren === "true") {
      sectorsWithChildrenCount = sectorsWithChildrenCount.filter(
        (s) => s.childrenCount > 0,
      );
    }

    // Sort by childrenCount if requested
    if (sort === "childrenCount") {
      sectorsWithChildrenCount = sectorsWithChildrenCount.sort((a, b) => {
        if (sortDirection === 1) {
          return a.childrenCount - b.childrenCount;
        } else {
          return b.childrenCount - a.childrenCount;
        }
      });
    }

    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      message: "Sectors fetched successfully.",
      data: sectorsWithChildrenCount,
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch sectors.",
      error: err.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const sector = await Sector.findById(req.params.id)
      .populate("children")
      .populate("parent")
      .populate({ path: "createdBy", select: "username email _id" }) // Only return name and _id
      .populate({ path: "updatedBy", select: "username email _id" }); // Only return name and _id
    if (!sector) {
      return res.status(404).json({
        success: false,
        message: "Sector not found.",
      });
    }
    res.json({
      success: true,
      message: "Sector fetched successfully.",
      data: sector,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch sector.",
      error: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    // Validate type field if present
    const allowedTypes = [
      "Department",
      "Administration",
      "Sector",
      "Center",
      "Office",
      "Other",
    ];
    if (req.body.type && !allowedTypes.includes(req.body.type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sector type. Allowed values: ${allowedTypes.join(", ")}`,
      });
    }
    const updateData = { ...req.body };
    if (req.userId) {
      updateData.updatedBy = req.userId;
    }
    const sector = await Sector.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!sector) {
      return res.status(404).json({
        success: false,
        message: "Sector not found.",
      });
    }
    res.json({
      success: true,
      message: "Sector updated successfully.",
      data: sector,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to update sector.",
      error: err.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const sector = await Sector.findById(req.params.id);
    if (!sector)
      return res.status(404).json({
        success: false,
        message: "Sector not found.",
      });

    // Prevent deletion if sector has children
    if (sector.children && sector.children.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete sector with children. Remove or reassign its children first.",
      });
    }

    await Sector.findByIdAndDelete(req.params.id);

    // Remove from parent's children array
    if (sector.parent) {
      await Sector.findByIdAndUpdate(sector.parent, {
        $pull: { children: sector._id },
      });
    }
    res.json({
      success: true,
      message: "Sector deleted successfully.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete sector.",
      error: err.message,
    });
  }
};
