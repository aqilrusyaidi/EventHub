// ---------------------------------------------------------
// register.js  (register.html)
// Creates a customer account, then logs the new user in.
// Endpoints used: POST /register, POST /login
// ---------------------------------------------------------

renderHeader();

const form = document.getElementById("register-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm");
const messageElement = document.getElementById("message");
const button = document.getElementById("register-button");

// The same rules the API applies, checked here first so the user
// gets an answer beside the field without waiting for the server.
function validate() {
  clearFieldErrors(form);

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (name === "") {
    setFieldError(nameInput, "Enter your full name.");
  } else if (name.length > 100) {
    setFieldError(nameInput, "Use 100 characters or fewer.");
  }

  if (email === "") {
    setFieldError(emailInput, "Enter your email address.");
  } else if (!EMAIL_PATTERN.test(email) || email.length > 150) {
    setFieldError(emailInput, "Enter an email address like name@example.com.");
  }

  if (password.length < 8) {
    setFieldError(passwordInput, "Use at least 8 characters.");
  } else if (password.length > 72) {
    setFieldError(passwordInput, "Use 72 characters or fewer.");
  }

  if (confirmInput.value !== password) {
    setFieldError(confirmInput, "The two passwords do not match.");
  }

  return !form.querySelector(".field-error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageElement.innerHTML = "";

  if (!validate()) {
    focusFirstError(form);
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setBusy(button, true, "Creating account…");

  try {
    await api.register(name, email, password);

    // Registration does not return a token, so log in straight away
    const result = await api.login(email, password);
    saveSession(result.token, result.user);
    window.location.href = "index.html";
  } catch (error) {
    // 409 = the email is already registered
    showError(messageElement, error);
    setBusy(button, false);
    if (error.status === 409) {
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
    }
  }
});
