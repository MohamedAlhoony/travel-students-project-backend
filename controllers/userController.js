const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const BalanceTransaction = require("../models/BalanceTransaction");
const { Roles } = require("../constants/roles");
const { sendPushNotification } = require("../services/notificationService");
function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

async function ensureBalanceField(userId) {
  if (!mongoose.isValidObjectId(userId)) return;
  await User.updateOne(
    { _id: userId, balance: { $exists: false } },
    { $set: { balance: 0 } },
  );
}

function isAdmin(req) {
  const roles = req.user && Array.isArray(req.user.roles) ? req.user.roles : [];
  return roles.includes(Roles.ADMIN);
}

exports.create = async (req, res) => {
  try {
    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username is already in use.",
      });
    }
    if (req.body.email) {
      const existingEmail = await User.findOne({ email: req.body.email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use.",
        });
      }
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const roles =
      Array.isArray(req.body.roles) && req.body.roles.length
        ? req.body.roles.map((r) => String(r).toLowerCase())
        : [Roles.CUSTOMER];

    const user = await User.create({
      username: req.body.username,
      email: req.body.email,
      passwordHash,
      roles,
      activated:
        typeof req.body.activated === "boolean" ? req.body.activated : true,
    });
    const userObj = User.sanitize(user);
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

function normalizeRolesFilter(rawRoles) {
  if (rawRoles === undefined || rawRoles === null || rawRoles === "") {
    return [];
  }

  const values = Array.isArray(rawRoles)
    ? rawRoles
    : String(rawRoles).split(",");

  return values
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
}

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
    const userObj = User.sanitize(user);
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
      role,
      roles,
    } = req.query;
    const query = {};

    const roleValues = normalizeRolesFilter(roles !== undefined ? roles : role);
    if (roleValues.length === 1) {
      query.roles = roleValues[0];
    } else if (roleValues.length > 1) {
      query.roles = { $in: roleValues };
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const sortDirection = direction === "desc" ? -1 : 1;
    const sortObj = { [sort]: sortDirection };

    const users = await User.find(query)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const usersNoPassword = users.map((u) => User.sanitize(u));
    const totalPages = Math.max(1, Math.ceil(total / Number(limit)));
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
    const isSelf = req.userId === req.params.id;
    if (!isSelf && !isAdmin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(User.sanitize(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const isSelf = req.userId === req.params.id;
    if (!isSelf && !isAdmin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.email !== undefined) updates.email = req.body.email;

    // Only admins can change roles/activation
    if (isAdmin(req)) {
      if (req.body.roles !== undefined) {
        updates.roles = Array.isArray(req.body.roles)
          ? req.body.roles.map((r) => String(r).toLowerCase())
          : req.body.roles;
      }
      if (typeof req.body.activated === "boolean") {
        updates.activated = req.body.activated;
      }
    }

    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    const userObj = User.sanitize(user);
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
    const user = await User.findOne({ username });
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
    res.json({
      message: "Login successful",
      token,
      user: User.sanitize(user),
    });
    await sendPushNotification(
      "مرحبا بك في تطبيقنا",
      "نحن سعداء بوجودك معنا! استمتع بتجربتك.",
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Public: customer registration
exports.registerCustomer = async (req, res) => {
  try {
    const username = String(req.body.username).trim();
    const email = req.body.email
      ? String(req.body.email).trim().toLowerCase()
      : undefined;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username is already in use.",
      });
    }
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use.",
        });
      }
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash,
      roles: [Roles.CUSTOMER],
      activated: true,
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" },
    );

    res.status(201).json({
      success: true,
      message: "Customer registered successfully.",
      token,
      user: User.sanitize(user),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to register customer.",
      error: err.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.profile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.userId)) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(User.sanitize(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Wallet / balance
exports.getWallet = async (req, res) => {
  try {
    await ensureBalanceField(req.userId);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, data: { balance: Number(user.balance || 0) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.topupWallet = async (req, res) => {
  try {
    const amount = roundMoney(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "amount must be a positive number" });
    }

    await ensureBalanceField(req.userId);

    const updated = await User.findOneAndUpdate(
      { _id: req.userId },
      { $inc: { balance: amount } },
      { new: true },
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await BalanceTransaction.create({
      userId: updated._id,
      createdByUserId: updated._id,
      type: BalanceTransaction.Types.TOPUP,
      amount,
      balanceAfter: Number(updated.balance || 0),
      note: req.body.note,
    });

    res.json({
      success: true,
      message: "Balance topped up successfully.",
      data: { balance: Number(updated.balance || 0) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.adjustUserBalance = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ success: false, message: "id is invalid" });
    }

    const amount = roundMoney(req.body.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      return res
        .status(400)
        .json({ success: false, message: "amount must be a non-zero number" });
    }

    await ensureBalanceField(targetUserId);

    const query = { _id: targetUserId };
    if (amount < 0) {
      query.balance = { $gte: Math.abs(amount) };
    }

    const updated = await User.findOneAndUpdate(
      query,
      { $inc: { balance: amount } },
      { new: true },
    );

    if (!updated) {
      const exists = await User.exists({ _id: targetUserId });
      if (!exists) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      return res.status(400).json({
        success: false,
        message: "Insufficient balance for this adjustment.",
      });
    }

    await BalanceTransaction.create({
      userId: updated._id,
      createdByUserId: req.userId,
      type: BalanceTransaction.Types.ADMIN_ADJUST,
      amount,
      balanceAfter: Number(updated.balance || 0),
      note: req.body.note,
    });

    res.json({
      success: true,
      message: "Balance adjusted successfully.",
      data: { balance: Number(updated.balance || 0) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: list clients (service providers) optionally filtered by activation
exports.listClients = async (req, res) => {
  try {
    const { activated } = req.query;
    const query = { roles: Roles.CLIENT };
    if (activated === "true") query.activated = true;
    if (activated === "false") query.activated = false;

    const clients = await User.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: clients.map((u) => User.sanitize(u)),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to list clients.",
      error: err.message,
    });
  }
};
