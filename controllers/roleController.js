const Role = require("../models/Role");
const User = require("../models/User");

exports.create = async (req, res) => {
  try {
    // Check if role name already exists
    const existingRole = await Role.findOne({ name: req.body.name });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role name is already in use.",
      });
    }
    const role = await Role.create(req.body);
    res.status(201).json({
      success: true,
      message: "Role created successfully.",
      data: role,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to create role.",
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
      direction = "asc",
    } = req.query;
    const skip = (page - 1) * limit;
    // Determine sort direction
    const sortDirection = direction === "desc" ? -1 : 1;
    const sortObj = {};
    sortObj[sort] = sortDirection;

    const [roles, total] = await Promise.all([
      Role.find()
        .populate("permissions")
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit)),
      Role.countDocuments(),
    ]);
    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      message: "Roles fetched successfully.",
      data: roles,
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
      message: "Failed to fetch roles.",
      error: err.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate("permissions");
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }
    res.json({
      success: true,
      message: "Role fetched successfully.",
      data: role,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch role.",
      error: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }
    res.json({
      success: true,
      message: "Role updated successfully.",
      data: role,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to update role.",
      error: err.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    // Check if any user is assigned to this role
    const usersWithRole = await User.find({ roles: req.params.id }).limit(1);
    if (usersWithRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete role: it is assigned to one or more users.",
      });
    }
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }
    res.json({
      success: true,
      message: "Role deleted successfully.",
      data: role,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete role.",
      error: err.message,
    });
  }
};
