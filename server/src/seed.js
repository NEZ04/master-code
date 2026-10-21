// Creates the admin account (from ADMIN_EMAIL / ADMIN_PASSWORD) and the starter problems.
// Idempotent: safe to run on every start.
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import { config } from "./config.js";
import { Problem } from "./models/Problem.js";
import { User } from "./models/User.js";
import { SEED_PROBLEMS } from "./seedData.js";

export async function seed() {
  let admin = await User.findOne({ email: config.adminEmail });
  if (!admin) {
    admin = await User.create({
      name: "Admin",
      email: config.adminEmail,
      passwordHash: await User.hashPassword(config.adminPassword),
      role: "admin",
    });
    console.log(`created admin ${config.adminEmail}`);
  }
  for (const p of SEED_PROBLEMS) {
    const exists = await Problem.exists({ slug: p.slug });
    if (!exists) await Problem.create({ ...p, author: admin._id });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mongoose.connect(config.mongoUrl);
  await seed();
  await mongoose.disconnect();
}
