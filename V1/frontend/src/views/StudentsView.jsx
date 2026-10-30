import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import InviteStudentsModal from "../components/InviteStudentsModal";
import { UserPlus, Users, AlertCircle, RefreshCw, Search, Trash2 } from "lucide-react";

export default function StudentsView() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  const fetchStudents = async () => {
    setLoading(true);
    setError("");
    try {
      setStudents(await api.students.list());
    } catch (err) {
      setError(err.message || "Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleRemove = async (id) => {
    try {
      await api.students.remove(id);
      setConfirmRemoveId(null);
      fetchStudents();
    } catch (err) {
      setError(err.message || "Failed to remove student.");
    }
  };

  const q = query.trim().toLowerCase();
  const visible = students.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  );
  const activeCount = students.filter((s) => s.status === "active").length;

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      <div className="flex-between" style={{ marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "6px" }}>Students</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {students.length} invited · {activeCount} signed in. Only invited emails can sign in with Google.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={fetchStudents} className="btn btn-secondary" title="Refresh list">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowInvite(true)} className="btn btn-primary">
            <UserPlus size={16} /> Invite Students
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "10px",
          padding: "14px 18px",
          color: "#fca5a5",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "var(--text-muted)", gap: "10px" }}>
          <RefreshCw size={20} className="spin" />
          <span>Loading students...</span>
        </div>
      ) : students.length === 0 ? (
        <div className="glass-panel" style={{
          textAlign: "center",
          padding: "60px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px"
        }}>
          <div style={{ background: "rgba(99, 102, 241, 0.1)", padding: "16px", borderRadius: "50%", color: "var(--primary)" }}>
            <Users size={36} />
          </div>
          <div>
            <h3>No students yet</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Paste a list of emails or upload a CSV to invite students in bulk.
            </p>
          </div>
          <button onClick={() => setShowInvite(true)} className="btn btn-primary">
            <UserPlus size={16} /> Invite Students
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ position: "relative", marginBottom: "16px", maxWidth: "360px" }}>
            <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: "34px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {visible.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  padding: "12px 16px",
                  background: "rgba(10, 14, 23, 0.5)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                  ) : (
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #06b6d4, #0284c7)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "13px",
                      flexShrink: 0
                    }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: "600", fontSize: "14px", display: "block" }}>{s.name}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.email}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {s.assigned_tests_count} test{s.assigned_tests_count === 1 ? "" : "s"}
                  </span>
                  <span className={`badge ${s.status === "active" ? "badge-success" : "badge-warning"}`}>
                    {s.status === "active" ? "Active" : "Invited"}
                  </span>
                  {confirmRemoveId === s.id ? (
                    <>
                      <button onClick={() => handleRemove(s.id)} className="btn btn-danger btn-sm">
                        Remove
                      </button>
                      <button onClick={() => setConfirmRemoveId(null)} className="btn btn-secondary btn-sm">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(s.id)}
                      className="btn btn-secondary btn-sm"
                      title="Remove student and revoke access"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {visible.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px" }}>No matches.</p>
            )}
          </div>
        </div>
      )}

      <InviteStudentsModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvited={fetchStudents}
      />
    </div>
  );
}
