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
    login: (email, password) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      }),
    register: (name, email, password, role) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role })
      }),
    me: () => request("/auth/me")
  },

  // Classrooms
  classrooms: {
    list: () => request("/classrooms"),
    create: (data) =>
      request("/classrooms", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    join: (code) =>
      request("/classrooms/join", {
        method: "POST",
        body: JSON.stringify({ code })
      }),
    getDetail: (id) => request(`/classrooms/${id}`),
    delete: (id) =>
      request(`/classrooms/${id}`, {
        method: "DELETE"
      })
  },

  // Assignments / Exams
  assignments: {
    create: (classroomId, data) =>
      request(`/classrooms/${classroomId}/assignments`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    list: (classroomId) => request(`/classrooms/${classroomId}/assignments`),
    getDetail: (id) => request(`/assignments/${id}`)
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
