import React, { useState } from "react";
import { X, BookPlus, AlertCircle } from "lucide-react";
import { api } from "../services/api";

export default function CreateClassModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");
    try {
      const classroom = await api.classrooms.create({
        title: title.trim(),
        description: description.trim()
      });
      setTitle("");
      setDescription("");
      onCreated(classroom);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create classroom.");
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
              <BookPlus size={20} />
            </div>
            <div>
              <h3>Create Classroom</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                A unique 6-character join code will be generated automatically
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
            <label className="form-label">Course / Classroom Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. CS202: Advanced Data Structures in Python"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Course Description</label>
            <textarea
              className="form-textarea"
              placeholder="Brief course objectives, schedule, or instructions for students..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Creating..." : "Create Classroom"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
