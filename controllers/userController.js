const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.create = async (req, res) => {
  try {
    // Check if username already exists
    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username is already in use.",
      });
    }
    // Check if email already exists (if provided)
    if (req.body.email) {
      const existingEmail = await User.findOne({ email: req.body.email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use.",
        });
      }
    }
    // Check if emailAppPassword is present, set canSendEmail to true
    if (req.body.emailAppPassword) {
      req.body.canSendEmail = true;
    }
    const user = await User.create(req.body);
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: userObj,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to create user.",
      error: err.message,
    });
  }
};
exports.updateUserActivation = async (req, res) => {
  try {
    const { activated } = req.body;
    if (typeof activated !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "'activated' must be a boolean.",
      });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { activated },
      { new: true },
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    const userObj = user.toObject();
    delete userObj.password;
    res.json({
      success: true,
      message: "User activation status updated successfully.",
      data: userObj,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update user activation status.",
      error: err.message,
    });
  }
};
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "username",
      search = "",
      direction = "asc",
    } = req.query;
    const query = {};
    if (search) {
      // Search by username or email (case-insensitive)
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    // Determine sort direction
    const sortDirection = direction === "desc" ? -1 : 1;
    const sortObj = {};
    sortObj[sort] = sortDirection;

    const users = await User.find(query)
      .populate("roles")
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const usersNoPassword = users.map((u) => {
      const obj = u.toObject();
      delete obj.password;
      return obj;
    });
    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      message: "Users fetched successfully.",
      data: usersNoPassword,
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
      message: "Failed to fetch users.",
      error: err.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("roles");
    if (!user) return res.status(404).json({ error: "Not found" });
    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // If emailAppPassword is present in update, set canSendEmail to true
    if (req.body.emailAppPassword) {
      req.body.canSendEmail = true;
    }
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    const userObj = user.toObject();
    delete userObj.password;
    res.json({
      success: true,
      message: "User updated successfully.",
      data: userObj,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Failed to update user.",
      error: err.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).populate("roles");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.activated === false) {
      return res
        .status(403)
        .json({ error: "Account is disabled. Please contact admin." });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" },
    );
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ message: "Login successful", token, user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.profile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "roles",
      populate: {
        path: "permissions",
        model: "Permission",
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.emailAppPassword; // Remove emailAppPassword

    // Collect all unique permissions from roles
    const permissionsMap = {};
    const permissionsArr = [];
    if (userObj.roles && Array.isArray(userObj.roles)) {
      userObj.roles.forEach((role) => {
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach((permission) => {
            const permId = permission._id
              ? permission._id.toString()
              : permission;
            if (!permissionsMap[permId]) {
              permissionsMap[permId] = true;
              permissionsArr.push(permission);
            }
          });
        }
      });
    }
    // Flatten permissions to array of names only
    userObj.permissions = permissionsArr
      .map((permission) => {
        if (permission && typeof permission.toObject === "function") {
          permission = permission.toObject();
        }
        return permission && permission.name ? permission.name : permission;
      })
      .filter(Boolean);

    // Remove permissions from inside each role, keep only name
    if (userObj.roles && Array.isArray(userObj.roles)) {
      userObj.roles = userObj.roles.map((role) => {
        if (role && typeof role.toObject === "function") {
          role = role.toObject();
        }
        return role && role.name ? { name: role.name } : role;
      });
    }

    // Ensure canSendEmail is present in the response
    userObj.canSendEmail = user.canSendEmail;

    res.json(userObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
