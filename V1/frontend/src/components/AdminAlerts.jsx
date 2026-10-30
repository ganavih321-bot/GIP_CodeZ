import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, Bell, ImageOff, Lock } from "lucide-react";
import { api } from "../services/api";

const MAX_ALERTS = 6;
const SCREENSHOT_WAIT_MS = 8000;
const NOTIFY_PROMPT_KEY = "gip_notify_prompt_dismissed";

const EVENT_LABELS = {
  fullscreen_exit: "Left full screen",
  tab_switch: "Switched tabs",
  window_blur: "Switched to another app or window",
  side_panel_open: "Opened a browser side panel (e.g. Gemini)",
  shortcut_blocked: "Tried developer tools",
  screen_disconnected: "Stopped screen sharing",
  screen_share_denied: "Refused screen sharing"
};

function readPromptDismissed() {
  try {
    return localStorage.getItem(NOTIFY_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

// Live strike pop-ups for admins, shown on every page
export default function AdminAlerts() {
  const [alerts, setAlerts] = useState([]); // newest first
  const [enlarged, setEnlarged] = useState(null); // image data URL
  const [now, setNow] = useState(Date.now());
  const [notifyPermission, setNotifyPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [promptDismissed, setPromptDismissed] = useState(readPromptDismissed);
  const wsRef = useRef(null);

  // Connect to the admin alert feed, reconnecting if the connection drops
  useEffect(() => {
    let closed = false;
    let retryTimer = null;

    const connect = () => {
      const ws = new WebSocket(api.proctoring.getAdminAlertsWsUrl());
      wsRef.current = ws;

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "violation") {
          setAlerts((prev) => [{ ...msg, image: null, receivedAt: Date.now() }, ...prev].slice(0, MAX_ALERTS));

          if (typeof Notification !== "undefined" && Notification.permission === "granted" &&
              (document.hidden || !document.hasFocus())) {
            new Notification(`Strike ${msg.strikes}/${msg.allowed_strikes}: ${msg.student_name}`, {
              body: `${EVENT_LABELS[msg.event_type] || msg.event_type} · ${msg.assignment_title}`,
              tag: `gip-strike-${msg.event_id}`,
              requireInteraction: true
            });
          }
        } else if (msg.type === "violation_screenshot") {
          setAlerts((prev) => prev.map((a) => (a.event_id === msg.event_id ? { ...a, image: msg.image } : a)));
        }
      };

      ws.onclose = () => {
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  // Re-render while screenshots are pending so the "not available" fallback appears on time
  useEffect(() => {
    if (!alerts.some((a) => !a.image)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [alerts]);

  const dismiss = (eventId) => setAlerts((prev) => prev.filter((a) => a.event_id !== eventId));

  const enableDesktopAlerts = async () => {
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
  };

  const hidePrompt = () => {
    setPromptDismissed(true);
    try {
      localStorage.setItem(NOTIFY_PROMPT_KEY, "1");
    } catch {
      // Remembering the choice is optional
    }
  };

  const showPrompt = notifyPermission === "default" && !promptDismissed;

  return (
    <>
      <div style={{
        position: "fixed",
        top: "76px",
        right: "16px",
        zIndex: 10000,
        width: "min(360px, calc(100vw - 32px))",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxHeight: "calc(100vh - 92px)",
        overflowY: "auto"
      }}>
        {showPrompt && (
          <div className="glass-panel" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
            <Bell size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
            <span style={{ flexGrow: 1, color: "var(--text-secondary)" }}>Get cheating alerts even when this tab isn't open.</span>
            <button onClick={enableDesktopAlerts} className="btn btn-primary btn-sm" style={{ fontSize: "11px", padding: "4px 8px" }}>Enable</button>
            <button onClick={hidePrompt} className="btn btn-secondary btn-sm" style={{ padding: "4px" }} title="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}

        {alerts.length > 1 && (
          <button onClick={() => setAlerts([])} className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-end", fontSize: "11px" }}>
            Dismiss all ({alerts.length})
          </button>
        )}

        {alerts.map((a) => {
          const locked = a.status === "locked";
          const waiting = !a.image && now - a.receivedAt < SCREENSHOT_WAIT_MS;
          return (
            <div key={a.event_id} style={{
              background: "rgba(20, 12, 16, 0.97)",
              border: "1px solid rgba(239, 68, 68, 0.6)",
              borderRadius: "12px",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.25)",
              padding: "12px 14px",
              animation: "fadeIn 0.2s ease-out"
            }}>
              <div className="flex-between" style={{ marginBottom: "8px", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fca5a5", fontWeight: "700", fontSize: "13px" }}>
                  {locked ? <Lock size={16} /> : <AlertTriangle size={16} />}
                  Strike {a.strikes} / {a.allowed_strikes}{locked && " · Locked"}
                </div>
                <button onClick={() => dismiss(a.event_id)} className="btn btn-secondary btn-sm" style={{ padding: "4px" }} title="Dismiss">
                  <X size={12} />
                </button>
              </div>

              <div style={{ fontSize: "13.5px", fontWeight: "600", color: "#fff" }}>{a.student_name}</div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "6px" }}>{a.student_email}</div>
              <div style={{ fontSize: "12.5px", color: "var(--text-main)" }}>
                {EVENT_LABELS[a.event_type] || a.event_type}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "10px" }}>
                {a.assignment_title} · {new Date(a.timestamp).toLocaleTimeString()}
              </div>

              {a.image ? (
                <img
                  src={a.image}
                  alt={`Screen of ${a.student_name} at the time of the strike`}
                  onClick={() => setEnlarged(a.image)}
                  title="Click to enlarge"
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--border)", cursor: "zoom-in", display: "block" }}
                />
              ) : (
                <div style={{
                  height: "90px",
                  borderRadius: "8px",
                  border: "1px dashed var(--border-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "11.5px",
                  color: "var(--text-muted)"
                }}>
                  {waiting ? "Capturing screenshot..." : <><ImageOff size={14} /> No screenshot (screen share was off)</>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {enlarged && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setEnlarged(null)}>
          <img
            src={enlarged}
            alt="Violation screenshot"
            style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: "10px", boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
          />
        </div>
      )}
    </>
  );
}
