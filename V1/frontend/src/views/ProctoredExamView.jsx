import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import confetti from "canvas-confetti";
import { 
  Play, Send, Clock, ShieldAlert, AlertOctagon, CheckCircle2, 
  XCircle, ChevronRight, Terminal, Minimize2, Maximize2, Shield,
  AlertCircle, EyeOff, Check, X
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ProctoredExamView({ assignment, onExit }) {
  const { user } = useAuth();
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [codeMap, setCodeMap] = useState({}); // questionId -> code string
  const [loading, setLoading] = useState(true);

  // Proctoring states
  const [strikes, setStrikes] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenShared, setIsScreenShared] = useState(false);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState(
    (assignment.time_limit_minutes || 60) * 60
  );

  // Execution & Testing console
  const [consoleTab, setConsoleTab] = useState("testcases"); // "testcases" | "results" | "output"
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [customInput, setCustomInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);

  const wsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const strikesRef = useRef(0);
  strikesRef.current = strikes;

  // 1. Fetch Assignment detail
  useEffect(() => {
    async function loadExam() {
      try {
        const data = await api.assignments.getDetail(assignment.id);
        const qs = data.questions || [];
        setQuestions(qs);
        
        // Initialize starter code map
        const initialCodes = {};
        qs.forEach((q) => {
          initialCodes[q.id] = q.starter_code;
        });
        setCodeMap(initialCodes);
      } catch (err) {
        console.error("Error loading exam:", err);
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [assignment.id]);

  // 2. Countdown Timer
  useEffect(() => {
    if (secondsRemaining <= 0) {
      handleFinalSubmit("Time Expired");
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // Format time
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  // 3. Screen Sharing setup & WebRTC broadcast
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      setScreenStream(stream);
      setIsScreenShared(true);

      // Handle user stopping screen share from browser banner
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenShared(false);
        triggerViolation("screen_disconnected", "Screen sharing was stopped by the student.");
      };

      // Initiate WebRTC stream to teacher
      initWebRTCStream(stream);
    } catch (err) {
      console.warn("Screen share declined or unsupported:", err);
      triggerViolation("screen_share_denied", "Student did not permit screen sharing.");
    }
  };

  // 4. WebSocket & WebRTC Setup
  useEffect(() => {
    const wsUrl = api.proctoring.getWsUrl(assignment.id);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to Proctoring Room WebSocket");
      // If screen stream already active, create offer
      if (screenStream) {
        initWebRTCStream(screenStream);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "webrtc_answer" && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(msg.payload)
          );
        } else if (msg.type === "teacher_ice_candidate" && peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(msg.payload)
          );
        } else if (msg.type === "teacher_warn") {
          setWarningMessage(msg.message || "The teacher has issued a warning.");
          setShowWarningModal(true);
        } else if (msg.type === "teacher_force_submit") {
          handleFinalSubmit("Submitted remotely by instructor.");
        }
      } catch (e) {
        console.error("WS error parsing:", e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [assignment.id]);

  const initWebRTCStream = async (stream) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "webrtc_ice_candidate",
          payload: event.candidate
        }));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    wsRef.current.send(JSON.stringify({
      type: "webrtc_offer",
      payload: offer
    }));
  };

  // 5. Anti-Cheat: Fullscreen Enforcement & Tab Switch Detection
  const triggerViolation = (eventType, details) => {
    const nextStrikes = strikesRef.current + 1;
    setStrikes(nextStrikes);

    const strikeMsg = `Strike ${nextStrikes} of ${assignment.max_strikes || 3}: ${details}`;
    setWarningMessage(strikeMsg);
    setShowWarningModal(true);

    // Broadcast to WebSocket & Log to DB
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "violation",
        event_type: eventType,
        strike_count: nextStrikes,
        details: details
      }));
    }

    api.proctoring.recordEvent({
      assignment_id: assignment.id,
      event_type: eventType,
      strike_count: nextStrikes,
      details: details,
      severity: nextStrikes >= (assignment.max_strikes || 3) ? "high" : "medium"
    }).catch(console.error);

    // Auto-submit if strikes exceeded
    if (nextStrikes >= (assignment.max_strikes || 3)) {
      setTimeout(() => {
        handleFinalSubmit("Exceeded maximum allowed anti-cheat strikes.");
      }, 3000);
    }
  };

  // Enter Fullscreen
  const enterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setIsFullscreen(true);
    setShowWarningModal(false);
  };

  useEffect(() => {
    if (!assignment.is_proctored) return;

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        triggerViolation("fullscreen_exit", "Exited full-screen exam mode.");
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "fullscreen_restored" }));
      }
    };

    // Tab switch & window blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation("tab_switch", "Student switched away from the exam tab.");
      }
    };

    const handleWindowBlur = () => {
      triggerViolation("window_blur", "Exam window lost focus.");
    };

    // Block keyboard shortcuts (F12, Devtools, Alt+Tab, etc.)
    const handleKeyDown = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"))
      ) {
        e.preventDefault();
        triggerViolation("shortcut_blocked", `Blocked inspector shortcut: ${e.key}`);
      }
    };

    // Prevent context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [assignment.is_proctored]);

  // 6. Code Execution ("Run Code" against sample cases)
  const currentQuestion = questions[activeQuestionIndex];
  const currentCode = currentQuestion ? (codeMap[currentQuestion.id] || "") : "";

  const handleCodeChange = (newCode) => {
    if (!currentQuestion) return;
    setCodeMap((prev) => ({ ...prev, [currentQuestion.id]: newCode }));
  };

  const handleRunCode = async () => {
    if (!currentQuestion || isRunning) return;
    setIsRunning(true);
    setConsoleTab("results");
    setRunResults(null);

    try {
      const res = await api.code.run(
        currentQuestion.id,
        currentCode,
        useCustomInput ? customInput : null
      );
      setRunResults(res);
    } catch (err) {
      setRunResults({
        status: "Failed",
        total_tests: 1,
        passed_tests: 0,
        results: [{
          status: "Runtime Error",
          stderr: err.message,
          execution_time_ms: 0
        }]
      });
    } finally {
      setIsRunning(false);
    }
  };

  // 7. Code Submission (Grade against all test cases)
  const handleSubmitCode = async () => {
    if (!currentQuestion || isSubmitting) return;
    setIsSubmitting(true);
    setConsoleTab("results");
    setSubmitResult(null);

    try {
      const res = await api.code.submit(
        assignment.id,
        currentQuestion.id,
        currentCode
      );
      setSubmitResult(res);

      if (res.status === "Accepted") {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      alert("Submission error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Exam submission
  const handleFinalSubmit = (reason = "Submitted by student") => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    alert(`Exam completed: ${reason}`);
    onExit();
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading proctored environment...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#080c14",
      color: "var(--text-main)",
      overflow: "hidden",
      userSelect: "none"
    }}>
      {/* Top Exam Navigation Bar */}
      <header style={{
        background: "rgba(13, 19, 33, 0.95)",
        borderBottom: "1px solid var(--border)",
        height: "56px",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10
      }}>
        {/* Left: Assignment Title & Proctoring status */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: "700", fontSize: "15px", color: "#fff" }}>
              {assignment.title}
            </span>
            {assignment.is_proctored && (
              <span className="badge badge-danger" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span className="live-indicator" style={{ width: "6px", height: "6px" }} />
                Proctored
              </span>
            )}
          </div>

          {/* Strikes Counter */}
          {assignment.is_proctored && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: strikes > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${strikes > 0 ? "rgba(239, 68, 68, 0.4)" : "var(--border)"}`,
              borderRadius: "8px",
              padding: "4px 10px",
              fontSize: "12px",
              color: strikes > 0 ? "#fca5a5" : "var(--text-secondary)"
            }}>
              <ShieldAlert size={14} color={strikes > 0 ? "#ef4444" : "var(--text-muted)"} />
              <span>Strikes: <strong>{strikes}</strong> / {assignment.max_strikes || 3}</span>
            </div>
          )}

          {/* Screen Share Prompt Button if inactive */}
          {assignment.is_proctored && !isScreenShared && (
            <button
              onClick={startScreenShare}
              className="btn btn-warning btn-sm"
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              <AlertOctagon size={13} /> Enable Screen Share Stream
            </button>
          )}
        </div>

        {/* Center: Question Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => {
                setActiveQuestionIndex(idx);
                setRunResults(null);
                setSubmitResult(null);
              }}
              className="btn btn-sm"
              style={{
                background: idx === activeQuestionIndex ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                color: idx === activeQuestionIndex ? "#fff" : "var(--text-secondary)",
                borderRadius: "6px",
                padding: "4px 12px",
                fontWeight: "600",
                fontSize: "12px",
                border: idx === activeQuestionIndex ? "1px solid var(--primary-glow)" : "1px solid var(--border)"
              }}
            >
              Problem {idx + 1}
            </button>
          ))}
        </div>

        {/* Right: Timer & Exit Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: secondsRemaining < 300 ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontFamily: "var(--font-code)",
            fontWeight: "700",
            fontSize: "13px",
            color: secondsRemaining < 300 ? "#ef4444" : "#a5b4fc"
          }}>
            <Clock size={15} />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to finish and submit your entire exam?")) {
                handleFinalSubmit("Submitted by student");
              }
            }}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: "700" }}
          >
            Finish Exam
          </button>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "42% 58%",
        flexGrow: 1,
        overflow: "hidden"
      }}>
        {/* Left Pane: Problem Description & Sample Cases */}
        <div style={{
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          padding: "24px",
          background: "#0c111d",
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          {currentQuestion ? (
            <>
              {/* Question Header */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span className={`badge ${
                    currentQuestion.difficulty === "Easy" ? "diff-easy" :
                    currentQuestion.difficulty === "Hard" ? "diff-hard" : "diff-medium"
                  }`}>
                    {currentQuestion.difficulty}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Points: {currentQuestion.points}
                  </span>
                </div>
                <h2 style={{ fontSize: "1.4rem" }}>
                  {activeQuestionIndex + 1}. {currentQuestion.title}
                </h2>
              </div>

              {/* Problem Statement (Markdown style) */}
              <div style={{
                fontSize: "13.5px",
                lineHeight: "1.6",
                color: "var(--text-main)",
                whiteSpace: "pre-wrap",
                background: "rgba(255, 255, 255, 0.02)",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid var(--border)"
              }}>
                {currentQuestion.problem_statement}
              </div>

              {/* Constraints */}
              {currentQuestion.constraints && (
                <div>
                  <h4 style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Constraints
                  </h4>
                  <pre className="code-block" style={{ fontSize: "12px" }}>
                    {currentQuestion.constraints}
                  </pre>
                </div>
              )}

              {/* Sample Test Cases View */}
              <div>
                <h4 style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                  Sample Test Cases
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(currentQuestion.sample_test_cases || []).map((tc, idx) => (
                    <div
                      key={tc.id || idx}
                      style={{
                        background: "rgba(10, 14, 23, 0.6)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "12px"
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "#a5b4fc", marginBottom: "8px" }}>
                        Sample Case #{idx + 1}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Input:</span>
                          <pre className="code-block">{tc.input_data || "(empty)"}</pre>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Expected Output:</span>
                          <pre className="code-block">{tc.expected_output}</pre>
                        </div>
                      </div>
                      {tc.explanation && (
                        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "6px" }}>
                          <em>Explanation: {tc.explanation}</em>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Select a question to begin.</p>
          )}
        </div>

        {/* Right Pane: Monaco Code Editor + Interactive Test Console */}
        <div style={{
          display: "grid",
          gridTemplateRows: "60% 40%",
          overflow: "hidden"
        }}>
          {/* Top: Monaco Code Editor */}
          <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border)" }}>
            <div style={{
              background: "#0f172a",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#94a3b8" }}>
                <Terminal size={14} color="#6366f1" />
                <span style={{ fontFamily: "var(--font-code)", fontWeight: "600" }}>solution.py</span>
                <span className="badge badge-primary" style={{ fontSize: "10px" }}>Python 3.12</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: "6px" }}
                >
                  <Play size={13} color="#10b981" />
                  {isRunning ? "Running..." : "Run Code"}
                </button>
                <button
                  onClick={handleSubmitCode}
                  disabled={isSubmitting}
                  className="btn btn-success btn-sm"
                  style={{ gap: "6px" }}
                >
                  <Send size={13} />
                  {isSubmitting ? "Evaluating..." : "Submit Code"}
                </button>
              </div>
            </div>

            <div style={{ flexGrow: 1, position: "relative" }}>
              <Editor
                height="100%"
                defaultLanguage="python"
                language="python"
                theme="vs-dark"
                value={currentCode}
                onChange={handleCodeChange}
                options={{
                  fontSize: 13.5,
                  fontFamily: "'Fira Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  lineNumbers: "on",
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  contextmenu: false // Disable right-click in editor for anti-cheat
                }}
              />
            </div>
          </div>

          {/* Bottom: Tabbed Test Console & Output Viewer */}
          <div style={{
            background: "#0a0e17",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Console Tabs */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#0d1321",
              borderBottom: "1px solid var(--border)",
              padding: "0 16px"
            }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setConsoleTab("testcases")}
                  style={{
                    padding: "8px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: consoleTab === "testcases" ? "2px solid var(--primary)" : "2px solid transparent",
                    color: consoleTab === "testcases" ? "#fff" : "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Custom Test Input
                </button>
                <button
                  onClick={() => setConsoleTab("results")}
                  style={{
                    padding: "8px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: consoleTab === "results" ? "2px solid var(--primary)" : "2px solid transparent",
                    color: consoleTab === "results" ? "#fff" : "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  Test Results
                  {(runResults || submitResult) && (
                    <span style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: (runResults?.status === "Success" || submitResult?.status === "Accepted") ? "#10b981" : "#ef4444"
                    }} />
                  )}
                </button>
              </div>

              {/* Status pill in console */}
              {submitResult && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className={`badge ${submitResult.status === "Accepted" ? "badge-success" : "badge-danger"}`}>
                    {submitResult.status === "Accepted" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {submitResult.status} ({submitResult.passed_cases}/{submitResult.total_cases} Passed)
                  </span>
                  <span style={{ fontSize: "11px", color: "#a5b4fc", fontWeight: "700" }}>
                    Score: {submitResult.score} pts
                  </span>
                </div>
              )}
            </div>

            {/* Console Content */}
            <div style={{ flexGrow: 1, overflowY: "auto", padding: "16px" }}>
              {consoleTab === "testcases" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="checkbox"
                      id="customInputToggle"
                      checked={useCustomInput}
                      onChange={(e) => setUseCustomInput(e.target.checked)}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <label htmlFor="customInputToggle" style={{ fontSize: "12.5px", cursor: "pointer" }}>
                      Provide custom stdin input for testing:
                    </label>
                  </div>
                  <textarea
                    disabled={!useCustomInput}
                    className="form-textarea"
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: "12px",
                      minHeight: "70px",
                      opacity: useCustomInput ? 1 : 0.5
                    }}
                    placeholder="Enter custom input text to test with..."
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                  />
                </div>
              )}

              {consoleTab === "results" && (
                <div>
                  {isRunning || isSubmitting ? (
                    <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      <p>Executing test cases in Python sandbox...</p>
                    </div>
                  ) : submitResult ? (
                    /* Submission Grading View */
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div className="flex-between" style={{ marginBottom: "8px" }}>
                        <span style={{ fontWeight: "700", fontSize: "13px" }}>
                          Full Assessment Test Suite
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {submitResult.passed_cases} of {submitResult.total_cases} passed
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
                        {submitResult.results.map((r, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: r.status === "Passed" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              border: `1px solid ${r.status === "Passed" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                              borderRadius: "6px",
                              padding: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}
                          >
                            <span style={{ fontSize: "11px", fontWeight: "600" }}>
                              {r.is_hidden ? `Hidden #${idx + 1}` : `Case #${idx + 1}`}
                            </span>
                            {r.status === "Passed" ? (
                              <Check size={14} color="#34d399" />
                            ) : (
                              <X size={14} color="#f87171" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : runResults ? (
                    /* Run Code Results View */
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {runResults.results.map((r, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "rgba(13, 19, 33, 0.7)",
                            border: `1px solid ${r.status === "Passed" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                            borderRadius: "8px",
                            padding: "12px"
                          }}
                        >
                          <div className="flex-between" style={{ marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className={`badge ${r.status === "Passed" ? "badge-success" : "badge-danger"}`}>
                                {r.status}
                              </span>
                              <span style={{ fontSize: "12px", fontWeight: "600" }}>
                                Case #{idx + 1}
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {r.execution_time_ms} ms
                            </span>
                          </div>

                          {/* Stderr / Runtime error */}
                          {r.stderr && (
                            <pre className="code-block" style={{ color: "#f87171", marginBottom: "8px" }}>
                              {r.stderr}
                            </pre>
                          )}

                          {/* Diff Viewer (Expected vs Actual) */}
                          {r.diff ? (
                            <div>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                Output Diff (Expected vs Actual):
                              </span>
                              <pre className="code-block" style={{ marginTop: "4px" }}>
                                {r.diff.split("\n").map((line, lIdx) => (
                                  <div
                                    key={lIdx}
                                    style={{
                                      color: line.startsWith("+") ? "#34d399" : line.startsWith("-") ? "#f87171" : "#cbd5e1"
                                    }}
                                  >
                                    {line}
                                  </div>
                                ))}
                              </pre>
                            </div>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                              <div>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Your Output:</span>
                                <pre className="code-block">{r.actual_output || "(no output)"}</pre>
                              </div>
                              {r.expected_output !== null && (
                                <div>
                                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Expected Output:</span>
                                  <pre className="code-block">{r.expected_output}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      Click <strong>Run Code</strong> to test your solution against sample inputs, or <strong>Submit Code</strong> to run full assessment test cases.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Anti-Cheat Fullscreen / Violation Alert Modal */}
      {showWarningModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ textAlign: "center", border: "2px solid #ef4444" }}>
            <div style={{
              width: "60px",
              height: "60px",
              background: "rgba(239, 68, 68, 0.2)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              boxShadow: "0 0 25px rgba(239, 68, 68, 0.5)"
            }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>

            <h2 style={{ fontSize: "1.4rem", color: "#fca5a5", marginBottom: "8px" }}>
              Exam Security Violation Flagged
            </h2>

            <p style={{ color: "var(--text-main)", fontSize: "14px", marginBottom: "16px" }}>
              {warningMessage || "An anti-cheat violation occurred (tab switch or fullscreen exit)."}
            </p>

            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "12.5px",
              color: "var(--text-secondary)",
              marginBottom: "24px"
            }}>
              This event has been recorded with a timestamp and sent to the instructor's live dashboard.
              Full screen is required for the duration of the exam.
            </div>

            <button
              onClick={enterFullscreen}
              className="btn btn-danger btn-lg"
              style={{ width: "100%" }}
            >
              <Maximize2 size={18} /> Re-Enter Fullscreen & Resume Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
