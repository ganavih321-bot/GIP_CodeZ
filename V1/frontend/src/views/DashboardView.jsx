import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import ClassroomCard from "../components/ClassroomCard";
import JoinClassModal from "../components/JoinClassModal";
import CreateClassModal from "../components/CreateClassModal";
import { Plus, KeyRound, BookOpen, AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardView({ onSelectClassroom }) {
  const { user, isTeacher } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchClassrooms = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.classrooms.list();
      setClassrooms(data);
    } catch (err) {
      setError(err.message || "Failed to load classrooms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, [user]);

  const handleClassJoined = (newClass) => {
    fetchClassrooms();
  };

  const handleClassCreated = (newClass) => {
    fetchClassrooms();
  };

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      {/* Top Banner */}
      <div className="flex-between" style={{
        marginBottom: "32px",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "6px" }}>
            Welcome back, {user?.name}!
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {isTeacher 
              ? "Manage your classrooms, schedule proctored coding assessments, and monitor live submissions."
              : "Access your enrolled courses, practice Python coding problems, and take proctored exams."}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={fetchClassrooms}
            className="btn btn-secondary"
            title="Refresh list"
          >
            <RefreshCw size={15} />
          </button>

          {isTeacher ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus size={16} /> Create Classroom
            </button>
          ) : (
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn btn-primary"
            >
              <KeyRound size={16} /> Join with Code
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

      {/* Classrooms Grid */}
      {loading ? (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px 0",
          color: "var(--text-muted)",
          gap: "10px"
        }}>
          <RefreshCw size={20} className="spin" />
          <span>Loading classrooms...</span>
        </div>
      ) : classrooms.length === 0 ? (
        <div className="glass-panel" style={{
          textAlign: "center",
          padding: "60px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px"
        }}>
          <div style={{
            background: "rgba(99, 102, 241, 0.1)",
            padding: "16px",
            borderRadius: "50%",
            color: "var(--primary)"
          }}>
            <BookOpen size={36} />
          </div>
          <div>
            <h3>No classrooms found</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              {isTeacher
                ? "Click 'Create Classroom' above to set up your first course and generate an invite code."
                : "Ask your instructor for a course code and click 'Join with Code' to enroll."}
            </p>
          </div>
          {isTeacher ? (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <Plus size={16} /> Create First Classroom
            </button>
          ) : (
            <button onClick={() => setShowJoinModal(true)} className="btn btn-primary">
              <KeyRound size={16} /> Join Demo Course (PY101A)
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "24px"
        }}>
          {classrooms.map((c) => (
            <ClassroomCard
              key={c.id}
              classroom={c}
              isTeacher={isTeacher}
              onSelect={onSelectClassroom}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <JoinClassModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={handleClassJoined}
      />
      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleClassCreated}
      />
    </div>
  );
}
