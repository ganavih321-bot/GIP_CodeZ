import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import confetti from "canvas-confetti";
import {
  Play, Send, Clock, ShieldAlert, AlertOctagon, CheckCircle2,
  XCircle, Terminal, Maximize2, Monitor, Lock, ArrowLeft, Volume2,
  Check, X, AlertTriangle
} from "lucide-react";
import { api } from "../services/api";

// Violations within this window count as one incident (e.g. blur + visibilitychange on a tab switch)
const STRIKE_DEBOUNCE_MS = 2500;

// In fullscreen the page should span the whole screen; a narrower viewport means a browser
// side panel (Gemini, Copilot, ...) is docked next to it, or the page is zoomed in.
function isSidePanelOpen() {
  return !!document.fullscreenElement && window.innerWidth < window.screen.width * 0.97;
}

const BUZZER_SECONDS = 2;

// 2-second pulsing buzzer generated with Web Audio (no sound file needed)
function playBuzzer(ctx) {
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const start = ctx.currentTime;
  const end = start + BUZZER_SECONDS;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 440;

  // Pulse on/off every 0.2s so it sounds like an alarm buzzer rather than a flat tone
  gain.gain.setValueAtTime(0, start);
  for (let t = start; t < end; t += 0.2) {
    // Full page volume. A web page can't raise or unmute the system volume, hence the sound check before the test.
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.setValueAtTime(0, Math.min(t + 0.14, end));
  }

  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end);
}

// Grab one frame of the shared screen as a JPEG data URL (max 1280px wide)
async function captureScreenFrame(stream) {
  const track = stream?.getVideoTracks()[0];
  if (!track || track.readyState !== "live") return null;

  let source;
  let width;
  let height;
  if (window.ImageCapture) {
    // Works even when the exam tab is in the background (the usual case right after a strike)
    source = await new ImageCapture(track).grabFrame();
    width = source.width;
    height = source.height;
  } else {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    source = video;
    width = video.videoWidth;
    height = video.videoHeight;
  }

  const scale = Math.min(1, 1280 / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();
  if (source.srcObject) source.srcObject = null;
  return canvas.toDataURL("image/jpeg", 0.6);
}

// Wait a moment so the frame shows what the student switched to (e.g. the Gemini panel)
const SCREENSHOT_DELAY_MS = 800;

export default function ProctoredExamView({ assignment, onExit }) {
  const proctored = assignment.is_proctored;
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [codeMap, setCodeMap] = useState({}); // questionId -> code string
  const [loading, setLoading] = useState(true);

  // Exam lifecycle: setup (proctored pre-checks) -> active -> done
  const [phase, setPhase] = useState("setup");
  const [attempt, setAttempt] = useState(null); // server state: strikes, allowed_strikes, status
  const [pageError, setPageError] = useState("");
  const [doneReason, setDoneReason] = useState("");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Proctoring states
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [hasFocus, setHasFocus] = useState(document.hasFocus());
  const [sidePanelOpen, setSidePanelOpen] = useState(isSidePanelOpen());
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [beginning, setBeginning] = useState(false);

  // Timer state (seeded from the server when the attempt starts)
  const [secondsRemaining, setSecondsRemaining] = useState(null);

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
  const phaseRef = useRef(phase);
  const attemptRef = useRef(attempt);
  const lastStrikeAtRef = useRef(0);
  const lastLoggedAtRef = useRef(0);
  const finishingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const screenStreamRef = useRef(null);
  const [soundChecked, setSoundChecked] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);

  // The setup sound check also unlocks audio (browsers need a click first)
  const playTestSound = () => {
    if (!audioCtxRef.current && window.AudioContext) {
      audioCtxRef.current = new AudioContext();
    }
    playBuzzer(audioCtxRef.current);
    setSoundPlayed(true);
  };

  // Close the audio context when leaving the exam
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
    attemptRef.current = attempt;
  }, [phase, attempt]);

  const strikes = attempt?.strikes ?? 0;
  const allowedStrikes = attempt?.allowed_strikes ?? assignment.max_strikes ?? 3;
  const isLocked = attempt?.status === "locked";

  // 1. Fetch Assignment detail
  useEffect(() => {
    async function loadExam() {
      try {
        const [data, existing] = await Promise.all([
          api.assignments.getDetail(assignment.id),
          api.attempts.getMine(assignment.id)
        ]);
        if (existing?.status === "submitted") {
          setDoneReason("You have already submitted this test.");
          setPhase("done");
        }
        const qs = data.questions || [];
        setQuestions(qs);

        // Initialize starter code map
        const initialCodes = {};
        qs.forEach((q) => {
          initialCodes[q.id] = q.starter_code;
        });
        setCodeMap(initialCodes);
      } catch (err) {
        setPageError(err.message || "Failed to load the test.");
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [assignment.id]);

  // Start (or resume) the attempt on the server; this starts the timer
  const beginExam = async () => {
    // Browsers only allow audio after a user gesture: unlock it on this click for the strike buzzer
    if (proctored && !audioCtxRef.current && window.AudioContext) {
      audioCtxRef.current = new AudioContext();
    }
    setBeginning(true);
    try {
      const res = await api.attempts.start(assignment.id);
      if (res.status === "submitted") {
        setDoneReason("You have already submitted this test.");
        setPhase("done");
        return;
      }
      setAttempt(res);
      setSecondsRemaining(res.seconds_remaining);
      setPhase("active");
    } catch (err) {
      setPageError(err.message || "Could not start the test.");
    } finally {
      setBeginning(false);
    }
  };

  // Practice (non-proctored) tests skip the setup checks
  useEffect(() => {
    if (!proctored && !loading && !pageError && phase === "setup") beginExam();
  }, [proctored, loading]);

  // 2. Countdown Timer
  useEffect(() => {
    if (phase !== "active" || secondsRemaining === null) return;
    if (secondsRemaining <= 0) {
      handleFinalSubmit("Time expired.");
      return;
    }
    const timer = setTimeout(() => setSecondsRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsRemaining, phase]);

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
        video: { cursor: "always", displaySurface: "monitor" },
        audio: false
      });
      setScreenStream(stream);
      screenStreamRef.current = stream;
      setIsScreenShared(true);

      // Handle user stopping screen share from browser banner
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenShared(false);
        reportViolation("screen_disconnected", "Screen sharing was stopped by the student.");
      };

      // Initiate WebRTC stream to the admin
      initWebRTCStream(stream);
    } catch (err) {
      console.warn("Screen share declined or unsupported:", err);
      reportViolation("screen_share_denied", "Student did not permit screen sharing.");
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
          setWarningMessage(msg.message || "The admin has issued a warning.");
          setShowWarningModal(true);
        } else if (msg.type === "teacher_force_submit") {
          handleFinalSubmit("Submitted remotely by the admin.");
        } else if (msg.type === "attempt_update") {
          const prev = attemptRef.current;
          setAttempt(msg.attempt);
          if (prev?.status === "locked" && msg.attempt.status === "in_progress") {
            setWarningMessage(`Your admin reset your strikes. You now have ${msg.attempt.allowed_strikes} strike(s) allowed.`);
            setShowWarningModal(true);
          }
        }
      } catch (e) {
        console.error("WS error parsing:", e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [assignment.id]);

  // Stop screen capture when leaving the exam
  useEffect(() => {
    return () => {
      screenStream?.getTracks().forEach((t) => t.stop());
    };
  }, [screenStream]);

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

  // 5. Anti-Cheat: violations are counted by the server, which locks the attempt at the limit
  async function reportViolation(eventType, details, { countsAsStrike = true } = {}) {
    if (phaseRef.current !== "active" || attemptRef.current?.status !== "in_progress") return;

    const now = Date.now();
    if (countsAsStrike) {
      if (now - lastStrikeAtRef.current < STRIKE_DEBOUNCE_MS) return;
      lastStrikeAtRef.current = now;
    } else {
      if (now - lastLoggedAtRef.current < 5000) return;
      lastLoggedAtRef.current = now;
    }

    try {
      const res = await api.proctoring.recordEvent({
        assignment_id: assignment.id,
        event_type: eventType,
        details,
        counts_as_strike: countsAsStrike
      });
      setAttempt(res.attempt);

      if (countsAsStrike) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "violation",
            event_type: eventType,
            strike_count: res.attempt.strikes,
            details
          }));
        }
        playBuzzer(audioCtxRef.current);

        // Attach a screenshot of the shared screen so the admin sees what happened
        const eventId = res.event.id;
        setTimeout(async () => {
          try {
            const image = await captureScreenFrame(screenStreamRef.current);
            if (image) await api.proctoring.uploadScreenshot(eventId, image);
          } catch (err) {
            console.error("Failed to capture violation screenshot:", err);
          }
        }, SCREENSHOT_DELAY_MS);

        setWarningMessage(`Strike ${res.attempt.strikes} of ${res.attempt.allowed_strikes}: ${details}`);
        setShowWarningModal(true);
      }
    } catch (err) {
      console.error("Failed to record proctoring event:", err);
    }
  }

  // Enter Fullscreen
  const enterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    setShowWarningModal(false);
  };

  // Fullscreen / focus / side-panel tracking (always on, so the setup checklist stays accurate)
  useEffect(() => {
    if (!proctored) return;

    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      setSidePanelOpen(isSidePanelOpen());
      if (!active) {
        reportViolation("fullscreen_exit", "Exited full-screen exam mode.");
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "fullscreen_restored" }));
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation("tab_switch", "Switched away from the exam tab.");
      }
    };

    const handleWindowBlur = () => {
      setHasFocus(false);
      reportViolation("window_blur", "Exam window lost focus (another app, window or browser panel was used).");
    };
    const handleWindowFocus = () => setHasFocus(true);

    const checkSidePanel = () => {
      const open = isSidePanelOpen();
      setSidePanelOpen((wasOpen) => {
        if (open && !wasOpen) {
          reportViolation("side_panel_open", "A browser side panel (e.g. Gemini/Copilot) was opened or the page was zoomed.");
        }
        return open;
      });
    };
    const sidePanelTimer = setInterval(checkSidePanel, 1000);

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("resize", checkSidePanel);

    return () => {
      clearInterval(sidePanelTimer);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("resize", checkSidePanel);
    };
  }, [proctored]);

  // Clipboard, drag & drop, shortcuts and zoom lockdown. Capture phase, so the code editor never sees them.
  useEffect(() => {
    if (!proctored) return;

    const blockClipboard = (e) => {
      e.preventDefault();
      e.stopPropagation();
      reportViolation("clipboard_blocked", `Blocked ${e.type} attempt.`, { countsAsStrike: false });
    };

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (key === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(key)) || (mod && key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation("shortcut_blocked", `Blocked inspector shortcut: ${e.key}`);
        return;
      }
      if (mod && ["c", "x", "v", "insert"].includes(key) || (e.shiftKey && key === "insert")) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation("clipboard_blocked", "Blocked copy/paste shortcut.", { countsAsStrike: false });
        return;
      }
      // Print, save, find-in-page and zoom
      if (mod && ["p", "s", "f", "+", "=", "-", "0"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const blockZoomWheel = (e) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const handleContextMenu = (e) => e.preventDefault();
    const blockDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const opts = { capture: true };
    ["copy", "cut", "paste"].forEach((t) => document.addEventListener(t, blockClipboard, opts));
    ["dragstart", "drop"].forEach((t) => document.addEventListener(t, blockDrag, opts));
    window.addEventListener("keydown", handleKeyDown, opts);
    window.addEventListener("wheel", blockZoomWheel, { capture: true, passive: false });
    document.addEventListener("contextmenu", handleContextMenu, opts);

    return () => {
      ["copy", "cut", "paste"].forEach((t) => document.removeEventListener(t, blockClipboard, opts));
      ["dragstart", "drop"].forEach((t) => document.removeEventListener(t, blockDrag, opts));
      window.removeEventListener("keydown", handleKeyDown, opts);
      window.removeEventListener("wheel", blockZoomWheel, { capture: true });
      document.removeEventListener("contextmenu", handleContextMenu, opts);
    };
  }, [proctored]);

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
    setSubmitResult(null);

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
    setRunResults(null);

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
      // Shown in the console instead of alert(): a dialog would steal focus and count as a strike
      setRunResults({
        status: "Failed",
        total_tests: 1,
        passed_tests: 0,
        results: [{
          status: "Submission Error",
          stderr: err.message,
          execution_time_ms: 0
        }]
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Exam submission
  async function handleFinalSubmit(reason = "Submitted by student.") {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setShowFinishConfirm(false);
    setShowWarningModal(false);
    try {
      if (phaseRef.current === "active") await api.attempts.finish(assignment.id);
    } catch (err) {
      console.error("Failed to finish attempt:", err);
    }
    screenStream?.getTracks().forEach((t) => t.stop());
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setDoneReason(reason);
    setPhase("done");
  }

  // ---------- Full-page states (the problem & code are not rendered, so nothing can be read) ----------

  const fullPage = (children) => (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "#080c14",
      userSelect: "none"
    }}>
      <div className="glass-panel" style={{ maxWidth: "560px", width: "100%", padding: "32px" }}>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading proctored environment...</p>
      </div>
    );
  }

  if (pageError) {
    return fullPage(
      <>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>Can't open this test</h2>
        <p style={{ color: "#fca5a5", fontSize: "14px", marginBottom: "20px" }}>{pageError}</p>
        <button onClick={onExit} className="btn btn-secondary"><ArrowLeft size={16} /> Back to Tests</button>
      </>
    );
  }

  if (phase === "done") {
    return fullPage(
      <div style={{ textAlign: "center" }}>
        <CheckCircle2 size={44} color="#10b981" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>Test finished</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>{doneReason}</p>
        <button onClick={onExit} className="btn btn-primary"><ArrowLeft size={16} /> Back to Tests</button>
      </div>
    );
  }

  if (phase === "setup") {
    if (!proctored) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
          <p style={{ color: "var(--text-muted)" }}>Starting test...</p>
        </div>
      );
    }
    const checks = [
      {
        ok: isScreenShared,
        label: "Share your entire screen",
        hint: "Pick \"Entire screen\" in the browser dialog.",
        action: !isScreenShared && (
          <button onClick={startScreenShare} className="btn btn-secondary btn-sm"><Monitor size={14} /> Share screen</button>
        )
      },
      {
        ok: isFullscreen,
        label: "Enter full screen",
        hint: "The test runs in full screen only.",
        action: !isFullscreen && (
          <button onClick={enterFullscreen} className="btn btn-secondary btn-sm"><Maximize2 size={14} /> Full screen</button>
        )
      },
      {
        ok: isFullscreen && !sidePanelOpen,
        label: "Close browser side panels, zoom at 100%",
        hint: "Close Gemini, Copilot or any other side panel. Press Ctrl+0 to reset zoom."
      },
      {
        ok: soundChecked,
        label: "Sound on",
        hint: "Unmute and turn up your volume. A buzzer sounds on every strike.",
        action: !soundChecked && (
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={playTestSound} className="btn btn-secondary btn-sm"><Volume2 size={14} /> Play test sound</button>
            {soundPlayed && (
              <button onClick={() => setSoundChecked(true)} className="btn btn-success btn-sm"><Check size={14} /> I heard it</button>
            )}
          </div>
        )
      }
    ];
    const ready = checks.every((c) => c.ok);
    return fullPage(
      <>
        <h2 style={{ fontSize: "1.4rem", marginBottom: "6px" }}>{assignment.title}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "18px" }}>
          {assignment.time_limit_minutes || 60} minutes · {questions.length} problems · {allowedStrikes} strikes allowed.
          The timer starts when you click Begin.
        </p>
        <div style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "10px",
          padding: "12px 14px",
          fontSize: "12.5px",
          color: "var(--text-secondary)",
          marginBottom: "18px",
          lineHeight: 1.6
        }}>
          Leaving full screen, switching tabs or apps, opening a browser side panel (Gemini, Copilot, ...)
          or using developer tools counts as a strike. Copy and paste are disabled. When you reach the strike
          limit your test is locked until your admin unlocks it. Your screen is visible to the admin.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
          {checks.map((c) => (
            <div key={c.label} className="flex-between" style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              gap: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                {c.ok ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#6b7280" />}
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: "600" }}>{c.label}</div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{c.hint}</div>
                </div>
              </div>
              {c.action}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
          <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); onExit(); }} className="btn btn-secondary">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={beginExam} disabled={!ready || beginning} className="btn btn-success">
            <Play size={16} /> {beginning ? "Starting..." : "Begin Test"}
          </button>
        </div>
      </>
    );
  }

  if (isLocked) {
    return fullPage(
      <div style={{ textAlign: "center" }}>
        <Lock size={44} color="#ef4444" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "1.4rem", color: "#fca5a5", marginBottom: "8px" }}>Test locked</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
          You reached the strike limit ({strikes} of {allowedStrikes}). Your work is saved.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Stay on this page. It unlocks automatically when your admin resets your strikes.
          The timer keeps running ({secondsRemaining !== null ? formatTime(Math.max(0, secondsRemaining)) : "--:--"} left).
        </p>
      </div>
    );
  }

  const securityIssue = proctored && (
    !isFullscreen ? "You left full screen."
      : sidePanelOpen ? "A browser side panel is open (e.g. Gemini/Copilot) or the page is zoomed."
      : !hasFocus ? "The test window isn't focused."
      : null
  );

  if (securityIssue) {
    return fullPage(
      <div style={{ textAlign: "center" }}>
        <AlertTriangle size={44} color="#ef4444" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "1.4rem", color: "#fca5a5", marginBottom: "8px" }}>Test hidden</h2>
        <p style={{ color: "var(--text-main)", fontSize: "14px", marginBottom: "8px" }}>{securityIssue}</p>
        {warningMessage && (
          <p style={{ color: "#fca5a5", fontSize: "13px", marginBottom: "8px" }}>{warningMessage}</p>
        )}
        <p style={{ color: "var(--text-muted)", fontSize: "12.5px", marginBottom: "22px" }}>
          Strikes: {strikes} / {allowedStrikes}. Close side panels, set zoom to 100% (Ctrl+0), then return to full screen.
        </p>
        <button onClick={() => { setHasFocus(document.hasFocus()); enterFullscreen(); }} className="btn btn-danger btn-lg" style={{ width: "100%" }}>
          <Maximize2 size={18} /> Return to Full Screen
        </button>
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
              <span>Strikes: <strong>{strikes}</strong> / {allowedStrikes}</span>
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
            background: secondsRemaining !== null && secondsRemaining < 300 ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontFamily: "var(--font-code)",
            fontWeight: "700",
            fontSize: "13px",
            color: secondsRemaining !== null && secondsRemaining < 300 ? "#ef4444" : "#a5b4fc"
          }}>
            <Clock size={15} />
            <span>{formatTime(Math.max(0, secondsRemaining ?? 0))}</span>
          </div>

          <button
            onClick={() => setShowFinishConfirm(true)}
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
                  contextmenu: false, // Disable right-click in editor for anti-cheat
                  dragAndDrop: false
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

      {/* Strike / admin warning modal */}
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
              Exam Security Notice
            </h2>

            <p style={{ color: "var(--text-main)", fontSize: "14px", marginBottom: "16px" }}>
              {warningMessage}
            </p>

            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "12.5px",
              color: "var(--text-secondary)",
              marginBottom: "24px"
            }}>
              Strikes: {strikes} / {allowedStrikes}. Every event is recorded and visible to your admin.
            </div>

            <button
              onClick={enterFullscreen}
              className="btn btn-danger btn-lg"
              style={{ width: "100%" }}
            >
              <Check size={18} /> I Understand, Continue
            </button>
          </div>
        </div>
      )}

      {/* Finish confirmation (in-page: native confirm() dialogs steal focus and would count as a strike) */}
      {showFinishConfirm && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowFinishConfirm(false)}>
          <div className="modal-content" style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: "1.3rem", marginBottom: "8px" }}>Finish the test?</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "22px" }}>
              Make sure you've clicked Submit Code on each problem. You can't come back after finishing.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setShowFinishConfirm(false)} className="btn btn-secondary">Keep Working</button>
              <button onClick={() => handleFinalSubmit("Submitted by student.")} className="btn btn-primary">Finish Test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
