import assert from "node:assert/strict";
import { test } from "node:test";

import { normalize, outputsMatch } from "../src/compare.js";
import { judge } from "../src/runner.js";

const SUM_TESTS = [
  { input: "1 2\n", output: "3\n" },
  { input: "10 -4\n", output: "6\n" },
];

test("output comparison ignores trailing whitespace and blank lines", () => {
  assert.equal(normalize("3  \r\n\n\n"), "3");
  assert.ok(outputsMatch("a b \nc\n\n", "a b\nc"));
  assert.ok(!outputsMatch("a  b", "a b"));
});

test("python: accepted", async () => {
  const r = await judge({ language: "python", code: "a, b = map(int, input().split())\nprint(a + b)\n", tests: SUM_TESTS });
  assert.equal(r.verdict, "Accepted");
  assert.equal(r.results.length, 2);
});

test("cpp: accepted", async () => {
  const code = "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<\"\\n\";}\n";
  const r = await judge({ language: "cpp", code, tests: SUM_TESTS });
  assert.equal(r.verdict, "Accepted");
});

test("javascript: accepted", async () => {
  const code = "const [a,b]=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);console.log(a+b);";
  const r = await judge({ language: "javascript", code, tests: SUM_TESTS });
  assert.equal(r.verdict, "Accepted");
});

test("wrong answer stops at first failing test", async () => {
  const r = await judge({ language: "python", code: "print(0)", tests: SUM_TESTS });
  assert.equal(r.verdict, "Wrong Answer");
  assert.equal(r.results.length, 1);
});

test("time limit exceeded", async () => {
  const r = await judge({ language: "python", code: "while True: pass", tests: SUM_TESTS, timeLimitMs: 500 });
  assert.equal(r.verdict, "Time Limit Exceeded");
});

test("runtime error", async () => {
  const r = await judge({ language: "python", code: "raise SystemExit(1/0)", tests: SUM_TESTS });
  assert.equal(r.verdict, "Runtime Error");
  assert.match(r.results[0].stderr, /ZeroDivisionError/);
});

test("compilation error", async () => {
  const r = await judge({ language: "cpp", code: "int main( { return 0; }", tests: SUM_TESTS });
  assert.equal(r.verdict, "Compilation Error");
  assert.ok(r.compileOutput.length > 0);
});

test("memory limit stops a huge allocation", async () => {
  const r = await judge({ language: "python", code: "x = bytearray(1024 * 1024 * 1024)\nprint(3)", tests: SUM_TESTS });
  assert.equal(r.verdict, "Runtime Error");
});

test("output limit", async () => {
  const r = await judge({ language: "python", code: "while True: print('x' * 1000)", tests: SUM_TESTS, timeLimitMs: 3000 });
  assert.ok(["Output Limit Exceeded", "Time Limit Exceeded"].includes(r.verdict), r.verdict);
});

test("unsupported language", async () => {
  const r = await judge({ language: "cobol", code: "", tests: SUM_TESTS });
  assert.equal(r.verdict, "Unsupported Language");
});

test("background children are killed with the run", async () => {
  const code = [
    "import os, time",
    "if os.fork() == 0:",
    "    open('/tmp/judge_orphan_marker', 'w').close()",
    "    time.sleep(3)",
    "    open('/tmp/judge_orphan_survived', 'w').close()",
    "else:",
    "    while True: pass",
  ].join("\n");
  const { rmSync, existsSync } = await import("node:fs");
  rmSync("/tmp/judge_orphan_survived", { force: true });
  const r = await judge({ language: "python", code, tests: [{ input: "", output: "" }], timeLimitMs: 500 });
  assert.equal(r.verdict, "Time Limit Exceeded");
  await new Promise((resolve) => setTimeout(resolve, 3500));
  assert.equal(existsSync("/tmp/judge_orphan_survived"), false);
});
