import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, ShieldAlert, Monitor, AlertTriangle, Send, 
  Maximize2, X, RefreshCw, Radio, UserCheck, ShieldOff 
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function TeacherMonitoringView({ assignment, onBack }) {
  const { user } = useAuth();
  const [students, setStudents] = useState({}); // student_id -> student object
  const [events, setEvents] = useState([]);
  const [selectedStudentForVideo, setSelectedStudentForVideo] = useState(null);
  const [warningModalStudent, setWarningModalStudent] = useState(null);
  const [warningText, setWarningText] = useState("");

  const wsRef = useRef(null);
  const peerConnectionsRef = useRef({}); // student_id -> RTCPeerConnection
  const videoRefs = useRef({}); // student_id -> HTMLVideoElement

  // 1. Fetch historical proctoring events on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const hist = await api.proctoring.getEvents(assignment.id);
        setEvents(hist || []);
      } catch (err) {
        console.error("Error loading proctoring history:", err);
      }
    }
    loadHistory();
  }, [assignment.id]);

  // 2. Connect to Proctoring WebSocket Room
  useEffect(() => {
    const wsUrl = api.proctoring.getWsUrl(assignment.id);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Teacher connected to Proctoring Room WebSocket");
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Initial room state from backend
        if (msg.type === "room_state") {
          const map = {};
          (msg.students || []).forEach((s) => {
            map[s.student_id] = s;
          });
          setStudents(map);
        }

        // Student joined
        else if (msg.type === "student_joined") {
          const st = msg.student;
          setStudents((prev) => ({ ...prev, [st.student_id]: st }));
        }

        // Student disconnected
        else if (msg.type === "student_left") {
          setStudents((prev) => {
            const copy = { ...prev };
            if (copy[msg.student_id]) {
              copy[msg.student_id].is_online = false;
              copy[msg.student_id].last_event = "Disconnected";
            }
            return copy;
          });
        }

        // Live Anti-Cheat Violation Alert!
        else if (msg.type === "violation_alert") {
          const newEvent = {
            id: Date.now(),
            student_id: msg.student_id,
            event_type: msg.event_type,
            strike_count: msg.strike_count,
            details: msg.details,
            timestamp: msg.timestamp || new Date().toISOString()
          };
          setEvents((prev) => [newEvent, ...prev]);

          setStudents((prev) => {
            const copy = { ...prev };
            if (copy[msg.student_id]) {
              copy[msg.student_id].current_strikes = msg.strike_count;
              copy[msg.student_id].last_event = `${msg.event_type}: ${msg.details}`;
              if (msg.event_type === "fullscreen_exit") {
                copy[msg.student_id].is_fullscreen = false;
              }
            }
            return copy;
          });
        }

        // WebRTC Offer received from student
        else if (msg.type === "webrtc_offer") {
          const studentId = msg.student_id;
          handleWebRTCOffer(studentId, msg.payload);
        }

        // ICE candidate from student
        else if (msg.type === "webrtc_ice_candidate") {
          const studentId = msg.student_id;
          const pc = peerConnectionsRef.current[studentId];
          if (pc && msg.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
          }
        }
      } catch (e) {
        console.error("Teacher WS message error:", e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    };
  }, [assignment.id]);

  // Handle incoming student WebRTC screen stream
  const handleWebRTCOffer = async (studentId, offerPayload) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
    peerConnectionsRef.current[studentId] = pc;

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const videoEl = videoRefs.current[studentId];
      if (videoEl) {
        videoEl.srcObject = remoteStream;
      }
      setStudents((prev) => {
        if (!prev[studentId]) return prev;
        return {
          ...prev,
          [studentId]: { ...prev[studentId], has_screen_stream: true }
        };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "teacher_ice_candidate",
          target_student_id: studentId,
          payload: event.candidate
        }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offerPayload));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "webrtc_answer",
        target_student_id: studentId,
        payload: answer
      }));
    }
  };

  // Send Remote Warning Message to Student
  const handleSendWarning = () => {
    if (!warningModalStudent || !warningText.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "teacher_warn",
        target_student_id: warningModalStudent.student_id,
        message: warningText.trim()
      }));
    }
    setWarningModalStudent(null);
    setWarningText("");
    alert("Warning transmitted to student screen.");
  };

  // Remote Force Submit Exam
  const handleForceSubmit = (studentId) => {
    if (window.confirm("Are you sure you want to force-submit this student's exam remotely?")) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "teacher_force_submit",
          target_student_id: studentId
        }));
      }
      alert("Force submit command issued to student.");
    }
  };

  const studentList = Object.values(students);
  const activeCount = studentList.filter((s) => s.is_online).length;
  const streamingCount = studentList.filter((s) => s.has_screen_stream).length;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#080c14",
      overflow: "hidden"
    }}>
      {/* Top Header */}
      <header style={{
        background: "rgba(13, 19, 33, 0.95)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={onBack} className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} /> Exit Monitor
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "1.25rem" }}>
                Live Proctoring Command Center
              </h2>
              <span className="badge badge-danger">
                <Radio size={12} className="spin" /> LIVE CCTV
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {assignment.title}
            </span>
          </div>
        </div>

        {/* Real-time stats pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12px",
            color: "#6ee7b7",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <UserCheck size={14} /> Active Students: <strong>{activeCount}</strong>
          </div>

          <div style={{
            background: "rgba(6, 182, 212, 0.15)",
            border: "1px solid rgba(6, 182, 212, 0.3)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12px",
            color: "#67e8f9",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <Monitor size={14} /> Screen Streams: <strong>{streamingCount}</strong>
          </div>

          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12px",
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <ShieldAlert size={14} /> Total Violations: <strong>{events.length}</strong>
          </div>
        </div>
      </header>

      {/* Main Command Center Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        flexGrow: 1,
        overflow: "hidden"
      }}>
        {/* Left: CCTV Video Grid of Student Screens */}
        <div style={{
          padding: "24px",
          overflowY: "auto",
          background: "#0a0e17"
        }}>
          {studentList.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "70vh",
              color: "var(--text-muted)",
              gap: "12px"
            }}>
              <Monitor size={48} color="var(--primary)" />
              <p style={{ fontSize: "15px" }}>Waiting for students to join the proctored exam...</p>
              <p style={{ fontSize: "12px" }}>
                Students taking this assessment will automatically appear here with their live screen feed.
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "20px"
            }}>
              {studentList.map((st) => (
                <div
                  key={st.student_id}
                  className="glass-panel"
                  style={{
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    border: (st.current_strikes || 0) > 0 ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid var(--border)",
                    boxShadow: (st.current_strikes || 0) > 0 ? "0 0 15px rgba(239, 68, 68, 0.2)" : "var(--shadow-md)"
                  }}
                >
                  {/* Card Header */}
                  <div style={{
                    padding: "10px 14px",
                    background: "#0f172a",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                    <div>
                      <span style={{ fontWeight: "700", fontSize: "13.5px", color: "#fff" }}>
                        {st.student_name}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                        {st.student_email}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span className={`badge ${
                      (st.current_strikes || 0) > 0 ? "badge-danger" :
                      st.has_screen_stream ? "badge-success" : "badge-warning"
                    }`}>
                      {(st.current_strikes || 0) > 0 ? `⚠️ ${st.current_strikes} Strikes` :
                       st.has_screen_stream ? "🟢 Streaming" : "🟡 Connected"}
                    </span>
                  </div>

                  {/* Video Screen Stream Area */}
                  <div style={{
                    position: "relative",
                    background: "#000000",
                    height: "220px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <video
                      ref={(el) => (videoRefs.current[st.student_id] = el)}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: st.has_screen_stream ? "block" : "none"
                      }}
                    />

                    {!st.has_screen_stream && (
                      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                        <Monitor size={32} style={{ marginBottom: "8px", opacity: 0.5 }} />
                        <p style={{ fontSize: "12px" }}>Awaiting student screen share stream...</p>
                      </div>
                    )}

                    {/* Enlarge overlay button */}
                    {st.has_screen_stream && (
                      <button
                        onClick={() => setSelectedStudentForVideo(st)}
                        title="Enlarge Screen"
                        className="btn btn-secondary btn-sm"
                        style={{
                          position: "absolute",
                          bottom: "10px",
                          right: "10px",
                          background: "rgba(0, 0, 0, 0.7)",
                          padding: "6px"
                        }}
                      >
                        <Maximize2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Card Controls & Last Event */}
                  <div style={{
                    padding: "12px 14px",
                    background: "#0c111d",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {st.last_event || "Active in exam"}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          setWarningModalStudent(st);
                          setWarningText("Please return to full-screen mode and focus on your code.");
                        }}
                        className="btn btn-warning btn-sm"
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                        title="Send warning message dialog to student"
                      >
                        <Send size={12} /> Warn
                      </button>

                      <button
                        onClick={() => handleForceSubmit(st.student_id)}
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                        title="Force submit student exam"
                      >
                        <ShieldOff size={12} /> Force Submit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Real-Time Violation Audit Ticker */}
        <div style={{
          borderLeft: "1px solid var(--border)",
          background: "#0d1321",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <ShieldAlert size={18} color="var(--danger)" />
            <span style={{ fontWeight: "700", fontSize: "13.5px", color: "#fff" }}>
              Live Anti-Cheat Feed
            </span>
          </div>

          <div style={{ flexGrow: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {events.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "12px", textAlign: "center", marginTop: "40px" }}>
                No anti-cheat violations detected.
              </p>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <div className="flex-between">
                    <span style={{
                      fontWeight: "700",
                      fontSize: "12px",
                      color: "#fca5a5",
                      textTransform: "uppercase"
                    }}>
                      {ev.event_type.replace("_", " ")}
                    </span>
                    <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-main)" }}>
                    {ev.details || "Student activity violation flagged."}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#a5b4fc" }}>
                      Student ID: {ev.student_id}
                    </span>
                    <span className="badge badge-danger" style={{ fontSize: "10px" }}>
                      Strike #{ev.strike_count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Enlarge Screen Inspection Modal */}
      {selectedStudentForVideo && (
        <div className="modal-overlay" onClick={() => setSelectedStudentForVideo(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "1000px", padding: "16px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-between" style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Monitor size={20} color="var(--primary)" />
                <h3 style={{ fontSize: "1.1rem" }}>
                  Screen Stream: {selectedStudentForVideo.student_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStudentForVideo(null)}
                className="btn btn-secondary btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: "#000",
              borderRadius: "10px",
              height: "580px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            }}>
              <video
                ref={(el) => {
                  if (el && videoRefs.current[selectedStudentForVideo.student_id]?.srcObject) {
                    el.srcObject = videoRefs.current[selectedStudentForVideo.student_id].srcObject;
                  }
                }}
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Warning Message Modal */}
      {warningModalStudent && (
        <div className="modal-overlay" onClick={() => setWarningModalStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: "16px" }}>
              <h3>Warn {warningModalStudent.student_name}</h3>
              <button onClick={() => setWarningModalStudent(null)} className="btn btn-secondary btn-sm">
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              This message will pop up immediately on the student's exam screen:
            </p>

            <textarea
              className="form-textarea"
              rows={3}
              value={warningText}
              onChange={(e) => setWarningText(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button onClick={() => setWarningModalStudent(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSendWarning} className="btn btn-warning">
                <Send size={15} /> Send Warning Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
