import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authConfig, setAuthConfig] = useState({ google_client_id: "" });

  useEffect(() => {
    api.auth
      .config()
      .then(setAuthConfig)
      .catch(() => {});

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

  const finishLogin = (res) => {
    localStorage.setItem("gip_token", res.access_token);
    setUser(res.user);
    return res.user;
  };

  const googleLogin = async (credential) => finishLogin(await api.auth.google(credential));

  const logout = () => {
    localStorage.removeItem("gip_token");
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authConfig,
        googleLogin,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin"
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
