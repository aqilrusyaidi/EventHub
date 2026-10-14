// ---------------------------------------------------------
// venues.js  (venues.html)
// Add, edit and delete venues. Open to organisers and admins.
// Endpoints used: GET /venues, GET /venues/:id, POST /venues,
//                 PUT /venues/:id, DELETE /venues/:id, GET /events
// ---------------------------------------------------------

renderHeader();

const user = requireRole(["organiser", "admin"]);

if (user) {
  startVenuesPage();
}

function startVenuesPage() {
  const messageElement = document.getElementById("message");
  const summaryElement = document.getElementById("summary");
  const tableWrap = document.getElementById("table-wrap");
  const tableBody = document.getElementById("table-body");

  const dialog = document.getElementById("venue-dialog");
  const form = document.getElementById("venue-form");
  const formMessage = document.getElementById("form-message");
  const dialogTitle = document.getElementById("dialog-title");
  const saveButton = document.getElementById("save-button");
  const nameInput = document.getElementById("venue-name");
  const locationInput = document.getElementById("location");
  const capacityInput = document.getElementById("capacity");

  let venues = [];
  let eventCounts = {};   // venue_id -> number of events held there
  let editingId = null;   // null while adding, a venue_id while editing

  // ----- Load and show -----

  async function loadVenues() {
    try {
      // Events are loaded too, only to count how many use each venue
      const [venuesResult, eventsResult] = await Promise.all([
        api.getVenues(),
        api.getEvents()
      ]);

      venues = venuesResult.data;

      eventCounts = {};
      eventsResult.data.forEach((event) => {
        eventCounts[event.venue_id] = (eventCounts[event.venue_id] || 0) + 1;
      });

      showVenues();
    } catch (error) {
      summaryElement.textContent = "Venues could not be loaded.";
      tableWrap.classList.add("hidden");
      showError(messageElement, error);
    }
  }

  function showVenues() {
    messageElement.innerHTML = "";

    if (venues.length === 0) {
      summaryElement.textContent = "";
      tableWrap.classList.add("hidden");
      messageElement.innerHTML = `
        <div class="state">
          <h2>No venues have been added</h2>
          <p>Add a venue first. Every event needs one.</p>
        </div>`;
      return;
    }

    summaryElement.textContent =
      venues.length + " venues. A venue that already hosts an event cannot be deleted.";

    tableWrap.classList.remove("hidden");
    tableBody.innerHTML = venues.map((venue) => `
      <tr>
        <td>${escapeHtml(venue.venue_name)}</td>
        <td>${escapeHtml(venue.location)}</td>
        <td class="num">${venue.capacity}</td>
        <td class="num">${eventCounts[venue.venue_id] || 0}</td>
        <td class="actions">
          <button type="button" class="btn btn-small btn-secondary" data-action="edit" data-id="${venue.venue_id}">Edit</button>
          <button type="button" class="btn btn-small btn-danger-outline" data-action="delete" data-id="${venue.venue_id}">Delete</button>
        </td>
      </tr>`).join("");
  }

  // ----- Add and edit -----

  function openAddForm() {
    editingId = null;
    form.reset();
    clearFieldErrors(form);
    formMessage.innerHTML = "";
    dialogTitle.textContent = "Add venue";
    saveButton.textContent = "Add venue";
    dialog.showModal();
  }

  async function openEditForm(id) {
    try {
      // Ask the API for the latest copy of this venue
      const result = await api.getVenue(id);
      const venue = result.data;

      editingId = id;
      form.reset();
      clearFieldErrors(form);
      formMessage.innerHTML = "";
      dialogTitle.textContent = "Edit venue";
      saveButton.textContent = "Save changes";

      nameInput.value = venue.venue_name;
      locationInput.value = venue.location;
      capacityInput.value = venue.capacity;

      dialog.showModal();
    } catch (error) {
      showErrorToast(error);
    }
  }

  function validateForm() {
    clearFieldErrors(form);

    const name = nameInput.value.trim();
    if (name === "") {
      setFieldError(nameInput, "Enter the venue name.");
    } else if (name.length > 150) {
      setFieldError(nameInput, "Use 150 characters or fewer.");
    }

    const location = locationInput.value.trim();
    if (location === "") {
      setFieldError(locationInput, "Enter the location.");
    } else if (location.length > 255) {
      setFieldError(locationInput, "Use 255 characters or fewer.");
    }

    const capacity = Number(capacityInput.value);
    if (capacityInput.value.trim() === "" || !Number.isInteger(capacity) || capacity < 1) {
      setFieldError(capacityInput, "Enter a whole number, 1 or more.");
    }

    return !form.querySelector(".field-error");
  }

  async function saveVenue(submitEvent) {
    submitEvent.preventDefault();
    formMessage.innerHTML = "";

    if (!validateForm()) {
      focusFirstError(form);
      return;
    }

    const details = {
      venue_name: nameInput.value.trim(),
      location: locationInput.value.trim(),
      capacity: Number(capacityInput.value)
    };

    setBusy(saveButton, true, "Saving…");

    try {
      if (editingId === null) {
        await api.createVenue(details);
        showToast("success", "Venue added: " + details.venue_name + ".");
      } else {
        await api.updateVenue(editingId, details);
        showToast("success", "Changes saved to " + details.venue_name + ".");
      }
      dialog.close();
      await loadVenues();
    } catch (error) {
      // For example 409 when the new capacity is smaller than the
      // tickets already allocated to an event at this venue
      showError(formMessage, error);
    } finally {
      setBusy(saveButton, false);
    }
  }

  // ----- Delete -----

  async function deleteVenue(id) {
    const venue = venues.find((item) => item.venue_id === id);

    const yes = await confirmAction(
      "Delete " + venue.venue_name + "?",
      "The venue is removed from the list. This cannot be undone.",
      "Delete venue"
    );
    if (!yes) {
      return;
    }

    try {
      await api.deleteVenue(id);
      showToast("success", "Venue deleted: " + venue.venue_name + ".");
      await loadVenues();
    } catch (error) {
      // 409 = an event still uses this venue
      showErrorToast(error);
    }
  }

  // ----- Wire up the buttons -----

  document.getElementById("create-button").addEventListener("click", openAddForm);
  document.getElementById("cancel-button").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", saveVenue);

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const id = Number(button.dataset.id);
    if (button.dataset.action === "edit") {
      openEditForm(id);
    } else {
      deleteVenue(id);
    }
  });

  loadVenues();
}
