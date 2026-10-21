"""End-to-end check through nginx: register, list problems, run and submit code, check the verdicts.

Usage: python scripts/smoke_check.py [base_url]   (default http://127.0.0.1:8080)
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080").rstrip("/")


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=60) as res:
            return res.status, json.loads(res.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        sys.exit(1)


for _ in range(60):
    try:
        status, body = call("GET", "/api/health")
        if status == 200 and body.get("db") == "up":
            break
    except Exception:
        pass
    time.sleep(2)
else:
    check("api is up", False)

html = urllib.request.urlopen(BASE + "/problems/sum-of-two", timeout=10).read().decode()
check("web app served (SPA route)", '<div id="root">' in html)

email = f"smoke{int(time.time())}@test.dev"
status, body = call("POST", "/api/auth/register", {"name": "Smoke", "email": email, "password": "password123"})
check("register", status == 201, status)
token = body["token"]

status, body = call("GET", "/api/problems")
check("problem list", status == 200 and len(body["problems"]) >= 4, len(body.get("problems", [])))

status, body = call("GET", "/api/problems/sum-of-two")
check("hidden tests not exposed", "tests" not in body["problem"])

solutions = {
    "python": "a, b = map(int, input().split())\nprint(a + b)\n",
    "cpp": "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<'\\n';}\n",
    "javascript": "const [a,b]=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(BigInt);console.log((a+b).toString());\n",
}
for lang, code in solutions.items():
    status, body = call("POST", "/api/submissions", {"slug": "sum-of-two", "language": lang, "code": code}, token)
    check(f"{lang} accepted", status == 201 and body["verdict"] == "Accepted", body)

overflow = "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<'\\n';}\n"
status, body = call("POST", "/api/submissions", {"slug": "sum-of-two", "language": "cpp", "code": overflow}, token)
check("int overflow -> wrong answer", body.get("verdict") == "Wrong Answer", body)

status, body = call("POST", "/api/submissions", {"slug": "sum-of-two", "language": "python", "code": "while True: pass"}, token)
check("infinite loop -> time limit", body.get("verdict") == "Time Limit Exceeded", body)

net = "import urllib.request\nurllib.request.urlopen('http://example.com', timeout=1)\nprint('CONNECTED')\n"
status, body = call("POST", "/api/run", {"slug": "sum-of-two", "language": "python", "code": net}, token)
leaked = any("CONNECTED" in r.get("stdout", "") for r in body.get("results", []))
check("no network inside judge", status == 200 and not leaked, body.get("verdict"))

status, body = call("GET", "/api/submissions", token=token)
check("submission history", status == 200 and len(body["submissions"]) == 5, len(body.get("submissions", [])))

status, body = call("POST", "/api/assistant/hint",
                    {"slug": "sum-of-two", "language": "cpp", "code": overflow, "lastVerdict": "Wrong Answer"}, token)
if status == 200:
    print("PASS AI hint (Ollama reachable):", body["hint"][:200].replace("\n", " "))
else:
    print(f"INFO AI hint returned {status}: {body} (start Ollama and pull llama3.2:3b to enable)")

print("ALL CHECKS PASSED")
