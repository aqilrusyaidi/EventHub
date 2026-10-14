// ---------------------------------------------------------
// login.js  (login.html)
// Sends the email and password to the API and stores the
// JWT that comes back.
// Endpoint used: POST /login
// ---------------------------------------------------------

renderHeader();

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const messageElement = document.getElementById("message");
const button = document.getElementById("login-button");

// Show a message left by the previous page, such as
// "Your session has expired. Log in again."
const notice = takeNotice();
if (notice) {
  messageElement.innerHTML = alertHtml("info", notice);
}

// Where to go after logging in. Each role lands on its main page.
const HOME_PAGE = {
  customer: "index.html",
  organiser: "manage-events.html",
  admin: "users.html"
};

// login.html?next=event.html?id=2 returns the user to where they were.
// Only this site's own pages are accepted, never an outside address.
function nextPage(role) {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && /^[a-z-]+\.html(\?id=\d+)?$/.test(next)) {
    return next;
  }
  return HOME_PAGE[role] || "index.html";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldErrors(form);
  messageElement.innerHTML = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Check the fields in the browser before calling the API
  if (email === "") {
    setFieldError(emailInput, "Enter your email address.");
  } else if (!EMAIL_PATTERN.test(email)) {
    setFieldError(emailInput, "Enter an email address like name@example.com.");
  }
  if (password === "") {
    setFieldError(passwordInput, "Enter your password.");
  }
  if (form.querySelector(".field-error")) {
    focusFirstError(form);
    return;
  }

  setBusy(button, true, "Logging in…");

  try {
    const result = await api.login(email, password);
    saveSession(result.token, result.user);
    window.location.href = nextPage(result.user.role);
  } catch (error) {
    // 401 = wrong email or password
    showError(messageElement, error);
    setBusy(button, false);
    passwordInput.value = "";
    passwordInput.focus();
  }
});
