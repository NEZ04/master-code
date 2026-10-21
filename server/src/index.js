import mongoose from "mongoose";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { seed } from "./seed.js";

await mongoose.connect(config.mongoUrl);
await seed();
const server = createApp().listen(config.port, () => console.log(`API listening on :${config.port}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  });
}
