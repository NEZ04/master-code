import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api.js";

const empty = { slug: "", title: "", difficulty: "Easy", statement: "", timeLimitMs: 2000, samples: [], tests: [] };

function CaseList({ label, cases, onChange }) {
  const set = (i, field, value) => onChange(cases.map((c, j) => (j === i ? { ...c, [field]: value } : c)));
  return (
    <fieldset>
      <legend>{label}</legend>
      {cases.map((c, i) => (
        <div key={i} className="io">
          <textarea placeholder="input" value={c.input} onChange={(e) => set(i, "input", e.target.value)} />
          <textarea placeholder="expected output" value={c.output} onChange={(e) => set(i, "output", e.target.value)} />
          <button type="button" className="link" onClick={() => onChange(cases.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...cases, { input: "", output: "" }])}>
        Add case
      </button>
    </fieldset>
  );
}

export default function AdminProblem() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    if (slug) {
      api(`/problems/${slug}/full`)
        .then((d) => setForm(d.problem))
        .catch((e) => setError(e.message));
    }
  }, [slug]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError("");
    const body = {
      slug: form.slug,
      title: form.title,
      difficulty: form.difficulty,
      statement: form.statement,
      timeLimitMs: Number(form.timeLimitMs),
      samples: form.samples,
      tests: form.tests,
    };
    try {
      if (slug) await api(`/problems/${slug}`, { method: "PUT", body });
      else await api("/problems", { method: "POST", body });
      navigate(`/problems/${form.slug}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${form.title}"? This can't be undone.`)) return;
    await api(`/problems/${slug}`, { method: "DELETE" });
    navigate("/");
  }

  return (
    <form className="card" onSubmit={save}>
      <h1>{slug ? "Edit problem" : "New problem"}</h1>
      <div className="row">
        <label>
          Slug
          <input value={form.slug} onChange={update("slug")} pattern="[a-z0-9-]+" required disabled={!!slug} />
        </label>
        <label>
          Title
          <input value={form.title} onChange={update("title")} required />
        </label>
        <label>
          Difficulty
          <select value={form.difficulty} onChange={update("difficulty")}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
        <label>
          Time limit (ms)
          <input type="number" min="100" max="10000" value={form.timeLimitMs} onChange={update("timeLimitMs")} />
        </label>
      </div>
      <label>
        Statement
        <textarea rows={8} value={form.statement} onChange={update("statement")} required />
      </label>
      <CaseList label="Samples (shown to users)" cases={form.samples} onChange={(samples) => setForm({ ...form, samples })} />
      <CaseList label="Hidden tests (used for judging)" cases={form.tests} onChange={(tests) => setForm({ ...form, tests })} />
      {error && <p className="error">{error}</p>}
      <div className="toolbar">
        <button className="primary">Save</button>
        {slug && (
          <button type="button" className="danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
