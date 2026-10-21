import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function ProblemList() {
  const { user } = useAuth();
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/problems")
      .then((d) => setProblems(d.problems))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!problems) return <p className="muted">Loading problems…</p>;

  return (
    <section>
      <h1>Problems</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Difficulty</th>
            {user?.role === "admin" && <th />}
          </tr>
        </thead>
        <tbody>
          {problems.map((p) => (
            <tr key={p.slug}>
              <td>
                <Link to={`/problems/${p.slug}`}>{p.title}</Link>
              </td>
              <td>
                <span className={`badge ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
              </td>
              {user?.role === "admin" && (
                <td>
                  <Link to={`/admin/edit/${p.slug}`}>Edit</Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
