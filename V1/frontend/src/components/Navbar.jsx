import React from "react";
import { useAuth } from "../context/AuthContext";
import { Terminal, Shield, LogOut, UserCheck, Sparkles, BookOpen } from "lucide-react";

export default function Navbar({ currentView, onNavigate }) {
  const { user, logout, quickDemoLogin, isTeacher } = useAuth();

  return (
    <header style={{
      background: "rgba(10, 14, 23, 0.85)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 100,
      padding: "0 24px"
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px"
      }}>
        {/* Logo */}
        <div 
          onClick={() => onNavigate("dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          <div style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            borderRadius: "10px",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)"
          }}>
            <Terminal size={20} color="#fff" />
          </div>
          <div>
            <span style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.25rem",
              fontWeight: "800",
              background: "linear-gradient(to right, #ffffff, #a5b4fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}>
              GIP_CodeZ
            </span>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}>
              <Shield size={10} color="#10b981" />
              Proctored LMS
            </div>
          </div>
        </div>

        {/* Center Nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => onNavigate("dashboard")}
            className={`btn ${currentView === "dashboard" ? "btn-secondary" : ""}`}
            style={{
              background: currentView === "dashboard" ? "rgba(99, 102, 241, 0.15)" : "transparent",
              color: currentView === "dashboard" ? "#a5b4fc" : "var(--text-secondary)",
              border: currentView === "dashboard" ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent"
            }}
          >
            <BookOpen size={16} />
            Classrooms
          </button>
        </nav>

        {/* Right side Profile & Quick Demo Switcher */}
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Quick Demo Switcher buttons */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.04)",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid var(--border)"
            }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", padding: "0 8px" }}>
                Switch to:
              </span>
              <button
                onClick={() => quickDemoLogin("teacher")}
                className="btn btn-sm"
                style={{
                  background: isTeacher ? "var(--primary)" : "transparent",
                  color: isTeacher ? "#fff" : "var(--text-secondary)",
                  padding: "4px 8px",
                  fontSize: "11px"
                }}
                title="Switch to Teacher account"
              >
                Teacher
              </button>
              <button
                onClick={() => quickDemoLogin("student")}
                className="btn btn-sm"
                style={{
                  background: !isTeacher ? "var(--accent-cyan)" : "transparent",
                  color: !isTeacher ? "#090d16" : "var(--text-secondary)",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: !isTeacher ? "700" : "500"
                }}
                title="Switch to Student account"
              >
                Student
              </button>
            </div>

            {/* User Pill */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "6px 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px"
            }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: isTeacher ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "linear-gradient(135deg, #06b6d4, #0891b2)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "12px"
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#fff", lineHeight: 1.2 }}>
                  {user.name}
                </span>
                <span style={{
                  fontSize: "10px",
                  color: isTeacher ? "#a5b4fc" : "#67e8f9",
                  textTransform: "capitalize",
                  fontWeight: "600"
                }}>
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="btn btn-secondary btn-sm"
              title="Sign Out"
              style={{ color: "var(--text-muted)" }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
