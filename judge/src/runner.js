// Compiles and runs untrusted code against test cases.
//
// Isolation layers:
//   - this whole service runs in a container on an internal Docker network (no internet)
//   - it runs as an unprivileged user with a read-only root filesystem (see docker-compose.yml)
//   - every run gets its own temp directory, deleted afterwards
//   - wall-clock timeout (SIGKILL), output size cap, and per-process memory / process limits via prlimit
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { outputsMatch } from "./compare.js";

const MAX_OUTPUT = 1 << 20; // 1 MiB of stdout per run
const MEMORY_BYTES = 256 * 1024 * 1024;
const COMPILE_TIMEOUT_MS = 15_000;

export const LANGUAGES = {
  python: {
    file: "main.py",
    run: (dir) => ["python3", ["-I", path.join(dir, "main.py")]],
    limitMemory: true,
  },
  cpp: {
    file: "main.cpp",
    compile: (dir) => ["g++", ["-O2", "-std=c++17", "-o", path.join(dir, "main"), path.join(dir, "main.cpp")]],
    run: (dir) => [path.join(dir, "main"), []],
    limitMemory: true,
  },
  javascript: {
    file: "main.js",
    // V8 reserves a lot of virtual memory, so cap the heap instead of the address space.
    run: (dir) => ["node", ["--max-old-space-size=256", path.join(dir, "main.js")]],
    limitMemory: false,
  },
};

function exec(cmd, args, { input = "", timeoutMs, cwd, limitMemory }) {
  return new Promise((resolve) => {
    const limits = ["--nproc=128", "--fsize=10485760"];
    if (limitMemory) limits.push(`--as=${MEMORY_BYTES}`);
    // detached: the program gets its own process group, so killing the group also kills
    // anything it forked (a fork bomb can't outlive its time limit).
    const child = spawn("prlimit", [...limits, cmd, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"], detached: true });
    const killGroup = () => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // group already gone
      }
    };
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    const started = process.hrtime.bigint();
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk;
      else if (!truncated) {
        truncated = true;
        killGroup();
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 64 * 1024) stderr += chunk;
    });
    child.stdin.on("error", () => {}); // program may exit without reading stdin
    child.stdin.end(input);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      killGroup(); // clean up any background children left behind
      const timeMs = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ code, signal, stdout, stderr, timedOut, truncated, timeMs: Math.round(timeMs) });
    });
  });
}

// Runs `code` against each test and returns per-test results.
// stopOnFailure: a submission stops at the first failing test, like most judges.
export async function judge({ language, code, tests, timeLimitMs = 2000, stopOnFailure = true }) {
  const lang = LANGUAGES[language];
  if (!lang) return { verdict: "Unsupported Language", results: [] };
  const dir = await mkdtemp(path.join(tmpdir(), "run-"));
  try {
    await writeFile(path.join(dir, lang.file), code);
    if (lang.compile) {
      const [cmd, args] = lang.compile(dir);
      const c = await exec(cmd, args, { timeoutMs: COMPILE_TIMEOUT_MS, cwd: dir, limitMemory: false });
      if (c.code !== 0) {
        return { verdict: "Compilation Error", compileOutput: c.stderr.slice(0, 4000), results: [] };
      }
    }
    const results = [];
    let verdict = "Accepted";
    for (const [i, test] of tests.entries()) {
      const [cmd, args] = lang.run(dir);
      const r = await exec(cmd, args, { input: test.input, timeoutMs: timeLimitMs, cwd: dir, limitMemory: lang.limitMemory });
      let status;
      if (r.timedOut) status = "Time Limit Exceeded";
      else if (r.truncated) status = "Output Limit Exceeded";
      else if (r.code !== 0) status = "Runtime Error";
      else status = outputsMatch(r.stdout, test.output) ? "Accepted" : "Wrong Answer";
      results.push({
        test: i + 1,
        status,
        timeMs: r.timeMs,
        stdout: r.stdout.slice(0, 2000),
        stderr: r.stderr.slice(0, 2000),
      });
      if (status !== "Accepted") {
        verdict = status;
        if (stopOnFailure) break;
      }
    }
    return { verdict, results };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
