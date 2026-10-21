// Judge service: POST /judge {language, code, tests: [{input, output}], timeLimitMs, stopOnFailure}
// Only reachable from the API over the internal Docker network.
import http from "node:http";

import { judge, LANGUAGES } from "./runner.js";

const PORT = Number(process.env.PORT || 7000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 4);
const MAX_BODY = 2 * 1024 * 1024;

let running = 0;
const waiting = [];

// Simple semaphore so a burst of submissions can't fork-bomb the container.
async function withSlot(fn) {
  if (running >= MAX_CONCURRENT) await new Promise((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok", languages: Object.keys(LANGUAGES) });
  if (req.method !== "POST" || req.url !== "/judge") return send(res, 404, { error: "not found" });

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) {
      send(res, 413, { error: "request too large" });
      req.destroy();
    }
  });
  req.on("end", async () => {
    let job;
    try {
      job = JSON.parse(body);
    } catch {
      return send(res, 400, { error: "invalid JSON" });
    }
    if (typeof job.code !== "string" || !Array.isArray(job.tests)) {
      return send(res, 400, { error: "code and tests are required" });
    }
    try {
      const result = await withSlot(() => judge(job));
      send(res, 200, result);
    } catch (err) {
      send(res, 500, { error: String(err) });
    }
  });
});

server.listen(PORT, () => console.log(`judge listening on :${PORT}`));
