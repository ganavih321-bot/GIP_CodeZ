import React, { useState, useEffect } from "react";
import { X, UserPlus, AlertCircle, Upload, CheckCircle2 } from "lucide-react";
import { api } from "../services/api";

// Accepts one student per line as "email", "Name, email" or "email, Name" (CSV/TSV ok),
// or several comma/space separated emails on one line.
function parseStudentList(text) {
  const students = [];
  text.split(/\r?\n/).forEach((line, idx) => {
    const tokens = line.split(/[,;\t]/).map((t) => t.trim().replace(/^"|"$/g, "")).filter(Boolean);
    if (tokens.length === 0) return;
    const emails = tokens.flatMap((t) => t.split(/\s+/)).filter((t) => t.includes("@"));
    if (emails.length === 0) {
      // Skip a CSV header row such as "name,email"; report anything else as invalid
      if (idx === 0 && tokens.some((t) => /email/i.test(t))) return;
      students.push({ email: line.trim() });
    } else if (emails.length === 1) {
      const name = tokens.filter((t) => !t.includes("@")).join(" ");
      students.push({ email: emails[0], name: name || undefined });
    } else {
      emails.forEach((email) => students.push({ email }));
    }
  });
  return students;
}

export default function InviteStudentsModal({ isOpen, onClose, onInvited }) {
  const [text, setText] = useState("");
  const [tests, setTests] = useState([]);
  const [testIds, setTestIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setText("");
    setTestIds(new Set());
    setResult(null);
    setError("");
    api.assignments.list().then(setTests).catch(() => setTests([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const parsed = parseStudentList(text);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((content) => setText((prev) => (prev.trim() ? prev.trim() + "\n" : "") + content.trim()));
    e.target.value = "";
  };

  const toggleTest = (id) => {
    const next = new Set(testIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTestIds(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parsed.length === 0) return;

    setLoading(true);
    setError("");
    try {
      const res = await api.students.invite(parsed, [...testIds]);
      setResult(res);
      onInvited(res);
    } catch (err) {
      setError(err.message || "Failed to invite students.");
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
              <UserPlus size={20} />
            </div>
            <div>
              <h3>Invite Students</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Invited students sign in with the Google account for that email.
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

        {result ? (
          <div>
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              padding: "12px 14px",
              color: "#6ee7b7",
              fontSize: "13px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <CheckCircle2 size={16} />
              <span>
                Invited {result.invited.length} student{result.invited.length === 1 ? "" : "s"}
                {testIds.size > 0 && ` and assigned ${testIds.size} test${testIds.size === 1 ? "" : "s"}`}.
              </span>
            </div>
            {result.already_exists.length > 0 && (
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                <strong>Already registered ({result.already_exists.length}):</strong> {result.already_exists.join(", ")}
              </p>
            )}
            {result.invalid.length > 0 && (
              <p style={{ fontSize: "12.5px", color: "#fca5a5", marginBottom: "8px" }}>
                <strong>Invalid ({result.invalid.length}):</strong> {result.invalid.join(", ")}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button onClick={() => { setResult(null); setText(""); }} className="btn btn-secondary">
                Invite More
              </button>
              <button onClick={onClose} className="btn btn-primary">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="flex-between" style={{ marginBottom: "6px" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Student emails</label>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                  <Upload size={14} /> Upload CSV
                  <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFile} hidden />
                </label>
              </div>
              <textarea
                className="form-textarea"
                placeholder={"One per line, e.g.\nalice@gmail.com\nBob Kumar, bob@gmail.com\n\nOr paste: a@gmail.com, b@gmail.com"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                autoFocus
                style={{ fontFamily: "var(--font-code)", fontSize: "12.5px" }}
              />
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                {parsed.length} student{parsed.length === 1 ? "" : "s"} detected. CSV columns: name, email (header row optional).
              </p>
            </div>

            {tests.length > 0 && (
              <div className="form-group">
                <label className="form-label">Also assign tests (optional)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
                  {tests.map((t) => (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={testIds.has(t.id)}
                        onChange={() => toggleTest(t.id)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      {t.title}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading || parsed.length === 0} className="btn btn-primary">
                {loading ? "Inviting..." : `Invite ${parsed.length || ""} Student${parsed.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
