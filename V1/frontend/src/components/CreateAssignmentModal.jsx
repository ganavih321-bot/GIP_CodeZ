import React, { useState } from "react";
import { X, FileCode, ShieldAlert, Clock, AlertCircle } from "lucide-react";
import { api } from "../services/api";

export default function CreateAssignmentModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("exam");
  const [isProctored, setIsProctored] = useState(true);
  const [timeLimit, setTimeLimit] = useState(60);
  const [maxStrikes, setMaxStrikes] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");
    try {
      const assignment = await api.assignments.create({
        title: title.trim(),
        description: description.trim(),
        type,
        is_proctored: isProctored,
        time_limit_minutes: parseInt(timeLimit, 10),
        max_strikes: parseInt(maxStrikes, 10)
      });
      onCreated(assignment);
      setTitle("");
      setDescription("");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create test.");
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
              <FileCode size={20} />
            </div>
            <div>
              <h3>Create Test</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Configure timing and anti-cheat settings. Add problems and assign students next.
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
            <label className="form-label">Test Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Midterm Coding Assessment: Python Algorithms"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Instructions / Description</label>
            <textarea
              className="form-textarea"
              placeholder="Rules, allowed libraries, proctoring notice for students..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Assessment Type</label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="exam">Proctored Exam</option>
                <option value="homework">Homework Assignment</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Time Limit (Minutes)</label>
              <input
                type="number"
                className="form-input"
                min="5"
                max="300"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Anti-cheat toggles */}
          <div style={{
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "8px",
            marginBottom: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={18} color="var(--primary)" />
                <span style={{ fontWeight: "600", fontSize: "13.5px" }}>Anti-Cheat Live Proctoring</span>
              </div>
              <input
                type="checkbox"
                checked={isProctored}
                onChange={(e) => setIsProctored(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--primary)" }}
              />
            </div>

            {isProctored && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                <p style={{ marginBottom: "8px" }}>
                  Enforces WebRTC live screen sharing, full-screen lock, clipboard prevention, and tab switch alerts.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "10px" }}>
                  <span>Max Warning Strikes:</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxStrikes}
                    onChange={(e) => setMaxStrikes(e.target.value)}
                    className="form-input"
                    style={{ width: "80px", padding: "4px 8px", fontSize: "12px" }}
                  />
                  <span style={{ color: "var(--text-muted)" }}>strikes before auto-submit</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Creating..." : "Create Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
