import React, { useState } from "react";
import { Copy, Check, Users, FileCode, ArrowRight } from "lucide-react";

export default function ClassroomCard({ classroom, onSelect, isTeacher }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(classroom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate distinct elegant gradient based on classroom ID
  const gradients = [
    "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
    "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
    "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
  ];
  const bgGradient = gradients[classroom.id % gradients.length];

  return (
    <div
      onClick={() => onSelect(classroom)}
      className="glass-panel"
      style={{
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        transition: "transform 0.2s, box-shadow 0.2s",
        position: "relative"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
    >
      {/* Header Banner */}
      <div style={{
        background: bgGradient,
        padding: "20px 24px",
        position: "relative",
        borderBottom: "1px solid rgba(255, 255, 255, 0.15)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <h3 style={{
            fontSize: "1.2rem",
            fontWeight: "700",
            color: "#ffffff",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            lineHeight: 1.3
          }}>
            {classroom.title}
          </h3>

          {/* Join Code Badge */}
          <button
            onClick={handleCopyCode}
            title="Click to copy join code"
            style={{
              background: "rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              padding: "4px 8px",
              color: "#ffffff",
              fontSize: "12px",
              fontFamily: "var(--font-code)",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              transition: "background 0.2s"
            }}
          >
            <span>{classroom.code}</span>
            {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
          </button>
        </div>

        <p style={{
          fontSize: "12.5px",
          color: "rgba(255, 255, 255, 0.85)",
          fontWeight: "500"
        }}>
          Teacher: {classroom.teacher?.name || "Professor"}
        </p>
      </div>

      {/* Body Content */}
      <div style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexGrow: 1,
        gap: "16px"
      }}>
        <p style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden"
        }}>
          {classroom.description || "No description provided for this classroom."}
        </p>

        {/* Footer Meta */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "14px",
          borderTop: "1px solid var(--border)",
          fontSize: "12px",
          color: "var(--text-muted)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Users size={14} color="#a5b4fc" />
              {classroom.enrolled_students_count || 0} Students
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <FileCode size={14} color="#67e8f9" />
              {classroom.assignments?.length || 0} Exams
            </span>
          </div>

          <span style={{
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontWeight: "600"
          }}>
            View <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </div>
  );
}
