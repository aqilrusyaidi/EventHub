// ---------------------------------------------------------
// users.js  (users.html)
// Administrator only: list users, change their details or
// role, and delete accounts.
// New accounts are created on the Register page, so there is
// no "add user" button here.
// Endpoints used: GET /users, GET /users/:id,
//                 PUT /users/:id, DELETE /users/:id
// ---------------------------------------------------------

renderHeader();

const user = requireRole(["admin"]);

if (user) {
  startUsersPage();
}

function startUsersPage() {
  const messageElement = document.getElementById("message");
  const summaryElement = document.getElementById("summary");
  const tableWrap = document.getElementById("table-wrap");
  const tableBody = document.getElementById("table-body");
  const roleFilter = document.getElementById("role-filter");

  const dialog = document.getElementById("user-dialog");
  const form = document.getElementById("user-form");
  const formMessage = document.getElementById("form-message");
  const saveButton = document.getElementById("save-button");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const roleSelect = document.getElementById("role");
  const roleHint = document.getElementById("role-hint");

  let users = [];
  let editingId = null;

  // ----- Load and show -----

  async function loadUsers() {
    try {
      const result = await api.getUsers();
      users = result.data;
      showUsers();
    } catch (error) {
      summaryElement.textContent = "Users could not be loaded.";
      tableWrap.classList.add("hidden");
      showError(messageElement, error);
    }
  }

  function showUsers() {
    messageElement.innerHTML = "";

    // "1 organiser", "3 customers"
    const count = (role, word) => {
      const total = users.filter((person) => person.role === role).length;
      return total + " " + word + (total === 1 ? "" : "s");
    };
    summaryElement.textContent =
      users.length + " accounts: " +
      count("customer", "customer") + ", " +
      count("organiser", "organiser") + ", " +
      count("admin", "administrator") + ".";

    const visible = users.filter(
      (person) => roleFilter.value === "all" || person.role === roleFilter.value
    );

    if (visible.length === 0) {
      tableWrap.classList.add("hidden");
      messageElement.innerHTML = `
        <div class="state">
          <h2>No accounts with that role</h2>
          <p>Change the filter to see the others.</p>
        </div>`;
      return;
    }

    tableWrap.classList.remove("hidden");
    tableBody.innerHTML = visible.map(userRow).join("");
  }

  function userRow(person) {
    const isMe = person.user_id === user.user_id;

    // An administrator cannot delete their own account (the API
    // refuses it too), so the button is not offered on that row.
    const deleteButton = isMe
      ? ""
      : `<button type="button" class="btn btn-small btn-danger-outline" data-action="delete" data-id="${person.user_id}">Delete</button>`;

    return `
      <tr>
        <td class="num">${person.user_id}</td>
        <td>${escapeHtml(person.name)}${isMe ? ' <span class="muted">(you)</span>' : ""}</td>
        <td>${escapeHtml(person.email)}</td>
        <td><span class="badge badge-${person.role}">${capitalise(person.role)}</span></td>
        <td>${formatDate(person.created_at)}</td>
        <td class="actions">
          <button type="button" class="btn btn-small btn-secondary" data-action="edit" data-id="${person.user_id}">Edit</button>
          ${deleteButton}
        </td>
      </tr>`;
  }

  // ----- Edit -----

  async function openEditForm(id) {
    try {
      // Ask the API for the latest copy of this user
      const result = await api.getUser(id);
      const person = result.data;

      editingId = id;
      form.reset();
      clearFieldErrors(form);
      formMessage.innerHTML = "";

      nameInput.value = person.name;
      emailInput.value = person.email;
      roleSelect.value = person.role;

      // Admins cannot remove their own admin role, so lock the menu
      const isMe = id === user.user_id;
      roleSelect.disabled = isMe;
      roleHint.textContent = isMe
        ? "You cannot change your own role."
        : "The role decides which pages and actions the user gets.";

      dialog.showModal();
    } catch (error) {
      showErrorToast(error);
    }
  }

  function validateForm() {
    clearFieldErrors(form);

    const name = nameInput.value.trim();
    if (name === "") {
      setFieldError(nameInput, "Enter the user's full name.");
    } else if (name.length > 100) {
      setFieldError(nameInput, "Use 100 characters or fewer.");
    }

    const email = emailInput.value.trim();
    if (email === "") {
      setFieldError(emailInput, "Enter an email address.");
    } else if (!EMAIL_PATTERN.test(email) || email.length > 150) {
      setFieldError(emailInput, "Enter an email address like name@example.com.");
    }

    return !form.querySelector(".field-error");
  }

  async function saveUser(submitEvent) {
    submitEvent.preventDefault();
    formMessage.innerHTML = "";

    if (!validateForm()) {
      focusFirstError(form);
      return;
    }

    const details = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      role: roleSelect.value
    };

    setBusy(saveButton, true, "Saving…");

    try {
      const result = await api.updateUser(editingId, details);

      // If the admin edited their own name, update the header as well
      if (editingId === user.user_id) {
        saveSession(getToken(), { ...user, name: result.user.name, email: result.user.email });
        user.name = result.user.name;
        renderHeader();
      }

      showToast("success", "Changes saved to " + details.name + ".");
      dialog.close();
      await loadUsers();
    } catch (error) {
      // 409 = another account already uses that email
      showError(formMessage, error);
    } finally {
      setBusy(saveButton, false);
    }
  }

  // ----- Delete -----

  async function deleteUser(id) {
    const person = users.find((item) => item.user_id === id);

    const yes = await confirmAction(
      "Delete " + person.name + "?",
      "The account for " + person.email + " is removed and can no longer log in. This cannot be undone.",
      "Delete user"
    );
    if (!yes) {
      return;
    }

    try {
      await api.deleteUser(id);
      showToast("success", "User deleted: " + person.name + ".");
      await loadUsers();
    } catch (error) {
      // 409 = the user has bookings or events, so the API refuses
      showErrorToast(error);
    }
  }

  // ----- Wire up the buttons -----

  roleFilter.addEventListener("change", showUsers);
  document.getElementById("cancel-button").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", saveUser);

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const id = Number(button.dataset.id);
    if (button.dataset.action === "edit") {
      openEditForm(id);
    } else {
      deleteUser(id);
    }
  });

  loadUsers();
}
