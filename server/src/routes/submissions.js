import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { Problem } from "../models/Problem.js";
import { Submission } from "../models/Submission.js";
import { runJudge } from "../services/judgeClient.js";

const router = Router();
const LANGUAGES = ["python", "cpp", "javascript"];
const judgeLimit = rateLimit({ windowMs: 60_000, max: 20, name: "run/submit" });

function validate(body) {
  if (!LANGUAGES.includes(body?.language)) return "language must be python, cpp or javascript";
  if (typeof body.code !== "string" || !body.code.trim()) return "code is required";
  if (body.code.length > 100_000) return "code is too long";
  return null;
}

// "Run": try the code on the public samples (or a custom input) without recording a submission.
router.post("/run", requireAuth, judgeLimit, async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });
  const problem = await Problem.findOne({ slug: req.body.slug });
  if (!problem) return res.status(404).json({ error: "problem not found" });
  const tests =
    typeof req.body.input === "string" ? [{ input: req.body.input, output: "" }] : problem.samples;
  try {
    const result = await runJudge({
      language: req.body.language,
      code: req.body.code,
      tests,
      timeLimitMs: problem.timeLimitMs,
      stopOnFailure: false,
    });
    res.json(result);
  } catch {
    res.status(503).json({ error: "judge unavailable, try again shortly" });
  }
});

// "Submit": judge against the hidden tests and record the result.
router.post("/submissions", requireAuth, judgeLimit, async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });
  const problem = await Problem.findOne({ slug: req.body.slug });
  if (!problem) return res.status(404).json({ error: "problem not found" });

  let result;
  try {
    result = await runJudge({
      language: req.body.language,
      code: req.body.code,
      tests: problem.tests,
      timeLimitMs: problem.timeLimitMs,
      stopOnFailure: true,
    });
  } catch {
    return res.status(503).json({ error: "judge unavailable, try again shortly" });
  }
  const passed = result.results.filter((r) => r.status === "Accepted").length;
  const submission = await Submission.create({
    user: req.user._id,
    problem: problem._id,
    language: req.body.language,
    code: req.body.code,
    verdict: result.verdict,
    passed,
    total: problem.tests.length,
    timeMs: Math.max(0, ...result.results.map((r) => r.timeMs)),
    compileOutput: result.compileOutput,
  });
  // Only report which hidden test failed, never its input or expected output.
  const failed = result.results.find((r) => r.status !== "Accepted");
  res.status(201).json({
    id: submission._id,
    verdict: submission.verdict,
    passed,
    total: submission.total,
    timeMs: submission.timeMs,
    failedTest: failed?.test,
    compileOutput: result.compileOutput,
  });
});

router.get("/submissions", requireAuth, async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.slug) {
    const problem = await Problem.findOne({ slug: req.query.slug }, "_id");
    if (!problem) return res.json({ submissions: [] });
    filter.problem = problem._id;
  }
  const submissions = await Submission.find(filter, "-code")
    .populate("problem", "slug title")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ submissions });
});

router.get("/submissions/:id", requireAuth, async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate("problem", "slug title").catch(() => null);
  // Users can only see their own code; admins can see everyone's.
  if (!submission || (!submission.user.equals(req.user._id) && req.user.role !== "admin")) {
    return res.status(404).json({ error: "submission not found" });
  }
  res.json({ submission });
});

export default router;
