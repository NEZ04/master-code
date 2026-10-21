import { createContext, useContext, useEffect, useState } from "react";

import { api, getToken, setToken } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const d = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(d.token);
    setUser(d.user);
  }

  async function register(name, email, password) {
    const d = await api("/auth/register", { method: "POST", body: { name, email, password } });
    setToken(d.token);
    setUser(d.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
