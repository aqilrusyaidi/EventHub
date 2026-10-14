// ---------------------------------------------------------
// api.js
// Every request to the backend goes through apiRequest().
// It does four jobs:
//   1. adds the JWT to the Authorization header
//   2. sends and reads JSON
//   3. turns a rejected request into an ApiError that
//      carries the HTTP status code and the API's message
//   4. sends the user back to the login page if the token
//      has expired
// ---------------------------------------------------------

const TOKEN_KEY = "eventhub_token";
const USER_KEY = "eventhub_user";

// ----- Session (saved in the browser's localStorage) -----

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Returns { user_id, name, email, role } or null when logged out
function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ----- Error type -----

// status is the HTTP status code (400, 401, 403, 404, 409, 429, 500).
// status 0 means the request never reached the server.
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Used only when the API sends no message of its own
const DEFAULT_MESSAGES = {
  400: "The request was not valid.",
  401: "Log in to continue.",
  403: "Your account is not allowed to do this.",
  404: "That record was not found.",
  409: "This conflicts with existing data.",
  429: "Too many requests. Wait a moment and try again.",
  500: "The server had a problem. Try again."
};

// ----- The request function -----

async function apiRequest(method, path, body) {
  const options = { method: method, headers: {} };

  const token = getToken();
  if (token) {
    options.headers["Authorization"] = "Bearer " + token;
  }

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_BASE_URL + path, options);
  } catch (error) {
    // fetch only throws when there is no response at all
    throw new ApiError(
      0,
      "Cannot reach the EventHub API at " + API_BASE_URL +
      ". Check that the backend server is running."
    );
  }

  // The API always answers in JSON, but guard against an empty body
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    // A 401 while holding a token means the token expired or is invalid.
    // (A 401 from /login just means a wrong password, so skip that one.)
    if (response.status === 401 && token && path !== "/login") {
      clearSession();
      sessionStorage.setItem(
        "eventhub_notice",
        "Your session has expired. Log in again."
      );
      window.location.href = "login.html";
    }

    const message =
      (data && data.message) ||
      DEFAULT_MESSAGES[response.status] ||
      "Request failed.";

    throw new ApiError(response.status, message);
  }

  return data;
}

// ----- One small function per endpoint -----
// Pages call these, so no page builds a URL by hand.

const api = {
  // Authentication
  register: (name, email, password) =>
    apiRequest("POST", "/register", { name, email, password }),
  login: (email, password) =>
    apiRequest("POST", "/login", { email, password }),

  // Events
  getEvents: () => apiRequest("GET", "/events"),
  getEvent: (id) => apiRequest("GET", "/events/" + id),
  // Weather at the venue. The backend gets it from Open-Meteo.
  getEventWeather: (id) => apiRequest("GET", "/events/" + id + "/weather"),
  createEvent: (event) => apiRequest("POST", "/events", event),
  updateEvent: (id, event) => apiRequest("PUT", "/events/" + id, event),
  deleteEvent: (id) => apiRequest("DELETE", "/events/" + id),

  // Venues
  getVenues: () => apiRequest("GET", "/venues"),
  getVenue: (id) => apiRequest("GET", "/venues/" + id),
  createVenue: (venue) => apiRequest("POST", "/venues", venue),
  updateVenue: (id, venue) => apiRequest("PUT", "/venues/" + id, venue),
  deleteVenue: (id) => apiRequest("DELETE", "/venues/" + id),

  // Bookings
  getBookings: () => apiRequest("GET", "/bookings"),
  getBooking: (id) => apiRequest("GET", "/bookings/" + id),
  createBooking: (event_id, quantity) =>
    apiRequest("POST", "/bookings", { event_id, quantity }),
  cancelBooking: (id) => apiRequest("PATCH", "/bookings/" + id + "/cancel"),

  // Users (administrator only)
  getUsers: () => apiRequest("GET", "/users"),
  getUser: (id) => apiRequest("GET", "/users/" + id),
  updateUser: (id, user) => apiRequest("PUT", "/users/" + id, user),
  deleteUser: (id) => apiRequest("DELETE", "/users/" + id)
};
