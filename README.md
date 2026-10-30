# GIP_CodeZ — Anti-Cheat Proctored Code Assessment & LMS Platform

An anti-cheat proctored coding assessment platform: admins invite students, create Python tests and assign them; students sign in with Google and take proctored tests in a browser IDE.

---

## 🚀 Key Features

### 1. 🔐 Google Login & Admin-Managed Access
- **Google Sign-In**: Students and admins sign in with Google. The backend verifies the Google ID token (signature, audience, expiry, verified email).
- **Invite-only**: Only emails an admin has invited can sign in. Emails listed in `ADMIN_EMAILS` are admins.
- **Bulk Invites**: Admins paste a list of emails (or upload a CSV of `name,email`) to invite many students at once, optionally assigning tests in the same step.
- **Tests & Assignment**: Admins create tests, add coding problems with public and hidden test cases, and assign each test to selected students. Students only see and can open tests assigned to them.

### 2. 💻 HackerRank-Style Coding Engine
- **Monaco Code Editor**: VS Code-powered browser IDE for Python with syntax highlighting, line numbers, and clean dark mode.
- **Run Code (Sample Cases)**: Runs Python against public test cases with real-time stdout, runtime error tracebacks, execution time (ms), and an **Expected vs Actual Diff viewer**.
- **Submit Code (Full Grading)**: Evaluates solution against both public and hidden test cases with test-by-test pass/fail status and confetti celebration upon complete pass.
- **Secure Code Execution**: Ephemeral Docker container isolation with an automatic safe subprocess fallback and 5-second per-testcase execution timeout.

### 3. 🛡️ Live Anti-Cheat & Proctoring Hub
- **WebRTC Live Screen Streaming**: Broadcasts student's screen in real-time to the teacher's dashboard.
- **Full-Screen Enforcement**: Starting a test enters full screen; a pre-check requires screen share + full screen before the timer starts. Whenever the page leaves full screen, loses focus, or a browser side panel (Gemini, Copilot) is docked next to it, the problem and code are removed from the page and a strike is recorded.
- **Tab Switching & Window Blur Detection**: Switching tabs or opening external applications logs a violation with timestamps.
- **Clipboard & DevTools Lockout**: Copy, cut, paste and drag-and-drop are blocked page-wide (including the editor); F12 / inspection, print, find and zoom shortcuts are blocked.
- **Server-Side Strikes & Lock**: Strikes and the timer are tracked on the server (a refresh doesn't reset them). Reaching the limit locks the test; the admin can reset a student's strikes and grant N more from Live Monitor → Attempts & Strikes.
- **Admin Live CCTV Command Center**: Real-time grid of all active students' screen streams, live anti-cheat violation ticker, remote student warning dialogs, and remote force-submit controls.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python 3.12), SQLAlchemy, PostgreSQL (psycopg 3), WebSockets for WebRTC signaling and live alerts, Google ID-token verification + JWT sessions.
- **Frontend**: React (Vite), Vanilla CSS Cyber-Dark Design System, Monaco Editor (`@monaco-editor/react`), Lucide React Icons.
- **Execution Engine**: Docker Container Runner with Safe Subprocess Sandbox Fallback.

---

## ⚡ Quick Start & Running Locally

### Pre-requisites
- Python 3.10+
- Node.js 18+ and npm
- PostgreSQL 14+ running locally (the `gip_codez` database is created automatically on first start)

### 1. Configure the backend
```bash
cd V1/backend
cp .env.example .env   # then edit .env
pip install -r requirements.txt
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://postgres:<password>@localhost:5432/gip_codez` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 **Web application** Client ID (see below) |
| `ADMIN_EMAILS` | Comma-separated Google emails that get the admin role |
| `SECRET_KEY` | JWT signing key. Change it in production |

**Getting a Google Client ID:** Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → *Web application*. Add `http://localhost:5173` under **Authorized JavaScript origins**. (Configure the OAuth consent screen first if prompted.)

### 2. Start the Backend API
```bash
cd V1/backend
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API Docs & Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 3. Start the Frontend
```bash
cd V1/frontend
npm run dev
```
- Web Application: `http://localhost:5173/`

### Running tests
```bash
cd V1/backend
pytest
```
Tests use a temporary SQLite database and a mocked Google verifier, so they don't need Postgres or a Client ID.

---

## 👥 How it works

1. An admin (an email in `ADMIN_EMAILS`) signs in with Google.
2. **Students tab → Invite Students**: paste emails or upload a CSV; optionally assign tests right away.
3. **Tests tab → Create Test**, then **Add Problem** and **Assign Students**.
4. Invited students sign in with Google and see their tests under **My Tests**.
5. While a proctored test runs, the admin uses **Live Monitor** and **Submissions**.

---

## 🧪 Sample Test

On first start the database is seeded with **GIP Python Screening Test** (45 min, proctored, 4 problems with hidden test cases). It starts unassigned: open **Tests → Assign Students** to give it to invited students.

Login is Google-only; there are no password or demo accounts.
