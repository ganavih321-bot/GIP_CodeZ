const API_BASE = "http://localhost:8000/api";
const WS_BASE = "ws://localhost:8000/ws";

function getHeaders(isJson = true) {
  const token = localStorage.getItem("gip_token");
  const headers = {};
  if (isJson) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(options.body && typeof options.body === "string"),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const data = await response.json();
      errorDetail = data.detail || errorDetail;
    } catch (e) {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth
  auth: {
    config: () => request("/auth/config"),
    google: (credential) =>
      request("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential })
      }),
    me: () => request("/auth/me")
  },

  // Admin: Students
  students: {
    list: () => request("/admin/students"),
    invite: (students, assignmentIds = []) =>
      request("/admin/students/invite", {
        method: "POST",
        body: JSON.stringify({ students, assignment_ids: assignmentIds })
      }),
    remove: (id) =>
      request(`/admin/students/${id}`, {
        method: "DELETE"
      })
  },

  // Tests (Assignments)
  assignments: {
    create: (data) =>
      request("/assignments", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    list: () => request("/assignments"),
    getDetail: (id) => request(`/assignments/${id}`),
    updateAssignees: (id, studentIds) =>
      request(`/assignments/${id}/assignees`, {
        method: "PUT",
        body: JSON.stringify({ student_ids: studentIds })
      }),
    delete: (id) =>
      request(`/assignments/${id}`, {
        method: "DELETE"
      })
  },

  // Exam attempts (server-side timer & strikes)
  attempts: {
    getMine: (assignmentId) => request(`/assignments/${assignmentId}/attempt`),
    start: (assignmentId) =>
      request(`/assignments/${assignmentId}/attempt/start`, { method: "POST" }),
    finish: (assignmentId) =>
      request(`/assignments/${assignmentId}/attempt/finish`, { method: "POST" }),
    list: (assignmentId) => request(`/assignments/${assignmentId}/attempts`),
    resetStrikes: (assignmentId, studentId, allowedStrikes) =>
      request(`/assignments/${assignmentId}/attempts/${studentId}/reset`, {
        method: "POST",
        body: JSON.stringify({ allowed_strikes: allowedStrikes })
      })
  },

  // Questions
  questions: {
    create: (assignmentId, data) =>
      request(`/assignments/${assignmentId}/questions`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    delete: (id) =>
      request(`/questions/${id}`, {
        method: "DELETE"
      })
  },

  // Code Execution Engine
  code: {
    run: (question_id, code, custom_input = null) =>
      request("/code/run", {
        method: "POST",
        body: JSON.stringify({ question_id, code, custom_input })
      }),
    submit: (assignment_id, question_id, code) =>
      request("/code/submit", {
        method: "POST",
        body: JSON.stringify({ assignment_id, question_id, code })
      })
  },

  // Submissions
  submissions: {
    getAssignmentSubmissions: (assignmentId) =>
      request(`/assignments/${assignmentId}/submissions`),
    getMySubmissions: (assignmentId) =>
      request(`/assignments/${assignmentId}/my-submissions`),
    getDetail: (submissionId) => request(`/submissions/${submissionId}`)
  },

  // Proctoring
  proctoring: {
    recordEvent: (data) =>
      request("/proctoring/events", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    getEvents: (assignmentId) =>
      request(`/assignments/${assignmentId}/proctoring-events`),
    getActiveState: (assignmentId) =>
      request(`/assignments/${assignmentId}/active-proctoring`),
    getWsUrl: (assignmentId) => {
      const token = localStorage.getItem("gip_token");
      return `${WS_BASE}/proctoring/${assignmentId}?token=${encodeURIComponent(token)}`;
    }
  }
};
