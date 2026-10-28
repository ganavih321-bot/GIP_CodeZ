import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("gip_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem("gip_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.auth.login(email, password);
    localStorage.setItem("gip_token", res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (name, email, password, role) => {
    const res = await api.auth.register(name, email, password, role);
    localStorage.setItem("gip_token", res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem("gip_token");
    setUser(null);
  };

  const quickDemoLogin = async (role) => {
    if (role === "teacher") {
      return login("teacher@gip.com", "teacher123");
    } else {
      return login("student@gip.com", "student123");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        quickDemoLogin,
        isAuthenticated: !!user,
        isTeacher: user?.role === "teacher"
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
