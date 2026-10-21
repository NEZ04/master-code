import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api.js";

export default function Submissions() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/submissions")
      .then((d) => setItems(d.submissions))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!items) return <p className="muted">Loading…</p>;
  if (!items.length) return <p>No submissions yet. <Link to="/">Pick a problem</Link>.</p>;

  return (
    <section>
      <h1>My submissions</h1>
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Problem</th>
            <th>Language</th>
            <th>Verdict</th>
            <th>Tests</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s._id}>
              <td>{new Date(s.createdAt).toLocaleString()}</td>
              <td>{s.problem ? <Link to={`/problems/${s.problem.slug}`}>{s.problem.title}</Link> : "(deleted)"}</td>
              <td>{s.language}</td>
              <td className={s.verdict === "Accepted" ? "ok" : "bad"}>{s.verdict}</td>
              <td>
                {s.passed}/{s.total}
              </td>
              <td>{s.timeMs} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
