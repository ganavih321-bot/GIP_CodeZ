import React from "react";
import { useAuth } from "../context/AuthContext";
import { Terminal, Shield, LogOut, FileCode, Users } from "lucide-react";

export default function Navbar({ currentView, onNavigate }) {
  const { user, logout, isAdmin } = useAuth();

  const tabs = isAdmin
    ? [
        { view: "tests", label: "Tests", icon: FileCode },
        { view: "students", label: "Students", icon: Users }
      ]
    : [{ view: "tests", label: "My Tests", icon: FileCode }];

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
          onClick={() => onNavigate("tests")}
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
          {tabs.map(({ view, label, icon: Icon }) => {
            const active = currentView === view;
            return (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className={`btn ${active ? "btn-secondary" : ""}`}
                style={{
                  background: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
                  color: active ? "#a5b4fc" : "var(--text-secondary)",
                  border: active ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent"
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Right side Profile & Quick Demo Switcher */}
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ width: "28px", height: "28px", borderRadius: "50%" }}
                />
              ) : (
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: isAdmin ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "linear-gradient(135deg, #06b6d4, #0891b2)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "12px"
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#fff", lineHeight: 1.2 }}>
                  {user.name}
                </span>
                <span style={{
                  fontSize: "10px",
                  color: isAdmin ? "#a5b4fc" : "#67e8f9",
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
