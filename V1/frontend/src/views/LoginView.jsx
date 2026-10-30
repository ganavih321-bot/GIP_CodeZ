import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Terminal, AlertCircle, Info } from "lucide-react";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In.")));
  });
}

export default function LoginView() {
  const { authConfig, googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const googleButtonRef = useRef(null);

  const clientId = authConfig.google_client_id;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            setLoading(true);
            setError("");
            try {
              await googleLogin(response.credential);
            } catch (err) {
              setError(err.message || "Google sign-in failed.");
            } finally {
              setLoading(false);
            }
          }
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 320
        });
      })
      .catch((err) => setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "460px",
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            borderRadius: "16px",
            boxShadow: "0 0 30px var(--primary-glow)",
            marginBottom: "16px"
          }}>
            <Terminal size={30} color="#fff" />
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>GIP_CodeZ</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Anti-Cheat Proctored Code Assessment Platform
          </p>
        </div>

        {/* Google Sign-In Card */}
        <div className="glass-panel" style={{ padding: "32px", textAlign: "center" }}>
          <h3 style={{ marginBottom: "6px" }}>Sign in</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "24px" }}>
            Use the Google account your admin invited.
          </p>

          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#fca5a5",
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textAlign: "left"
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {clientId ? (
            <div style={{ display: "flex", justifyContent: "center", minHeight: "44px", opacity: loading ? 0.6 : 1 }}>
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <div style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#fcd34d",
              fontSize: "13px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              textAlign: "left"
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                Google Sign-In isn't configured yet. Set <code>GOOGLE_CLIENT_ID</code> in <code>V1/backend/.env</code> and restart the backend.
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
