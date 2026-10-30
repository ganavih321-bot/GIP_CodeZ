import React, { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { api } from "./services/api";
import Navbar from "./components/Navbar";
import LoginView from "./views/LoginView";
import TestsView from "./views/TestsView";
import StudentsView from "./views/StudentsView";
import ProctoredExamView from "./views/ProctoredExamView";
import TeacherMonitoringView from "./views/TeacherMonitoringView";
import SubmissionsView from "./views/SubmissionsView";

// Hash routes: #/tests, #/students, #/tests/:id/exam, #/tests/:id/monitor, #/tests/:id/submissions
const ASSIGNMENT_VIEWS = ["exam", "monitor", "submissions"];

function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "students") return { view: "students", assignmentId: null };
  if (parts[0] === "tests" && parts[1] && ASSIGNMENT_VIEWS.includes(parts[2])) {
    const id = parseInt(parts[1], 10);
    if (!Number.isNaN(id)) return { view: parts[2], assignmentId: id };
  }
  return { view: "tests", assignmentId: null };
}

function buildHash(view, assignmentId) {
  return ASSIGNMENT_VIEWS.includes(view) ? `#/tests/${assignmentId}/${view}` : `#/${view}`;
}

function MainApp() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [route, setRoute] = useState(parseHash); // { view, assignmentId }
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [routeError, setRouteError] = useState("");
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  const navigate = (view, assignment = null, { replace = false } = {}) => {
    const assignmentId = assignment?.id ?? null;
    const hash = buildHash(view, assignmentId);
    // inApp marks entries we pushed, so in-app "Back" buttons can use history.back()
    if (replace) {
      window.history.replaceState({ inApp: window.history.state?.inApp }, "", hash);
    } else {
      window.history.pushState({ inApp: true }, "", hash);
    }
    setSelectedAssignment(assignment);
    setRouteError("");
    setRoute({ view, assignmentId });
  };

  const goBackToTests = () => {
    if (window.history.state?.inApp) {
      window.history.back();
    } else {
      navigate("tests", null, { replace: true });
    }
  };

  // Browser Back / Forward
  useEffect(() => {
    const onPopState = () => {
      const current = routeRef.current;
      // Leaving a running proctored exam via browser navigation isn't allowed: stay on the exam
      if (current.view === "exam") {
        window.history.pushState({ inApp: true }, "", buildHash("exam", current.assignmentId));
        return;
      }
      setRouteError("");
      setRoute(parseHash());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Load the test for deep links / refresh / back-forward into an assignment view
  useEffect(() => {
    if (!isAuthenticated || route.assignmentId == null) return;
    if (selectedAssignment?.id === route.assignmentId) return;
    let cancelled = false;
    api.assignments
      .getDetail(route.assignmentId)
      .then((data) => {
        if (!cancelled) setSelectedAssignment(data);
      })
      .catch((err) => {
        if (!cancelled) setRouteError(err.message || "Failed to load test.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, route.assignmentId]);

  // Students can't open admin-only routes
  useEffect(() => {
    if (!isAuthenticated) return;
    const adminOnly = route.view === "students" || route.view === "monitor" || route.view === "submissions";
    if (adminOnly && !isAdmin) navigate("tests", null, { replace: true });
  }, [isAuthenticated, isAdmin, route.view]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        color: "var(--text-muted)"
      }}>
        Loading GIP_CodeZ...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const { view } = route;
  const assignmentReady = selectedAssignment && selectedAssignment.id === route.assignmentId;

  // Views that take over the entire screen (like Proctored Exam)
  if (view === "exam" && assignmentReady) {
    return (
      <ProctoredExamView
        assignment={selectedAssignment}
        // Replace the exam entry so Back can't re-enter a finished exam
        onExit={() => navigate("tests", null, { replace: true })}
      />
    );
  }

  if (view === "monitor" && assignmentReady) {
    return (
      <TeacherMonitoringView
        assignment={selectedAssignment}
        onBack={goBackToTests}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar
        currentView={view}
        onNavigate={(v) => {
          if (v !== view) navigate(v);
        }}
      />

      <main style={{ flexGrow: 1, paddingTop: "24px" }}>
        {view === "tests" && (
          <TestsView
            onStartExam={(assign) => navigate("exam", assign)}
            onMonitorExam={(assign) => navigate("monitor", assign)}
            onViewSubmissions={(assign) => navigate("submissions", assign)}
          />
        )}

        {view === "students" && isAdmin && <StudentsView />}

        {view === "submissions" && assignmentReady && (
          <SubmissionsView
            assignment={selectedAssignment}
            onBack={goBackToTests}
          />
        )}

        {ASSIGNMENT_VIEWS.includes(view) && !assignmentReady && (
          <div className="container" style={{ color: routeError ? "#fca5a5" : "var(--text-muted)", padding: "40px 24px" }}>
            {routeError ? (
              <>
                {routeError}{" "}
                <button onClick={() => navigate("tests", null, { replace: true })} className="btn btn-secondary btn-sm">
                  Go to Tests
                </button>
              </>
            ) : (
              "Loading test..."
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
