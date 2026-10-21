import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { Problem } from "../models/Problem.js";
import { askAssistant } from "../services/assistant.js";

const router = Router();
const hintLimit = rateLimit({ windowMs: 60_000, max: 10, name: "hint" });

router.post("/hint", requireAuth, hintLimit, async (req, res) => {
  const { slug, language, code = "", question = "", lastVerdict } = req.body || {};
  const problem = await Problem.findOne({ slug });
  if (!problem) return res.status(404).json({ error: "problem not found" });
  if (String(code).length > 20_000 || String(question).length > 1000) {
    return res.status(400).json({ error: "code or question too long" });
  }
  try {
    const hint = await askAssistant({ problem, language, code, question, lastVerdict });
    res.json({ hint });
  } catch {
    res.status(503).json({ error: "AI assistant unavailable. Is Ollama running?" });
  }
});

export default router;
