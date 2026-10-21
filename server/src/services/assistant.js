// AI coding assistant backed by a local model through Ollama.
// It sees the problem statement, the public samples and the user's code, but never the hidden
// tests, and it's instructed to give hints rather than full solutions.
import { config } from "../config.js";

const SYSTEM_PROMPT = `You are a coding tutor on an online judge.
Help the user make progress on their own:
- Give hints, point out bugs, and explain concepts or edge cases.
- Never write the complete solution, even if asked. Short snippets (a few lines) to illustrate a point are fine.
- Be concise: at most about 150 words.`;

export function buildMessages({ problem, language, code, question, lastVerdict }) {
  const samples = problem.samples
    .map((s, i) => `Sample ${i + 1}\nInput:\n${s.input}\nExpected output:\n${s.output}`)
    .join("\n\n");
  const context = [
    `Problem: ${problem.title}`,
    problem.statement,
    samples,
    `The user's ${language} code:\n${code || "(empty)"}`,
    lastVerdict ? `Their last result: ${lastVerdict}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${context}\n\nQuestion: ${question || "Give me a hint for my next step."}` },
  ];
}

export async function askAssistant(input) {
  const res = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: buildMessages(input),
      stream: false,
      options: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`model server returned ${res.status}`);
  const data = await res.json();
  return data.message?.content?.trim() || "";
}
