import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import CreateAssignmentModal from "../components/CreateAssignmentModal";
import CreateQuestionModal from "../components/CreateQuestionModal";
import AssignStudentsModal from "../components/AssignStudentsModal";
import {
  ShieldAlert, Plus, Play, Eye, BarChart3, Clock, FileCode, Users,
  AlertCircle, RefreshCw, Trash2
} from "lucide-react";

export default function TestsView({ onStartExam, onMonitorExam, onViewSubmissions }) {
  const { user, isAdmin } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssignForQuestion, setSelectedAssignForQuestion] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchTests = async () => {
    setLoading(true);
    setError("");
    try {
      setTests(await api.assignments.list());
    } catch (err) {
      setError(err.message || "Failed to load tests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [user]);

  const handleDelete = async (id) => {
    try {
      await api.assignments.delete(id);
      setConfirmDeleteId(null);
      fetchTests();
    } catch (err) {
      setError(err.message || "Failed to delete test.");
    }
  };

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      {/* Top Banner */}
      <div className="flex-between" style={{ marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "6px" }}>
            {isAdmin ? "Tests" : `Welcome, ${user?.name}!`}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {isAdmin
              ? "Create coding tests, assign them to students, and monitor proctored attempts live."
              : "These are the tests your admin has assigned to you."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={fetchTests} className="btn btn-secondary" title="Refresh list">
            <RefreshCw size={15} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <Plus size={16} /> Create Test
            </button>
          )}
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
          <span>Loading tests...</span>
        </div>
      ) : tests.length === 0 ? (
        <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "12px" }}>
            {isAdmin ? "No tests created yet." : "No tests have been assigned to you yet."}
          </p>
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <Plus size={16} /> Create First Test
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {tests.map((assign) => (
            <div
              key={assign.id}
              className="glass-panel"
              style={{
                padding: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{
                  background: assign.is_proctored ? "rgba(239, 68, 68, 0.15)" : "rgba(99, 102, 241, 0.15)",
                  border: `1px solid ${assign.is_proctored ? "rgba(239, 68, 68, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
                  borderRadius: "12px",
                  padding: "12px",
                  color: assign.is_proctored ? "var(--danger)" : "var(--primary)"
                }}>
                  {assign.is_proctored ? <ShieldAlert size={24} /> : <FileCode size={24} />}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: "1.15rem" }}>{assign.title}</h3>
                    {assign.is_proctored ? (
                      <span className="badge badge-danger">
                        <span className="live-indicator" style={{ width: "6px", height: "6px" }} />
                        Proctored
                      </span>
                    ) : (
                      <span className="badge badge-primary">Practice</span>
                    )}
                  </div>

                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", maxWidth: "720px" }}>
                    {assign.description || "Python programming test."}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "var(--text-muted)", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Clock size={14} /> {assign.time_limit_minutes || 60} mins
                    </span>
                    <span>•</span>
                    <span>{assign.questions?.length || 0} Coding Problems</span>
                    <span>•</span>
                    <span>Max strikes: {assign.max_strikes || 3}</span>
                    {isAdmin && (
                      <>
                        <span>•</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Users size={14} /> {assign.assigned_students?.length || 0} assigned
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => setSelectedAssignForQuestion(assign.id)}
                      className="btn btn-secondary btn-sm"
                      title="Add more problems to this test"
                    >
                      <Plus size={15} /> Add Problem
                    </button>

                    <button onClick={() => setAssignTarget(assign)} className="btn btn-secondary btn-sm">
                      <Users size={15} /> Assign Students
                    </button>

                    <button onClick={() => onViewSubmissions(assign)} className="btn btn-secondary btn-sm">
                      <BarChart3 size={15} /> Submissions
                    </button>

                    {assign.is_proctored && (
                      <button
                        onClick={() => onMonitorExam(assign)}
                        className="btn btn-danger btn-sm"
                        style={{
                          background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                          boxShadow: "0 0 15px rgba(239, 68, 68, 0.4)"
                        }}
                      >
                        <Eye size={15} /> Live Monitor
                      </button>
                    )}

                    {confirmDeleteId === assign.id ? (
                      <>
                        <button onClick={() => handleDelete(assign.id)} className="btn btn-danger btn-sm">
                          Delete test
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="btn btn-secondary btn-sm">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(assign.id)}
                        className="btn btn-secondary btn-sm"
                        title="Delete test"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => {
                      // Fullscreen must be requested inside the click itself (browser rule)
                      if (assign.is_proctored && !document.fullscreenElement) {
                        document.documentElement.requestFullscreen?.().catch(() => {});
                      }
                      onStartExam(assign);
                    }}
                    className="btn btn-success"
                    style={{ padding: "10px 20px" }}
                  >
                    <Play size={16} /> Start Test
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateAssignmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchTests()}
      />

      <CreateQuestionModal
        isOpen={!!selectedAssignForQuestion}
        assignmentId={selectedAssignForQuestion}
        onClose={() => setSelectedAssignForQuestion(null)}
        onCreated={() => fetchTests()}
      />

      <AssignStudentsModal
        assignment={assignTarget}
        onClose={() => setAssignTarget(null)}
        onSaved={() => fetchTests()}
      />
    </div>
  );
}
