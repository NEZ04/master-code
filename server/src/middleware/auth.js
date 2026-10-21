import jwt from "jsonwebtoken";

import { config } from "../config.js";
import { User } from "../models/User.js";

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Requires "Authorization: Bearer <token>". Loads the user so a deleted account or a role
// change takes effect immediately, instead of trusting the role baked into an old token.
export async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "login required" });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "account not found" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ error: `${role} access required` });
    next();
  };
}
