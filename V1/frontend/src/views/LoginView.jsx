import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Terminal, Shield, LogIn, UserPlus, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

export default function LoginView() {
  const { login, register, quickDemoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (demoRole) => {
    setLoading(true);
    setError("");
    try {
      await quickDemoLogin(demoRole);
    } catch (err) {
      setError(err.message || "Failed to log in to demo account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "460px",
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            borderRadius: "16px",
            boxShadow: "0 0 30px var(--primary-glow)",
            marginBottom: "16px"
          }}>
            <Terminal size={30} color="#fff" />
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>GIP_CodeZ</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Anti-Cheat Proctored Code Assessment & LMS Platform
          </p>
        </div>

        {/* Quick Demo Login Cards */}
        <div style={{
          background: "rgba(99, 102, 241, 0.08)",
          border: "1px solid rgba(99, 102, 241, 0.25)",
          borderRadius: "16px",
          padding: "16px",
          backdropFilter: "blur(10px)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: "700",
            color: "#a5b4fc",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px"
          }}>
            <Sparkles size={14} /> Quick One-Click Demo Access
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              onClick={() => handleDemo("teacher")}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "10px 12px",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                background: "rgba(99, 102, 241, 0.12)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "#fff" }}>
                <span>Teacher Portal</span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Alan Turing</span>
            </button>

            <button
              onClick={() => handleDemo("student")}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "10px 12px",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                background: "rgba(6, 182, 212, 0.12)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "#fff" }}>
                <span>Student Exam</span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Ada Lovelace</span>
            </button>
          </div>
        </div>

        {/* Login / Register Card */}
        <div className="glass-panel" style={{ padding: "32px" }}>
          <div style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            marginBottom: "24px"
          }}>
            <button
              onClick={() => { setIsRegister(false); setError(""); }}
              style={{
                flex: 1,
                padding: "10px",
                background: "transparent",
                border: "none",
                borderBottom: !isRegister ? "2px solid var(--primary)" : "2px solid transparent",
                color: !isRegister ? "#fff" : "var(--text-muted)",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(""); }}
              style={{
                flex: 1,
                padding: "10px",
                background: "transparent",
                border: "none",
                borderBottom: isRegister ? "2px solid var(--primary)" : "2px solid transparent",
                color: isRegister ? "#fff" : "var(--text-muted)",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#fca5a5",
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Marie Curie"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Role</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setRole("student")}
                      className={`btn btn-sm ${role === "student" ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "8px" }}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("teacher")}
                      className={`btn btn-sm ${role === "teacher" ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "8px" }}
                    >
                      Teacher
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "12px", padding: "12px" }}
            >
              {loading ? (
                "Please wait..."
              ) : isRegister ? (
                <>
                  <UserPlus size={16} /> Create Account
                </>
              ) : (
                <>
                  <LogIn size={16} /> Sign In
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
