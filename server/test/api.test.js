// API tests against a real MongoDB and the real judge service; the AI model is a local mock.
// Run inside Docker:  docker compose --profile test run --rm api-test
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

// --- mock Ollama: records prompts and returns a canned hint --------------------------------
const prompts = [];
const mockOllama = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    prompts.push(JSON.parse(body));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: { role: "assistant", content: "Hint: think about overflow." } }));
  });
});
await new Promise((r) => mockOllama.listen(0, r));
process.env.OLLAMA_URL = `http://127.0.0.1:${mockOllama.address().port}`;
process.env.MONGO_URL ||= "mongodb://localhost:27017/mastercode_test";
process.env.ADMIN_EMAIL = "admin@test.dev";
process.env.ADMIN_PASSWORD = "admin-password";

const mongoose = (await import("mongoose")).default;
const { createApp } = await import("../src/app.js");
const { seed } = await import("../src/seed.js");

let server;
let base;

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const PY_SUM = "a, b = map(int, input().split())\nprint(a + b)\n";
let userToken;
let adminToken;

before(async () => {
  await mongoose.connect(process.env.MONGO_URL);
  await mongoose.connection.dropDatabase();
  await seed();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  mockOllama.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("auth", () => {
  test("register validates input", async () => {
    assert.equal((await api("POST", "/api/auth/register", { body: { name: "A", email: "bad", password: "12345678" } })).status, 400);
    assert.equal((await api("POST", "/api/auth/register", { body: { name: "A", email: "a@b.co", password: "short" } })).status, 400);
  });

  test("register, login and /me", async () => {
    const reg = await api("POST", "/api/auth/register", { body: { name: "Asha", email: "Asha@Example.com", password: "password123" } });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.role, "user");
    assert.equal(reg.body.user.email, "asha@example.com");
    assert.equal(reg.body.user.passwordHash, undefined);

    const dup = await api("POST", "/api/auth/register", { body: { name: "Asha", email: "asha@example.com", password: "password123" } });
    assert.equal(dup.status, 409);

    const bad = await api("POST", "/api/auth/login", { body: { email: "asha@example.com", password: "wrong-pass" } });
    assert.equal(bad.status, 401);

    const login = await api("POST", "/api/auth/login", { body: { email: "asha@example.com", password: "password123" } });
    assert.equal(login.status, 200);
    userToken = login.body.token;
    const me = await api("GET", "/api/auth/me", { token: userToken });
    assert.equal(me.body.user.name, "Asha");

    adminToken = (await api("POST", "/api/auth/login", { body: { email: "admin@test.dev", password: "admin-password" } })).body.token;
    assert.ok(adminToken);
  });

  test("protected routes reject missing or forged tokens", async () => {
    assert.equal((await api("GET", "/api/auth/me")).status, 401);
    assert.equal((await api("GET", "/api/auth/me", { token: "not.a.jwt" })).status, 401);
  });
});

describe("problems", () => {
  test("list and view problems without hidden tests", async () => {
    const list = await api("GET", "/api/problems");
    assert.ok(list.body.problems.length >= 4);
    const p = await api("GET", "/api/problems/sum-of-two");
    assert.equal(p.status, 200);
    assert.ok(p.body.problem.samples.length > 0);
    assert.equal(p.body.problem.tests, undefined, "hidden tests must never be exposed");
  });

  test("only admins can create, edit, delete and see hidden tests", async () => {
    const problem = {
      slug: "square",
      title: "Square",
      statement: "Print n*n.",
      samples: [{ input: "3\n", output: "9\n" }],
      tests: [{ input: "3\n", output: "9\n" }, { input: "12\n", output: "144\n" }],
    };
    assert.equal((await api("POST", "/api/problems", { token: userToken, body: problem })).status, 403);
    assert.equal((await api("GET", "/api/problems/sum-of-two/full", { token: userToken })).status, 403);
    assert.equal((await api("POST", "/api/problems", { token: adminToken, body: problem })).status, 201);
    assert.equal((await api("POST", "/api/problems", { token: adminToken, body: problem })).status, 409);
    const full = await api("GET", "/api/problems/square/full", { token: adminToken });
    assert.equal(full.body.problem.tests.length, 2);
    const edit = await api("PUT", "/api/problems/square", { token: adminToken, body: { title: "Square It" } });
    assert.equal(edit.body.problem.title, "Square It");
    assert.equal((await api("DELETE", "/api/problems/square", { token: adminToken })).status, 204);
    assert.equal((await api("GET", "/api/problems/square")).status, 404);
  });
});

describe("judging", () => {
  const submit = (body) => api("POST", "/api/submissions", { token: userToken, body: { slug: "sum-of-two", ...body } });

  test("accepted in python, cpp and javascript", async () => {
    const cpp = "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b;}\n";
    const js = "const [a,b]=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(BigInt);console.log((a+b).toString());";
    for (const [language, code] of [["python", PY_SUM], ["cpp", cpp], ["javascript", js]]) {
      const r = await submit({ language, code });
      assert.equal(r.status, 201);
      assert.equal(r.body.verdict, "Accepted", `${language}: ${JSON.stringify(r.body)}`);
      assert.equal(r.body.passed, r.body.total);
    }
  });

  test("overflow bug in C++ fails a hidden test", async () => {
    const intCpp = "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}\n";
    const r = await submit({ language: "cpp", code: intCpp });
    assert.equal(r.body.verdict, "Wrong Answer");
    assert.ok(r.body.failedTest >= 2);
    assert.equal(r.body.input, undefined, "hidden test data must not leak");
  });

  test("time limit, runtime error and compile error", async () => {
    assert.equal((await submit({ language: "python", code: "while True: pass" })).body.verdict, "Time Limit Exceeded");
    assert.equal((await submit({ language: "python", code: "print(1/0)" })).body.verdict, "Runtime Error");
    const ce = await submit({ language: "cpp", code: "int main( {" });
    assert.equal(ce.body.verdict, "Compilation Error");
    assert.ok(ce.body.compileOutput);
  });

  test("run on samples and on custom input", async () => {
    const r = await api("POST", "/api/run", { token: userToken, body: { slug: "sum-of-two", language: "python", code: PY_SUM } });
    assert.equal(r.body.verdict, "Accepted");
    assert.equal(r.body.results.length, 2);
    const custom = await api("POST", "/api/run", {
      token: userToken,
      body: { slug: "sum-of-two", language: "python", code: PY_SUM, input: "40 2\n" },
    });
    assert.equal(custom.body.results[0].stdout.trim(), "42");
  });

  test("input validation", async () => {
    assert.equal((await submit({ language: "rust", code: "fn main(){}" })).status, 400);
    assert.equal((await submit({ language: "python", code: "   " })).status, 400);
    assert.equal((await api("POST", "/api/submissions", { token: userToken, body: { slug: "nope", language: "python", code: "x" } })).status, 404);
    assert.equal((await api("POST", "/api/submissions", { body: { slug: "sum-of-two", language: "python", code: PY_SUM } })).status, 401);
  });

  test("submission history is private", async () => {
    const mine = await api("GET", "/api/submissions?slug=sum-of-two", { token: userToken });
    assert.ok(mine.body.submissions.length >= 5);
    assert.equal(mine.body.submissions[0].code, undefined);
    const id = mine.body.submissions[0]._id;
    assert.equal((await api("GET", `/api/submissions/${id}`, { token: userToken })).status, 200);
    const other = (await api("POST", "/api/auth/register", { body: { name: "Bo", email: "bo@example.com", password: "password123" } })).body.token;
    assert.equal((await api("GET", `/api/submissions/${id}`, { token: other })).status, 404);
    assert.equal((await api("GET", `/api/submissions/${id}`, { token: adminToken })).status, 200);
    assert.equal((await api("GET", "/api/submissions/not-an-id", { token: userToken })).status, 404);
  });
});

describe("AI assistant", () => {
  test("returns a hint and never sends hidden tests to the model", async () => {
    const r = await api("POST", "/api/assistant/hint", {
      token: userToken,
      body: { slug: "sum-of-two", language: "cpp", code: "int main(){}", question: "why wrong?" },
    });
    assert.equal(r.status, 200);
    assert.match(r.body.hint, /overflow/);
    const prompt = JSON.stringify(prompts.at(-1));
    assert.match(prompt, /Sum of Two Numbers/);
    assert.match(prompt, /never write the complete solution/i);
    assert.ok(!prompt.includes("-1000000000000000000"), "hidden test input leaked into the prompt");
  });

  test("requires login", async () => {
    assert.equal((await api("POST", "/api/assistant/hint", { body: { slug: "sum-of-two" } })).status, 401);
  });
});
