// ---------------------------------------------------------
// manage-events.js  (manage-events.html)
// Create, edit and delete events.
//   organiser -> sees and manages only their own events
//   admin     -> sees and manages every event
// Endpoints used: GET /events, GET /events/:id, POST /events,
//                 PUT /events/:id, DELETE /events/:id,
//                 GET /venues, GET /users (admin only)
// ---------------------------------------------------------

renderHeader();

const user = requireRole(["organiser", "admin"]);

if (user) {
  startManageEventsPage();
}

function startManageEventsPage() {
  const messageElement = document.getElementById("message");
  const summaryElement = document.getElementById("summary");
  const tableWrap = document.getElementById("table-wrap");
  const tableHead = document.getElementById("table-head");
  const tableBody = document.getElementById("table-body");

  const dialog = document.getElementById("event-dialog");
  const form = document.getElementById("event-form");
  const formMessage = document.getElementById("form-message");
  const dialogTitle = document.getElementById("dialog-title");
  const saveButton = document.getElementById("save-button");
  const nameInput = document.getElementById("event-name");
  const descriptionInput = document.getElementById("description");
  const venueSelect = document.getElementById("venue");
  const dateInput = document.getElementById("event-date");
  const priceInput = document.getElementById("ticket-price");
  const ticketsInput = document.getElementById("total-tickets");
  const capacityHint = document.getElementById("capacity-hint");
  const fixedNote = document.getElementById("fixed-note");

  const isAdmin = user.role === "admin";

  let events = [];
  let venues = [];
  let organiserNames = {};   // user_id -> name, filled for admins only
  let editingId = null;      // null while creating, an event_id while editing

  tableHead.innerHTML = `
    <th>Event</th>
    <th>Venue</th>
    <th>Date</th>
    <th class="num">Price</th>
    <th class="num">Tickets left</th>
    ${isAdmin ? "<th>Organiser</th>" : ""}
    <th><span class="sr-only">Actions</span></th>`;

  // ----- Load and show -----

  async function loadData() {
    try {
      const requests = [api.getEvents(), api.getVenues()];
      // Only an admin is allowed to read the users list
      if (isAdmin) {
        requests.push(api.getUsers());
      }
      const [eventsResult, venuesResult, usersResult] = await Promise.all(requests);

      venues = venuesResult.data;

      if (usersResult) {
        usersResult.data.forEach((person) => {
          organiserNames[person.user_id] = person.name;
        });
      }

      // An organiser manages only the events they created
      events = eventsResult.data.filter(
        (event) => isAdmin || event.organiser_id === user.user_id
      );
      events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

      showEvents();
    } catch (error) {
      summaryElement.textContent = "Events could not be loaded.";
      tableWrap.classList.add("hidden");
      showError(messageElement, error);
    }
  }

  function venueOf(event) {
    return venues.find((venue) => venue.venue_id === event.venue_id) || {};
  }

  function showEvents() {
    messageElement.innerHTML = "";

    if (events.length === 0) {
      summaryElement.textContent = "";
      tableWrap.classList.add("hidden");
      messageElement.innerHTML = `
        <div class="state">
          <h2>${isAdmin ? "There are no events yet" : "You have not created any events"}</h2>
          <p>Create one and it appears on the public events page straight away.</p>
        </div>`;
      return;
    }

    const sold = events.reduce(
      (sum, event) => sum + (event.total_tickets - event.available_tickets), 0
    );
    summaryElement.textContent =
      (isAdmin ? "All " + events.length + " events in the system. " : "Your " + events.length + " events. ") +
      sold + " tickets booked so far.";

    tableWrap.classList.remove("hidden");
    tableBody.innerHTML = events.map(eventRow).join("");
  }

  function eventRow(event) {
    const venue = venueOf(event);
    return `
      <tr>
        <td><a href="event.html?id=${event.event_id}">${escapeHtml(event.event_name)}</a></td>
        <td>${escapeHtml(venue.venue_name)}<span class="cell-sub">${escapeHtml(venue.location)}</span></td>
        <td>${formatDate(event.event_date)}<span class="cell-sub">${formatTime(event.event_date)}</span></td>
        <td class="num">${formatMoney(event.ticket_price)}</td>
        <td class="num">${event.available_tickets} of ${event.total_tickets}</td>
        ${isAdmin ? `<td>${escapeHtml(organiserNames[event.organiser_id] || "User " + event.organiser_id)}</td>` : ""}
        <td class="actions">
          <button type="button" class="btn btn-small btn-secondary" data-action="edit" data-id="${event.event_id}">Edit</button>
          <button type="button" class="btn btn-small btn-danger-outline" data-action="delete" data-id="${event.event_id}">Delete</button>
        </td>
      </tr>`;
  }

  // ----- Create and edit -----

  function fillVenueSelect() {
    venueSelect.innerHTML =
      '<option value="">Choose a venue</option>' +
      venues.map((venue) =>
        `<option value="${venue.venue_id}">${escapeHtml(venue.venue_name)}, ${escapeHtml(venue.location)} (holds ${venue.capacity})</option>`
      ).join("");
  }

  function selectedVenue() {
    return venues.find((venue) => venue.venue_id === Number(venueSelect.value));
  }

  function updateCapacityHint() {
    const venue = selectedVenue();
    capacityHint.textContent = venue
      ? "This venue holds up to " + venue.capacity + " people."
      : "Cannot be more than the venue holds.";
  }

  function openCreateForm() {
    editingId = null;
    form.reset();
    clearFieldErrors(form);
    formMessage.innerHTML = "";

    dialogTitle.textContent = "Create event";
    saveButton.textContent = "Create event";
    document.getElementById("venue-field").classList.remove("hidden");
    document.getElementById("tickets-field").classList.remove("hidden");
    fixedNote.classList.add("hidden");

    fillVenueSelect();
    updateCapacityHint();
    dialog.showModal();
  }

  async function openEditForm(id) {
    try {
      // Ask the API for the latest copy instead of trusting the table
      const result = await api.getEvent(id);
      const event = result.data;

      editingId = id;
      form.reset();
      clearFieldErrors(form);
      formMessage.innerHTML = "";

      dialogTitle.textContent = "Edit event";
      saveButton.textContent = "Save changes";

      nameInput.value = event.event_name;
      descriptionInput.value = event.description || "";
      dateInput.value = apiDateToInput(event.event_date);
      priceInput.value = Number(event.ticket_price).toFixed(2);

      // The API's update endpoint accepts name, description, date and
      // price only, so the other two fields are shown as plain text.
      document.getElementById("venue-field").classList.add("hidden");
      document.getElementById("tickets-field").classList.add("hidden");
      fixedNote.classList.remove("hidden");
      fixedNote.textContent =
        "Held at " + event.venue_name + " with " + event.total_tickets +
        " tickets. Venue and ticket count cannot be changed after an event is created.";

      dialog.showModal();
    } catch (error) {
      showErrorToast(error);
    }
  }

  // Returns true when every field is acceptable
  function validateForm() {
    clearFieldErrors(form);

    const name = nameInput.value.trim();
    if (name === "") {
      setFieldError(nameInput, "Enter the event name.");
    } else if (name.length > 150) {
      setFieldError(nameInput, "Use 150 characters or fewer.");
    }

    if (dateInput.value === "") {
      setFieldError(dateInput, "Choose the date and time.");
    } else if (editingId === null && new Date(dateInput.value) <= new Date()) {
      setFieldError(dateInput, "Choose a date in the future.");
    }

    const price = Number(priceInput.value);
    if (priceInput.value.trim() === "" || !Number.isFinite(price) || price < 0) {
      setFieldError(priceInput, "Enter a price of 0 or more.");
    } else if (price > 99999999.99) {
      setFieldError(priceInput, "That price is too high.");
    }

    // Venue and tickets are only part of the form when creating
    if (editingId === null) {
      const venue = selectedVenue();
      if (!venue) {
        setFieldError(venueSelect, "Choose a venue.");
      }

      const tickets = Number(ticketsInput.value);
      if (ticketsInput.value.trim() === "" || !Number.isInteger(tickets) || tickets < 1) {
        setFieldError(ticketsInput, "Enter a whole number, 1 or more.");
      } else if (venue && tickets > venue.capacity) {
        setFieldError(ticketsInput, venue.venue_name + " holds only " + venue.capacity + " people.");
      }
    }

    return !form.querySelector(".field-error");
  }

  async function saveEvent(submitEvent) {
    submitEvent.preventDefault();
    formMessage.innerHTML = "";

    if (!validateForm()) {
      focusFirstError(form);
      return;
    }

    // Shape the data exactly as the API expects it
    const details = {
      event_name: nameInput.value.trim(),
      description: descriptionInput.value.trim() || null,
      event_date: inputToApiDate(dateInput.value),
      ticket_price: Number(priceInput.value)
    };

    setBusy(saveButton, true, "Saving…");

    try {
      if (editingId === null) {
        details.venue_id = Number(venueSelect.value);
        details.total_tickets = Number(ticketsInput.value);
        await api.createEvent(details);
        showToast("success", "Event created: " + details.event_name + ".");
      } else {
        await api.updateEvent(editingId, details);
        showToast("success", "Changes saved to " + details.event_name + ".");
      }
      dialog.close();
      await loadData();
    } catch (error) {
      // The dialog stays open so nothing typed is lost
      showError(formMessage, error);
    } finally {
      setBusy(saveButton, false);
    }
  }

  // ----- Delete -----

  async function deleteEvent(id) {
    const event = events.find((item) => item.event_id === id);

    const yes = await confirmAction(
      "Delete " + event.event_name + "?",
      "The event is removed from the public events page. This cannot be undone.",
      "Delete event"
    );
    if (!yes) {
      return;
    }

    try {
      await api.deleteEvent(id);
      showToast("success", "Event deleted: " + event.event_name + ".");
      await loadData();
    } catch (error) {
      // 409 = the event has bookings, so the API refuses to delete it
      showErrorToast(error);
    }
  }

  // ----- Wire up the buttons -----

  document.getElementById("create-button").addEventListener("click", openCreateForm);
  document.getElementById("cancel-button").addEventListener("click", () => dialog.close());
  venueSelect.addEventListener("change", updateCapacityHint);
  form.addEventListener("submit", saveEvent);

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const id = Number(button.dataset.id);
    if (button.dataset.action === "edit") {
      openEditForm(id);
    } else {
      deleteEvent(id);
    }
  });

  loadData();
}
