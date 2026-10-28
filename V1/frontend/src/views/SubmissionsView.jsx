import React, { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Code, RefreshCw, FileText } from "lucide-react";
import { api } from "../services/api";

export default function SubmissionsView({ assignment, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await api.submissions.getAssignmentSubmissions(assignment.id);
      setSubmissions(data || []);
      if (data && data.length > 0) {
        setSelectedSubmission(data[0]);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [assignment.id]);

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      {/* Back button */}
      <div className="flex-between" style={{ marginBottom: "20px" }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Back to Classroom
        </button>
        <button onClick={fetchSubmissions} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Submissions
        </button>
      </div>

      {/* Header */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.6rem", marginBottom: "6px" }}>
          Submissions & Grading Review
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "13.5px" }}>
          {assignment.title} • {submissions.length} Total Student Submissions
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
          Loading student submissions...
        </div>
      ) : submissions.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px" }}>
          <FileText size={40} color="var(--primary)" style={{ marginBottom: "12px", opacity: 0.6 }} />
          <p style={{ color: "var(--text-secondary)" }}>
            No student has submitted this assessment yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Submissions List */}
          <div className="glass-panel" style={{ padding: "16px", overflowY: "auto", maxHeight: "650px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "14px", color: "var(--text-secondary)" }}>
              Student Submissions ({submissions.length})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {submissions.map((sub) => {
                const isSelected = selectedSubmission?.id === sub.id;
                const isAccepted = sub.status === "Accepted";
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    style={{
                      background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(10, 14, 23, 0.6)",
                      border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "var(--transition)"
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: "6px" }}>
                      <span style={{ fontWeight: "700", fontSize: "14px", color: "#fff" }}>
                        {sub.student?.name || `Student #${sub.student_id}`}
                      </span>
                      <span className={`badge ${isAccepted ? "badge-success" : "badge-danger"}`}>
                        {isAccepted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {sub.status}
                      </span>
                    </div>

                    <div className="flex-between" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>Passed: <strong>{sub.passed_cases}/{sub.total_cases}</strong> cases</span>
                      <span style={{ color: "#a5b4fc", fontWeight: "700" }}>{sub.score} pts</span>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                      Submitted: {new Date(sub.submitted_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission Details Inspector */}
          <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {selectedSubmission ? (
              <>
                <div className="flex-between">
                  <div>
                    <h3 style={{ fontSize: "1.1rem" }}>
                      {selectedSubmission.student?.name || `Student #${selectedSubmission.student_id}`}
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {selectedSubmission.student?.email}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: "800", color: "#a5b4fc" }}>
                      {selectedSubmission.score} <span style={{ fontSize: "13px", fontWeight: "400" }}>pts</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {selectedSubmission.passed_cases}/{selectedSubmission.total_cases} test cases passed
                    </span>
                  </div>
                </div>

                {/* Code Block */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    <Code size={14} color="var(--primary)" />
                    <span>Submitted Python Solution:</span>
                  </div>
                  <pre
                    className="code-block"
                    style={{
                      maxHeight: "300px",
                      overflowY: "auto",
                      fontSize: "12.5px"
                    }}
                  >
                    {selectedSubmission.code}
                  </pre>
                </div>

                {/* Test results breakdown */}
                <div>
                  <h4 style={{ fontSize: "13px", marginBottom: "8px", color: "var(--text-secondary)" }}>
                    Test Results Breakdown
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                    {(selectedSubmission.test_results || []).map((tr, idx) => (
                      <div
                        key={tr.id || idx}
                        style={{
                          background: "rgba(10, 14, 23, 0.6)",
                          border: `1px solid ${tr.status === "passed" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          borderRadius: "8px",
                          padding: "10px",
                          fontSize: "12px"
                        }}
                      >
                        <div className="flex-between">
                          <span style={{ fontWeight: "600", color: tr.status === "passed" ? "#34d399" : "#f87171" }}>
                            Test Case #{idx + 1}: {tr.status.toUpperCase()}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                            {tr.execution_time_ms} ms
                          </span>
                        </div>
                        {tr.error_message && (
                          <pre style={{ color: "#fca5a5", fontSize: "11px", marginTop: "4px" }}>
                            {tr.error_message}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>Select a submission to inspect.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
