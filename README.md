# GIP_CodeZ — Anti-Cheat Proctored Code Assessment & LMS Platform

An anti-cheat proctored Learning Management System (LMS) combining the course management workflow of **Google Classroom** with the coding assessment engine of **HackerRank**.

---

## 🚀 Key Features

### 1. 🎓 Google Classroom Management
- **Course & Classroom Hub**: Teachers can create classrooms with automatically generated unique 6-character join codes (e.g. `PY101A`).
- **Student Enrollment**: Students can enroll in classrooms using join codes.
- **Roster & Assessment Scheduling**: Teachers can schedule timed coding assessments, midterm exams, and practice homework.

### 2. 💻 HackerRank-Style Coding Engine
- **Monaco Code Editor**: VS Code-powered browser IDE for Python with syntax highlighting, line numbers, and clean dark mode.
- **Run Code (Sample Cases)**: Runs Python against public test cases with real-time stdout, runtime error tracebacks, execution time (ms), and an **Expected vs Actual Diff viewer**.
- **Submit Code (Full Grading)**: Evaluates solution against both public and hidden test cases with test-by-test pass/fail status and confetti celebration upon complete pass.
- **Secure Code Execution**: Ephemeral Docker container isolation with an automatic safe subprocess fallback and 5-second per-testcase execution timeout.

### 3. 🛡️ Live Anti-Cheat & Proctoring Hub
- **WebRTC Live Screen Streaming**: Broadcasts student's screen in real-time to the teacher's dashboard.
- **Full-Screen Enforcement**: The exam requires full-screen mode. Exiting full-screen displays a security violation modal and registers an anti-cheat strike.
- **Tab Switching & Window Blur Detection**: Switching tabs or opening external applications logs a violation with timestamps.
- **Clipboard & DevTools Lockout**: Copy/paste is disabled inside the code editor, and F12 / inspection shortcuts are blocked.
- **Configurable 3-Strike Rule**: Configurable strikes threshold before auto-submission.
- **Teacher Live CCTV Command Center**: Real-time grid of all active students' screen streams, live anti-cheat violation ticker, remote student warning dialogs, and remote force-submit controls.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python 3.12), SQLAlchemy, SQLite / PostgreSQL, WebSockets for WebRTC signaling and live alerts, JWT Authentication with bcrypt.
- **Frontend**: React (Vite), Vanilla CSS Cyber-Dark Design System, Monaco Editor (`@monaco-editor/react`), Lucide React Icons.
- **Execution Engine**: Docker Container Runner with Safe Subprocess Sandbox Fallback.

---

## ⚡ Quick Start & Running Locally

### Pre-requisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start the Backend API
```bash
cd V1/backend
# Activate virtual environment
.\.venv\Scripts\activate
# Start FastAPI with Uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API Docs & Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 2. Start the Frontend
```bash
cd V1/frontend
npm run dev
```
- Web Application: `http://localhost:5173/`

---

## 🔑 Pre-Seeded Demo Accounts

The database is pre-seeded with sample accounts and problems:

| Role | Email | Password | Pre-seeded Content |
|---|---|---|---|
| **Teacher** | `teacher@gip.com` | `teacher123` | Course `CS101`, Midterm Proctored Exam with 3 Python problems |
| **Student** | `student@gip.com` | `student123` | Enrolled in `CS101` (Code: `PY101A`) |

> **Pro Tip**: You can also use the one-click **"Teacher Portal"** and **"Student Exam"** buttons on the login screen or top navbar to instantly toggle between views!
