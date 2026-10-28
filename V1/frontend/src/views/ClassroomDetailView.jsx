import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import CreateAssignmentModal from "../components/CreateAssignmentModal";
import CreateQuestionModal from "../components/CreateQuestionModal";
import { 
  ArrowLeft, Copy, Check, Users, ShieldAlert, Plus, Play, Eye, 
  BarChart3, Clock, AlertTriangle, FileCode, CheckCircle2 
} from "lucide-react";

export default function ClassroomDetailView({ 
  classroom, 
  onBack, 
  onStartExam, 
  onMonitorExam, 
  onViewSubmissions 
}) {
  const { isTeacher } = useAuth();
  const [activeTab, setActiveTab] = useState("assignments");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Modals
  const [showCreateAssignModal, setShowCreateAssignModal] = useState(false);
  const [selectedAssignForQuestion, setSelectedAssignForQuestion] = useState(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.classrooms.getDetail(classroom.id);
      setDetail(data);
    } catch (err) {
      setError(err.message || "Failed to load classroom details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [classroom.id]);

  const handleCopyCode = () => {
    if (detail?.code) {
      navigator.clipboard.writeText(detail.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      {/* Back button */}
      <button 
        onClick={onBack}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: "20px" }}
      >
        <ArrowLeft size={16} /> Back to Classrooms
      </button>

      {/* Classroom Banner */}
      <div className="glass-panel" style={{
        background: "linear-gradient(135deg, rgba(79, 70, 229, 0.4) 0%, rgba(124, 58, 237, 0.25) 100%)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        padding: "32px",
        marginBottom: "28px",
        position: "relative"
      }}>
        <div className="flex-between" style={{ flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>
              {detail?.title || classroom.title}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "680px" }}>
              {detail?.description || classroom.description || "Course exercises and exams."}
            </p>
          </div>

          {/* Join Code Box */}
          <div style={{
            background: "rgba(10, 14, 23, 0.7)",
            border: "1px solid var(--border-light)",
            borderRadius: "12px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "16px"
          }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Classroom Join Code
              </span>
              <span style={{ fontSize: "1.4rem", fontFamily: "var(--font-code)", fontWeight: "700", color: "#a5b4fc" }}>
                {detail?.code || classroom.code}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="btn btn-secondary btn-sm"
              style={{ padding: "8px 12px" }}
            >
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        marginBottom: "24px"
      }}>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => setActiveTab("assignments")}
            style={{
              padding: "12px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "assignments" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "assignments" ? "#fff" : "var(--text-muted)",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <FileCode size={16} /> Exams & Coding Assessments
          </button>
          <button
            onClick={() => setActiveTab("students")}
            style={{
              padding: "12px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "students" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "students" ? "#fff" : "var(--text-muted)",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Users size={16} /> Students ({detail?.enrolled_students?.length || detail?.enrolled_students_count || 0})
          </button>
        </div>

        {/* Action Button for Teacher */}
        {isTeacher && activeTab === "assignments" && (
          <button
            onClick={() => setShowCreateAssignModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={16} /> Create Assessment
          </button>
        )}
      </div>

      {/* Tab: Assignments & Exams */}
      {activeTab === "assignments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {detail?.assignments?.length === 0 ? (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", marginBottom: "12px" }}>
                No assessments scheduled yet in this classroom.
              </p>
              {isTeacher && (
                <button onClick={() => setShowCreateAssignModal(true)} className="btn btn-primary">
                  <Plus size={16} /> Schedule First Exam
                </button>
              )}
            </div>
          ) : (
            detail?.assignments?.map((assign) => (
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
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <h3 style={{ fontSize: "1.15rem" }}>{assign.title}</h3>
                      {assign.is_proctored ? (
                        <span className="badge badge-danger">
                          <span className="live-indicator" style={{ width: "6px", height: "6px" }} />
                          Proctored (Anti-Cheat & WebRTC)
                        </span>
                      ) : (
                        <span className="badge badge-primary">Practice Homework</span>
                      )}
                    </div>

                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                      {assign.description || "Python programming assessment."}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <Clock size={14} /> {assign.time_limit_minutes || 60} mins
                      </span>
                      <span>•</span>
                      <span>{assign.questions?.length || 0} Coding Problems</span>
                      <span>•</span>
                      <span>Max strikes: {assign.max_strikes || 3}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {isTeacher ? (
                    <>
                      {/* Teacher Actions */}
                      <button
                        onClick={() => setSelectedAssignForQuestion(assign.id)}
                        className="btn btn-secondary btn-sm"
                        title="Add more problems to this assessment"
                      >
                        <Plus size={15} /> Add Problem
                      </button>

                      <button
                        onClick={() => onViewSubmissions(assign)}
                        className="btn btn-secondary btn-sm"
                      >
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
                          <Eye size={15} /> Live CCTV Monitor
                        </button>
                      )}
                    </>
                  ) : (
                    /* Student Action */
                    <button
                      onClick={() => onStartExam(assign)}
                      className="btn btn-success"
                      style={{ padding: "10px 20px" }}
                    >
                      <Play size={16} /> Enter Proctored Exam
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Students Roster */}
      {activeTab === "students" && (
        <div className="glass-panel" style={{ padding: "20px" }}>
          {detail?.enrolled_students?.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "20px" }}>
              No students enrolled yet. Share the course code <code>{detail?.code}</code> with your students.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {detail?.enrolled_students?.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "rgba(10, 14, 23, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                      fontSize: "13px"
                    }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: "600", fontSize: "14px", display: "block" }}>{s.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.email}</span>
                    </div>
                  </div>
                  <span className="badge badge-success">Enrolled</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateAssignmentModal
        isOpen={showCreateAssignModal}
        classroomId={classroom.id}
        onClose={() => setShowCreateAssignModal(false)}
        onCreated={() => fetchDetail()}
      />

      <CreateQuestionModal
        isOpen={!!selectedAssignForQuestion}
        assignmentId={selectedAssignForQuestion}
        onClose={() => setSelectedAssignForQuestion(null)}
        onCreated={() => fetchDetail()}
      />
    </div>
  );
}
