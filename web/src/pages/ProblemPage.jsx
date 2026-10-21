import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const STARTERS = {
  python: "import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # your code here\n\nmain()\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // your code here\n    return 0;\n}\n",
  javascript: "const input = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/);\n// your code here\n",
};

const draftKey = (slug, lang) => `mastercode.draft.${slug}.${lang}`;
function loadDraft(slug, lang) {
  try {
    return localStorage.getItem(draftKey(slug, lang)) ?? STARTERS[lang];
  } catch {
    return STARTERS[lang];
  }
}
function saveDraft(slug, lang, code) {
  try {
    localStorage.setItem(draftKey(slug, lang), code);
  } catch {
    // drafts are a convenience only
  }
}

function Verdict({ value }) {
  const cls = value === "Accepted" ? "ok" : value ? "bad" : "";
  return <span className={`verdict ${cls}`}>{value}</span>;
}

export default function ProblemPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [problem, setProblem] = useState(null);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [question, setQuestion] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    api(`/problems/${slug}`)
      .then((d) => setProblem(d.problem))
      .catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => setCode(loadDraft(slug, language)), [slug, language]);

  function edit(value) {
    setCode(value);
    saveDraft(slug, language, value);
  }

  // Tab inserts spaces instead of leaving the editor.
  function onKeyDown(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: end } = e.target;
    const next = code.slice(0, s) + "    " + code.slice(end);
    edit(next);
    requestAnimationFrame(() => e.target.setSelectionRange(s + 4, s + 4));
  }

  async function act(kind) {
    setBusy(kind);
    setError("");
    try {
      if (kind === "run") {
        setRunResult(await api("/run", { method: "POST", body: { slug, language, code } }));
      } else if (kind === "submit") {
        setSubmitResult(await api("/submissions", { method: "POST", body: { slug, language, code } }));
      } else {
        const d = await api("/assistant/hint", {
          method: "POST",
          body: { slug, language, code, question, lastVerdict: submitResult?.verdict },
        });
        setHint(d.hint);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  if (!problem) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  return (
    <div className="split">
      <section className="card">
        <h1>
          {problem.title} <span className={`badge ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
        </h1>
        <p className="muted">Time limit: {problem.timeLimitMs} ms</p>
        <pre className="statement">{problem.statement}</pre>
        {problem.samples.map((s, i) => (
          <div key={i} className="sample">
            <h3>Sample {i + 1}</h3>
            <div className="io">
              <div>
                <div className="muted">Input</div>
                <pre>{s.input}</pre>
              </div>
              <div>
                <div className="muted">Output</div>
                <pre>{s.output}</pre>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="toolbar">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="python">Python 3</option>
            <option value="cpp">C++17</option>
            <option value="javascript">JavaScript (Node)</option>
          </select>
          {user ? (
            <>
              <button onClick={() => act("run")} disabled={!!busy}>
                {busy === "run" ? "Running…" : "Run samples"}
              </button>
              <button className="primary" onClick={() => act("submit")} disabled={!!busy}>
                {busy === "submit" ? "Judging…" : "Submit"}
              </button>
            </>
          ) : (
            <Link to="/login">Log in to run and submit</Link>
          )}
        </div>
        <textarea
          className="editor"
          value={code}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="Code editor"
        />
        {error && <p className="error">{error}</p>}

        {submitResult && (
          <div className="result">
            <Verdict value={submitResult.verdict} /> {submitResult.passed}/{submitResult.total} tests
            {submitResult.failedTest ? ` · failed on hidden test ${submitResult.failedTest}` : ""} · {submitResult.timeMs} ms
            {submitResult.compileOutput && <pre className="stderr">{submitResult.compileOutput}</pre>}
          </div>
        )}

        {runResult && (
          <div className="result">
            <div>
              Samples: <Verdict value={runResult.verdict} />
            </div>
            {runResult.compileOutput && <pre className="stderr">{runResult.compileOutput}</pre>}
            {runResult.results.map((r) => (
              <details key={r.test}>
                <summary>
                  Sample {r.test}: <Verdict value={r.status} /> · {r.timeMs} ms
                </summary>
                <pre>{r.stdout || "(no output)"}</pre>
                {r.stderr && <pre className="stderr">{r.stderr}</pre>}
              </details>
            ))}
          </div>
        )}

        {user && (
          <div className="assistant">
            <h3>AI assistant</h3>
            <p className="muted">Ask for a hint. It won't write the full solution for you.</p>
            <div className="toolbar">
              <input
                placeholder="e.g. Why is my answer wrong on big inputs?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button onClick={() => act("hint")} disabled={!!busy}>
                {busy === "hint" ? "Thinking…" : "Get hint"}
              </button>
            </div>
            {hint && <div className="hint">{hint}</div>}
          </div>
        )}
      </section>
    </div>
  );
}
