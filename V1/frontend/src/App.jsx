import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import LoginView from "./views/LoginView";
import DashboardView from "./views/DashboardView";
import ClassroomDetailView from "./views/ClassroomDetailView";
import ProctoredExamView from "./views/ProctoredExamView";
import TeacherMonitoringView from "./views/TeacherMonitoringView";
import SubmissionsView from "./views/SubmissionsView";

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard"); // dashboard, classroom, exam, monitor, submissions
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

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

  // Views that take over the entire screen (like Proctored Exam)
  if (currentView === "exam" && selectedAssignment) {
    return (
      <ProctoredExamView
        assignment={selectedAssignment}
        onExit={() => setCurrentView("classroom")}
      />
    );
  }

  if (currentView === "monitor" && selectedAssignment) {
    return (
      <TeacherMonitoringView
        assignment={selectedAssignment}
        onBack={() => setCurrentView("classroom")}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          if (view === "dashboard") {
            setSelectedClassroom(null);
            setSelectedAssignment(null);
          }
        }}
      />

      <main style={{ flexGrow: 1, paddingTop: "24px" }}>
        {currentView === "dashboard" && (
          <DashboardView
            onSelectClassroom={(c) => {
              setSelectedClassroom(c);
              setCurrentView("classroom");
            }}
          />
        )}

        {currentView === "classroom" && selectedClassroom && (
          <ClassroomDetailView
            classroom={selectedClassroom}
            onBack={() => setCurrentView("dashboard")}
            onStartExam={(assign) => {
              setSelectedAssignment(assign);
              setCurrentView("exam");
            }}
            onMonitorExam={(assign) => {
              setSelectedAssignment(assign);
              setCurrentView("monitor");
            }}
            onViewSubmissions={(assign) => {
              setSelectedAssignment(assign);
              setCurrentView("submissions");
            }}
          />
        )}

        {currentView === "submissions" && selectedAssignment && (
          <SubmissionsView
            assignment={selectedAssignment}
            onBack={() => setCurrentView("classroom")}
          />
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
