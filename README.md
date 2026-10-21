# Master Code

A small online judge: users solve programming problems in **Python, C++ or JavaScript**, code is compiled and run against hidden tests in a sandboxed judge service, and a **local Llama model (via Ollama)** gives hints without handing out the answer.

```
 browser ──► web (nginx + React) ──/api──► api (Express + MongoDB) ──► judge (sandbox, no internet)
                                              │
                                              └──► Ollama on the host (llama3.2:3b) for hints
```

## Features

- **Accounts and roles**: register/login with JWT; passwords hashed with bcrypt; `admin` users create, edit and delete problems.
- **Problems** have public samples and hidden tests. Hidden tests are never sent to the browser or the AI model.
- **Run** tries code on the samples; **Submit** judges against hidden tests and stores the result.
- **Verdicts**: Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error, Output Limit Exceeded, Compilation Error.
- **AI hints** from a local model through Ollama's `/api/chat`. The system prompt tells it to give hints, not full solutions; it sees the statement, the samples, your code and your last verdict.
- **Rate limits** on login, run/submit and hints.

## How the judge is isolated

Running other people's code is the risky part, so the judge is its own service:

| Layer | What it does |
|---|---|
| Separate container on an `internal` Docker network | the judge can only talk to the API, never the internet |
| Read-only root filesystem, `tmpfs` for `/tmp` | each run gets a fresh temp dir that is deleted afterwards |
| Non-root user, all capabilities dropped, `no-new-privileges` | |
| `prlimit` per process | memory (address space), max processes (stops fork bombs), max file size |
| Wall-clock timeout that `SIGKILL`s the whole process group | infinite loops become TLE, and forked children die too |
| Output cap | printing forever becomes Output Limit Exceeded |
| Concurrency semaphore + container memory/pid limits | a burst of submissions can't take the host down |

Output comparison ignores trailing whitespace on each line and trailing blank lines.

## Run it

Requires Docker. For hints, install [Ollama](https://ollama.com) and run `ollama pull llama3.2:3b` (everything else works without it).

```bash
docker compose up --build
```

Open http://127.0.0.1:8080. A default admin is created on first start (`admin@mastercode.dev` / `admin12345`; change it with `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Set `JWT_SECRET` to something random for anything beyond local use.

Four starter problems are seeded: Sum of Two Numbers, Reverse the Words, Maximum Subarray Sum and Balanced Brackets.

## Tests

```bash
# judge unit tests (verdicts, limits, all three languages)
docker compose run --rm --no-deps judge node --test test/judge.test.js

# API tests against a real MongoDB and the real judge (the AI model is mocked)
docker compose --profile test run --rm api-test

# end-to-end check through nginx while the app is running
python scripts/smoke_check.py http://127.0.0.1:8080
```

## Layout

```
judge/    sandboxed runner service (Node, no dependencies)
server/   REST API: auth, problems, submissions, AI hints (Express 5, Mongoose)
web/      React + Vite frontend, served by nginx in Docker
scripts/  end-to-end smoke check
```

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | anyone |
| GET | `/api/auth/me` | logged in |
| GET | `/api/problems`, `/api/problems/:slug` | anyone (no hidden tests) |
| GET | `/api/problems/:slug/full` | admin |
| POST / PUT / DELETE | `/api/problems[/:slug]` | admin |
| POST | `/api/run` | logged in (samples only) |
| POST / GET | `/api/submissions` | logged in |
| GET | `/api/submissions/:id` | owner or admin |
| POST | `/api/assistant/hint` | logged in |

## Limitations

- The sandbox relies on container isolation plus rlimits. A production judge would add seccomp profiles or gVisor/nsjail and a queue in front of several judge workers.
- Rate limits are in memory, so they only work for a single API instance.
- Memory limits use address space (`RLIMIT_AS`) for Python and C++; JavaScript gets a 256 MB V8 heap cap instead, since V8 reserves a lot of virtual memory.
- The process limit counts all processes of the judge's user, so a fork bomb can briefly slow other runs until its timeout kills it.
