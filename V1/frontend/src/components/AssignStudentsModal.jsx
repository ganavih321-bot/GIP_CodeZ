import React, { useState, useEffect } from "react";
import { X, UserCheck, AlertCircle, Search } from "lucide-react";
import { api } from "../services/api";

export default function AssignStudentsModal({ assignment, onClose, onSaved }) {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!assignment) return;
    setQuery("");
    setError("");
    setSelected(new Set((assignment.assigned_students || []).map((s) => s.id)));
    setLoading(true);
    api.students
      .list()
      .then(setStudents)
      .catch((err) => setError(err.message || "Failed to load students."))
      .finally(() => setLoading(false));
  }, [assignment]);

  if (!assignment) return null;

  const q = query.trim().toLowerCase();
  const visible = students.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  );
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAllVisible = () => {
    const next = new Set(selected);
    visible.forEach((s) => (allVisibleSelected ? next.delete(s.id) : next.add(s.id)));
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await api.assignments.updateAssignees(assignment.id, [...selected]);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update assigned students.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              background: "rgba(16, 185, 129, 0.15)",
              padding: "8px",
              borderRadius: "8px",
              color: "var(--success)"
            }}>
              <UserCheck size={20} />
            </div>
            <div>
              <h3>Assign Students</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{assignment.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "6px" }}>
            <X size={16} />
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
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ position: "relative", marginBottom: "12px" }}>
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

        <div className="flex-between" style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              style={{ accentColor: "var(--primary)" }}
            />
            Select all{q ? " matching" : ""}
          </label>
          <span>{selected.size} selected</span>
        </div>

        <div style={{
          maxHeight: "320px",
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          marginBottom: "20px"
        }}>
          {loading ? (
            <p style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>Loading students...</p>
          ) : visible.length === 0 ? (
            <p style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
              {students.length === 0 ? "No students yet. Invite students from the Students tab." : "No matches."}
            </p>
          ) : (
            visible.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: selected.has(s.id) ? "rgba(99, 102, 241, 0.08)" : "transparent"
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  style={{ accentColor: "var(--primary)" }}
                />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13.5px", fontWeight: "600" }}>{s.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.email}</div>
                </div>
                <span className={`badge ${s.status === "active" ? "badge-success" : "badge-warning"}`}>
                  {s.status === "active" ? "Active" : "Invited"}
                </span>
              </label>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || loading} className="btn btn-primary">
            {saving ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
