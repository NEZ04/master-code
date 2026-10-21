import express from "express";
import mongoose from "mongoose";

import assistantRoutes from "./routes/assistant.js";
import authRoutes from "./routes/auth.js";
import problemRoutes from "./routes/problems.js";
import submissionRoutes from "./routes/submissions.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind nginx
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "up" : "down" }),
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/problems", problemRoutes);
  app.use("/api", submissionRoutes);
  app.use("/api/assistant", assistantRoutes);

  app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "invalid JSON" });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "request too large" });
    console.error(err);
    res.status(500).json({ error: "internal error" });
  });
  return app;
}
