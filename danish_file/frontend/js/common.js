// ---------------------------------------------------------
// common.js
// Code shared by every page:
//   - the header and its role-based navigation
//   - page guards (who may open which page)
//   - formatting helpers (dates, money, safe HTML)
//   - messages, field errors and the confirm dialog
// ---------------------------------------------------------

// ----- Navigation: which links each role sees -----

const NAV_LINKS = [
  { href: "index.html", label: "Events", roles: ["guest", "customer", "organiser", "admin"] },
  { href: "bookings.html", label: "My bookings", roles: ["customer"] },
  { href: "manage-events.html", label: "Manage events", roles: ["organiser", "admin"] },
  { href: "venues.html", label: "Venues", roles: ["organiser", "admin"] },
  { href: "bookings.html", label: "Bookings", roles: ["organiser", "admin"] },
  { href: "users.html", label: "Users", roles: ["admin"] }
];

function currentPage() {
  const file = window.location.pathname.split("/").pop();
  return file || "index.html";
}

// Builds the header. Every page calls this once.
function renderHeader() {
  const header = document.getElementById("site-header");
  const user = getUser();
  const role = user ? user.role : "guest";
  const page = currentPage();

  const links = NAV_LINKS
    .filter((link) => link.roles.includes(role))
    .map((link) => {
      const current = link.href === page ? ' aria-current="page"' : "";
      return `<a href="${link.href}"${current}>${link.label}</a>`;
    })
    .join("");

  let account;
  if (user) {
    account = `
      <span class="account-name">${escapeHtml(user.name)}</span>
      <span class="badge badge-${user.role}">${capitalise(user.role)}</span>
      <button type="button" class="btn btn-small btn-light" id="logout-button">Log out</button>`;
  } else {
    account = `
      <a class="btn btn-small btn-light" href="login.html">Log in</a>
      <a class="btn btn-small" href="register.html">Register</a>`;
  }

  header.innerHTML = `
    <div class="container">
      <a class="logo" href="index.html">Event<span>Hub</span></a>
      <nav class="main-nav" aria-label="Main">${links}</nav>
      <div class="account">${account}</div>
    </div>`;

  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
}

function logout() {
  clearSession();
  sessionStorage.setItem("eventhub_notice", "You have logged out.");
  window.location.href = "login.html";
}

// ----- Page guard -----
// Call at the top of a protected page, for example:
//   const user = requireRole(["admin"]);
//   if (!user) return;
// This only decides what the browser shows. The API checks the
// role again on every request, so hiding a page is not the security.

function requireRole(allowedRoles) {
  const user = getUser();

  if (!user || !getToken()) {
    sessionStorage.setItem("eventhub_notice", "Log in to open that page.");
    window.location.href = "login.html?next=" + encodeURIComponent(currentPage());
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    document.querySelector("main").innerHTML = `
      <div class="state">
        <h2>This page is not available to ${escapeHtml(user.role)} accounts</h2>
        <p>It is open to: ${allowedRoles.join(", ")}.</p>
        <a class="btn" href="index.html">Back to events</a>
      </div>`;
    return null;
  }

  return user;
}

// ----- Formatting helpers -----

// Makes text from the API safe to place inside HTML.
// Without this, an event name like <script>...</script> would run.
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatMoney(amount) {
  return "RM " + Number(amount).toFixed(2);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function formatDateTime(value) {
  return formatDate(value) + ", " + formatTime(value);
}

function isPast(value) {
  return new Date(value).getTime() <= Date.now();
}

// The API wants dates as "YYYY-MM-DD HH:MM:SS".
// A <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM".
function inputToApiDate(inputValue) {
  return inputValue.replace("T", " ") + ":00";
}

// The reverse: an API date to the value a datetime-local input expects
function apiDateToInput(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return (
    date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes())
  );
}

// ----- Messages -----

// Returns the HTML for a coloured message box.
// type is "error", "success" or "info".
function alertHtml(type, message, status) {
  const code = status ? `<span class="status-code">HTTP ${status}</span>` : "";
  return `<div class="alert alert-${type}" role="${type === "error" ? "alert" : "status"}">${escapeHtml(message)}${code}</div>`;
}

// Shows an error (usually an ApiError) inside the given element
function showError(element, error) {
  element.innerHTML = alertHtml("error", error.message, error.status);
}

// A short message in the bottom corner that removes itself
function showToast(type, message, status) {
  let area = document.querySelector(".toast-area");
  if (!area) {
    area = document.createElement("div");
    area.className = "toast-area";
    document.body.appendChild(area);
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = alertHtml(type, message, status);
  const toast = wrapper.firstElementChild;
  area.appendChild(toast);

  // Errors stay longer so there is time to read them
  setTimeout(() => toast.remove(), type === "error" ? 8000 : 4000);
}

function showErrorToast(error) {
  showToast("error", error.message, error.status);
}

// A one-time message carried from the previous page
// (for example "You have logged out.")
function takeNotice() {
  const notice = sessionStorage.getItem("eventhub_notice");
  sessionStorage.removeItem("eventhub_notice");
  return notice;
}

// ----- Form validation helpers -----

function setFieldError(input, message) {
  input.setAttribute("aria-invalid", "true");
  const error = document.createElement("p");
  error.className = "field-error";
  error.textContent = message;
  input.insertAdjacentElement("afterend", error);
}

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((element) => element.remove());
  form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
}

// As soon as the user starts correcting a field, remove its error
document.addEventListener("input", (event) => {
  const input = event.target;
  if (input.getAttribute("aria-invalid") === "true") {
    input.removeAttribute("aria-invalid");
    const error = input.nextElementSibling;
    if (error && error.classList.contains("field-error")) {
      error.remove();
    }
  }
});

// Puts the cursor in the first field that failed validation
function focusFirstError(form) {
  const first = form.querySelector('[aria-invalid="true"]');
  if (first) {
    first.focus();
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Disables a button while a request is running so it cannot be sent twice
function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

// ----- Confirm dialog -----
// Usage:
//   const yes = await confirmAction("Delete this venue?", "This cannot be undone.", "Delete venue");

function confirmAction(title, message, confirmLabel) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <div class="dialog-body">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-answer="no">Keep it</button>
          <button type="button" class="btn btn-danger" data-answer="yes">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    dialog.addEventListener("click", (event) => {
      const answer = event.target.dataset.answer;
      if (answer) {
        dialog.close(answer);
      }
    });

    // Runs for a button click and also for the Esc key
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "yes");
      dialog.remove();
    });

    dialog.showModal();
  });
}
