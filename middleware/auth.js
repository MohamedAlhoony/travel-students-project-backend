const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function (req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.userId = decoded.id;
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = User.sanitize(user);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
