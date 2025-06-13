const basicAuth = require("basic-auth");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const credentials = basicAuth(req);
    if (!credentials)
      return res.status(401).json({ error: "Authentication required" });

    const user = await User.findOne({ username: credentials.name });
    if (!user || !(await user.correctPassword(credentials.pass))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
