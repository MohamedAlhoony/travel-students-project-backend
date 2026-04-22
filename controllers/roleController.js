const mongoose = require("mongoose");
const Role = require("../models/Role");

function fixedRolesMessage() {
  return "Roles are fixed enums (admin, client, customer) and cannot be created/updated/deleted.";
}

exports.create = async (req, res) => {
  res.status(405).json({
    success: false,
    message: fixedRolesMessage(),
  });
};

exports.getAll = async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    const total = roles.length;
    const totalPages = 1;
    res.json({
      success: true,
      message: "Roles fetched successfully.",
      data: roles,
      meta: {
        total,
        page: 1,
        limit: total,
        totalPages,
        hasNextPage: false,
        hasPrevPage: false,
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
    const id = String(req.params.id || "")
      .trim()
      .toLowerCase();
    const role = mongoose.isValidObjectId(id)
      ? await Role.findById(id)
      : await Role.findOne({ name: id });
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
  res.status(405).json({
    success: false,
    message: fixedRolesMessage(),
  });
};

exports.delete = async (req, res) => {
  res.status(405).json({
    success: false,
    message: fixedRolesMessage(),
  });
};
