import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>{mode === "login" ? "Log in" : "Create an account"}</h1>
      {mode === "register" && (
        <label>
          Name
          <input value={form.name} onChange={update("name")} required />
        </label>
      )}
      <label>
        Email
        <input type="email" value={form.email} onChange={update("email")} required />
      </label>
      <label>
        Password
        <input type="password" value={form.password} onChange={update("password")} minLength={8} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
      <p className="muted">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </form>
  );
}
