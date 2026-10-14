// ---------------------------------------------------------
// bookings.js  (bookings.html)
// One page, three views. The API decides which bookings come back:
//   customer  -> only their own bookings (can cancel)
//   organiser -> bookings for the events they organise (view only)
//   admin     -> every booking (can cancel)
// Endpoints used: GET /bookings, GET /bookings/:id,
//                 PATCH /bookings/:id/cancel
// ---------------------------------------------------------

renderHeader();

const user = requireRole(["customer", "organiser", "admin"]);

if (user) {
  startBookingsPage();
}

function startBookingsPage() {
  const messageElement = document.getElementById("message");
  const summaryElement = document.getElementById("summary");
  const tableWrap = document.getElementById("table-wrap");
  const tableHead = document.getElementById("table-head");
  const tableBody = document.getElementById("table-body");
  const statusFilter = document.getElementById("status-filter");
  const dialog = document.getElementById("booking-dialog");

  const isCustomer = user.role === "customer";
  const canCancel = user.role === "customer" || user.role === "admin";

  let bookings = [];

  // Page title and empty-state text for each role
  const TEXT = {
    customer: {
      title: "My bookings",
      emptyTitle: "You have no bookings yet",
      emptyText: "Pick an event and book your first tickets."
    },
    organiser: {
      title: "Bookings for my events",
      emptyTitle: "No one has booked your events yet",
      emptyText: "Bookings appear here as soon as customers buy tickets."
    },
    admin: {
      title: "All bookings",
      emptyTitle: "There are no bookings in the system",
      emptyText: "Bookings appear here as soon as customers buy tickets."
    }
  };

  document.getElementById("page-title").textContent = TEXT[user.role].title;
  document.title = TEXT[user.role].title + " | EventHub";

  // Customers do not need a "Customer" column: every row is theirs
  tableHead.innerHTML = `
    <th>Booking</th>
    <th>Event</th>
    ${isCustomer ? "" : "<th>Customer</th>"}
    <th class="num">Tickets</th>
    <th class="num">Total</th>
    <th>Status</th>
    <th>Booked on</th>
    <th><span class="sr-only">Actions</span></th>`;

  async function loadBookings() {
    try {
      const result = await api.getBookings();
      bookings = result.data;
      showBookings();
    } catch (error) {
      summaryElement.textContent = "Bookings could not be loaded.";
      tableWrap.classList.add("hidden");
      showError(messageElement, error);
    }
  }

  function showBookings() {
    messageElement.innerHTML = "";

    if (bookings.length === 0) {
      summaryElement.textContent = "";
      tableWrap.classList.add("hidden");
      messageElement.innerHTML = `
        <div class="state">
          <h2>${TEXT[user.role].emptyTitle}</h2>
          <p>${TEXT[user.role].emptyText}</p>
          ${isCustomer ? '<a class="btn" href="index.html">Browse events</a>' : ""}
        </div>`;
      return;
    }

    const confirmed = bookings.filter((booking) => booking.status === "confirmed");
    const confirmedTotal = confirmed.reduce((sum, booking) => sum + Number(booking.total_amount), 0);
    summaryElement.textContent =
      confirmed.length + " confirmed, " +
      (bookings.length - confirmed.length) + " cancelled. " +
      "Confirmed total: " + formatMoney(confirmedTotal) + ".";

    const visible = bookings.filter(
      (booking) => statusFilter.value === "all" || booking.status === statusFilter.value
    );

    if (visible.length === 0) {
      tableWrap.classList.add("hidden");
      messageElement.innerHTML = `
        <div class="state">
          <h2>No ${escapeHtml(statusFilter.value)} bookings</h2>
          <p>Change the filter to see the others.</p>
        </div>`;
      return;
    }

    tableWrap.classList.remove("hidden");
    tableBody.innerHTML = visible.map(bookingRow).join("");
  }

  function bookingRow(booking) {
    const cancelButton =
      canCancel && booking.status === "confirmed"
        ? `<button type="button" class="btn btn-small btn-danger-outline" data-action="cancel" data-id="${booking.booking_id}">Cancel booking</button>`
        : "";

    return `
      <tr>
        <td>#${booking.booking_id}</td>
        <td><a href="event.html?id=${booking.event_id}">${escapeHtml(booking.event_name)}</a></td>
        ${isCustomer ? "" : `<td>${escapeHtml(booking.customer_name)}</td>`}
        <td class="num">${booking.quantity}</td>
        <td class="num">${formatMoney(booking.total_amount)}</td>
        <td><span class="badge badge-${booking.status}">${capitalise(booking.status)}</span></td>
        <td>${formatDate(booking.booking_date)}</td>
        <td class="actions">
          <button type="button" class="btn btn-small btn-secondary" data-action="view" data-id="${booking.booking_id}">View</button>
          ${cancelButton}
        </td>
      </tr>`;
  }

  // One click listener for the whole table (event delegation):
  // it works for rows that are redrawn later as well.
  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const id = Number(button.dataset.id);
    if (button.dataset.action === "view") {
      viewBooking(id);
    } else {
      cancelBooking(id, button);
    }
  });

  // Fetches one booking from the API and shows it as a ticket
  async function viewBooking(id) {
    try {
      const result = await api.getBooking(id);
      const booking = result.data;

      document.getElementById("receipt-number").textContent = "#" + booking.booking_id;
      document.getElementById("receipt-title").textContent = booking.event_name;
      document.getElementById("receipt-facts").innerHTML = `
        <dt>Customer</dt><dd>${escapeHtml(booking.customer_name)}</dd>
        <dt>Tickets</dt><dd>${booking.quantity}</dd>
        <dt>Total</dt><dd>${formatMoney(booking.total_amount)}</dd>
        <dt>Status</dt><dd><span class="badge badge-${booking.status}">${capitalise(booking.status)}</span></dd>
        <dt>Booked on</dt><dd>${formatDateTime(booking.booking_date)}</dd>`;

      dialog.showModal();
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function cancelBooking(id, button) {
    const booking = bookings.find((item) => item.booking_id === id);

    const yes = await confirmAction(
      "Cancel booking #" + id + "?",
      booking.quantity + " ticket(s) for " + booking.event_name +
      " will be released for other customers. This cannot be undone.",
      "Cancel booking"
    );
    if (!yes) {
      return;
    }

    setBusy(button, true, "Cancelling…");

    try {
      const result = await api.cancelBooking(id);
      showToast(
        "success",
        "Booking #" + id + " cancelled. " + result.tickets_restored + " ticket(s) released."
      );
      await loadBookings();
    } catch (error) {
      // 400 = the event already took place, 409 = already cancelled
      showErrorToast(error);
      setBusy(button, false);
    }
  }

  statusFilter.addEventListener("change", showBookings);
  document.getElementById("close-receipt").addEventListener("click", () => dialog.close());

  loadBookings();
}
