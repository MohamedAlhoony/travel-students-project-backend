const Permission = require("../models/Permission");

exports.create = async (req, res) => {
  try {
    const permission = await Permission.create(req.body);
    res.status(201).json({
      success: true,
      message: "Permission created successfully.",
      data: permission,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to create permission.",
      error: err.message,
    });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "name" } = req.query;
    const skip = (page - 1) * limit;
    const [permissions, total] = await Promise.all([
      Permission.find().sort(sort).skip(skip).limit(Number(limit)),
      Permission.countDocuments(),
    ]);
    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      message: "Permissions fetched successfully.",
      data: permissions,
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
      message: "Failed to fetch permissions.",
      error: err.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found.",
      });
    }
    res.json({
      success: true,
      message: "Permission fetched successfully.",
      data: permission,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch permission.",
      error: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const permission = await Permission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found.",
      });
    }
    res.json({
      success: true,
      message: "Permission updated successfully.",
      data: permission,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to update permission.",
      error: err.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const permission = await Permission.findByIdAndDelete(req.params.id);
    if (!permission) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
