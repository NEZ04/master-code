import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { Problem } from "../models/Problem.js";

const router = Router();
const FIELDS = ["slug", "title", "difficulty", "statement", "samples", "tests", "timeLimitMs"];

function pick(body) {
  return Object.fromEntries(FIELDS.filter((f) => body?.[f] !== undefined).map((f) => [f, body[f]]));
}

router.get("/", async (_req, res) => {
  const problems = await Problem.find({}, "slug title difficulty").sort({ createdAt: 1 });
  res.json({ problems });
});

router.get("/:slug", async (req, res) => {
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ error: "problem not found" });
  res.json({ problem: problem.toPublic() });
});

// Admin view includes hidden tests, for the problem editor.
router.get("/:slug/full", requireAuth, requireRole("admin"), async (req, res) => {
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ error: "problem not found" });
  res.json({ problem });
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const data = pick(req.body);
  if (!data.tests?.length) return res.status(400).json({ error: "at least one hidden test is required" });
  try {
    const problem = await Problem.create({ ...data, author: req.user._id });
    res.status(201).json({ problem: problem.toPublic() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "slug already exists" });
    res.status(400).json({ error: err.message });
  }
});

router.put("/:slug", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const problem = await Problem.findOneAndUpdate({ slug: req.params.slug }, pick(req.body), {
      new: true,
      runValidators: true,
    });
    if (!problem) return res.status(404).json({ error: "problem not found" });
    res.json({ problem: problem.toPublic() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:slug", requireAuth, requireRole("admin"), async (req, res) => {
  const result = await Problem.deleteOne({ slug: req.params.slug });
  if (!result.deletedCount) return res.status(404).json({ error: "problem not found" });
  res.status(204).end();
});

export default router;
