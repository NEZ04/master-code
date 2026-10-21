export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/mastercode",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  judgeUrl: process.env.JUDGE_URL || "http://localhost:7000",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2:3b",
  adminEmail: process.env.ADMIN_EMAIL || "admin@mastercode.dev",
  adminPassword: process.env.ADMIN_PASSWORD || "admin12345",
};

if (process.env.NODE_ENV === "production" && config.jwtSecret === "dev-only-secret-change-me") {
  throw new Error("Set JWT_SECRET in production");
}
