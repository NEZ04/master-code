import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth.jsx";
import AdminProblem from "./pages/AdminProblem.jsx";
import Login from "./pages/Login.jsx";
import ProblemList from "./pages/ProblemList.jsx";
import ProblemPage from "./pages/ProblemPage.jsx";
import Submissions from "./pages/Submissions.jsx";

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <p>You need {role} access for this page.</p>;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Master Code
        </Link>
        <nav>
          <NavLink to="/" end>
            Problems
          </NavLink>
          {user && <NavLink to="/submissions">My submissions</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin/new">New problem</NavLink>}
        </nav>
        <div className="account">
          {user ? (
            <>
              <span className="muted">
                {user.name}
                {user.role === "admin" ? " · admin" : ""}
              </span>
              <button className="link" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ProblemList />} />
          <Route path="/login" element={<Login />} />
          <Route path="/problems/:slug" element={<ProblemPage />} />
          <Route path="/submissions" element={<RequireAuth><Submissions /></RequireAuth>} />
          <Route path="/admin/new" element={<RequireAuth role="admin"><AdminProblem /></RequireAuth>} />
          <Route path="/admin/edit/:slug" element={<RequireAuth role="admin"><AdminProblem /></RequireAuth>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
