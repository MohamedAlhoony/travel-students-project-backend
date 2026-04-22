const User = require("../models/User");
const Role = require("../models/Role");
const Permission = require("../models/Permission");

// Middleware to check if user has required permission
module.exports = function (requiredPermission) {
  return async function (req, res, next) {
    try {
      // Assume userId is set in req.userId (e.g., from JWT middleware)
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const user = await User.findById(userId).populate({
        path: "roles",
        populate: { path: "permissions" },
      });
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const userPermissions = user.roles.flatMap((role) =>
        role.permissions.map((p) => p.name),
      );
      if (!userPermissions.includes(requiredPermission)) {
        return res
          .status(403)
          .json({ error: "Forbidden: insufficient permissions" });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
};
