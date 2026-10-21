import { Router } from "express";

import { requireAuth, signToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { User } from "../models/User.js";

const router = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authLimit = rateLimit({ windowMs: 60_000, max: 20, name: "login" });

router.post("/register", authLimit, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !EMAIL.test(email || "")) return res.status(400).json({ error: "name and a valid email are required" });
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: "email already registered" });
  // Everyone registers as a normal user; admins are created by the seed script.
  const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post("/login", authLimit, async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || "").toLowerCase() });
  // Same message whether the email or the password is wrong, so emails can't be probed.
  if (!user || !(await user.checkPassword(String(password || "")))) {
    return res.status(401).json({ error: "wrong email or password" });
  }
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

export default router;
