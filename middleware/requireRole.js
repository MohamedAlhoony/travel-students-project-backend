module.exports = function requireRole(requiredRole) {
  return function (req, res, next) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (!roles.includes(requiredRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
};
