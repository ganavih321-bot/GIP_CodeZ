import React, { useState } from "react";
import { X, Plus, Trash2, Eye, EyeOff, Code, AlertCircle } from "lucide-react";
import { api } from "../services/api";

export default function CreateQuestionModal({ isOpen, assignmentId, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [points, setPoints] = useState(100);
  const [problemStatement, setProblemStatement] = useState("");
  const [starterCode, setStarterCode] = useState(
    "import sys\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    main()\n"
  );
  const [constraints, setConstraints] = useState("- 1 <= N <= 10^5\n- Time limit: 5 seconds");
  const [testCases, setTestCases] = useState([
    { input_data: "2 7 11 15\n9", expected_output: "0 1", is_hidden: false, explanation: "Sample case 1" },
    { input_data: "3 2 4\n6", expected_output: "1 2", is_hidden: true, explanation: "Hidden case" }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleAddTestCase = () => {
    setTestCases([
      ...testCases,
      { input_data: "", expected_output: "", is_hidden: false, explanation: "" }
    ]);
  };

  const handleRemoveTestCase = (index) => {
    setTestCases(testCases.filter((_, idx) => idx !== index));
  };

  const handleUpdateTestCase = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !problemStatement.trim()) return;

    setLoading(true);
    setError("");
    try {
      const q = await api.questions.create(assignmentId, {
        title: title.trim(),
        difficulty,
        points: parseInt(points, 10),
        problem_statement: problemStatement.trim(),
        starter_code: starterCode,
        constraints: constraints.trim(),
        test_cases: testCases.map((tc, idx) => ({
          input_data: tc.input_data,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden,
          explanation: tc.explanation,
          order_index: idx
        }))
      });
      onCreated(q);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create question.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: "780px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              background: "rgba(99, 102, 241, 0.15)",
              padding: "8px",
              borderRadius: "8px",
              color: "var(--primary)"
            }}>
              <Code size={20} />
            </div>
            <div>
              <h3>Add Coding Problem</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Define problem details, starter code, and public/hidden test suites
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Problem Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Invert Binary Tree"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Points</label>
              <input
                type="number"
                className="form-input"
                min="10"
                max="500"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Problem Statement (Markdown supported) *</label>
            <textarea
              className="form-textarea"
              placeholder="Describe the problem, input format, output format, examples..."
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Starter Code (Python)</label>
              <textarea
                className="form-textarea"
                style={{ fontFamily: "var(--font-code)", fontSize: "12.5px" }}
                value={starterCode}
                onChange={(e) => setStarterCode(e.target.value)}
                rows={4}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Constraints</label>
              <textarea
                className="form-textarea"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {/* Test Cases Builder */}
          <div style={{ marginTop: "16px", marginBottom: "20px" }}>
            <div className="flex-between" style={{ marginBottom: "12px" }}>
              <h4 style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Test Cases Suite ({testCases.length})</span>
                <span className="badge badge-primary">Public & Hidden</span>
              </h4>
              <button
                type="button"
                onClick={handleAddTestCase}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={14} /> Add Test Case
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {testCases.map((tc, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(10, 14, 23, 0.6)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div className="flex-between">
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                      Test Case #{index + 1}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <label style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        color: tc.is_hidden ? "#fca5a5" : "#6ee7b7"
                      }}>
                        <input
                          type="checkbox"
                          checked={tc.is_hidden}
                          onChange={(e) => handleUpdateTestCase(index, "is_hidden", e.target.checked)}
                          style={{ accentColor: "var(--primary)" }}
                        />
                        {tc.is_hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        {tc.is_hidden ? "Hidden from students" : "Public sample"}
                      </label>
                      {testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTestCase(index)}
                          className="btn btn-sm"
                          style={{ color: "var(--danger)", padding: "4px" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Input (stdin):</span>
                      <textarea
                        className="form-textarea"
                        style={{ fontFamily: "var(--font-code)", fontSize: "12px", minHeight: "55px" }}
                        placeholder="e.g. 2 7 11 15\n9"
                        value={tc.input_data}
                        onChange={(e) => handleUpdateTestCase(index, "input_data", e.target.value)}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Expected Output (stdout):</span>
                      <textarea
                        className="form-textarea"
                        style={{ fontFamily: "var(--font-code)", fontSize: "12px", minHeight: "55px" }}
                        placeholder="e.g. 0 1"
                        value={tc.expected_output}
                        onChange={(e) => handleUpdateTestCase(index, "expected_output", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Saving..." : "Add Problem to Exam"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
