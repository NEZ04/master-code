import { config } from "../config.js";

export async function runJudge(job) {
  const res = await fetch(`${config.judgeUrl}/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`judge returned ${res.status}`);
  return res.json();
}
