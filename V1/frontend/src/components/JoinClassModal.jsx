import React, { useState } from "react";
import { X, KeyRound, AlertCircle } from "lucide-react";
import { api } from "../services/api";

export default function JoinClassModal({ isOpen, onClose, onJoined }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError("");
    try {
      const classroom = await api.classrooms.join(code.trim());
      setCode("");
      onJoined(classroom);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to join classroom. Check code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              background: "rgba(99, 102, 241, 0.15)",
              padding: "8px",
              borderRadius: "8px",
              color: "var(--primary)"
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Join a Classroom</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Ask your teacher for the 6-character class code
              </p>
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Class Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. PY101A"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={10}
              required
              autoFocus
              style={{
                letterSpacing: "0.15em",
                fontFamily: "var(--font-code)",
                fontSize: "16px",
                textTransform: "uppercase"
              }}
            />
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginBottom: "20px"
          }}>
            <strong>Tip:</strong> You can try the demo class code <code>PY101A</code> to access pre-seeded proctored Python exams.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Joining..." : "Join Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
