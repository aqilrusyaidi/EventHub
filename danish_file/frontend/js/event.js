// ---------------------------------------------------------
// event.js  (event.html?id=1)
// Shows one event and lets a customer book tickets.
// Endpoints used: GET /events/:id, GET /events/:id/weather,
//                 POST /bookings
// ---------------------------------------------------------

renderHeader();

const messageElement = document.getElementById("message");
const detailElement = document.getElementById("detail");
const bookingArea = document.getElementById("booking-area");

// Read the event id from the address bar: event.html?id=3
const eventId = new URLSearchParams(window.location.search).get("id");

let currentEvent = null;

async function loadEvent() {
  try {
    const result = await api.getEvent(eventId);
    currentEvent = result.data;
    showEvent();
    showBookingArea();
    detailElement.classList.remove("hidden");

    // Not awaited: the page is usable while the weather loads,
    // and a weather problem never blocks booking.
    loadWeather();
  } catch (error) {
    // 400 for an invalid id, 404 when the event does not exist
    detailElement.classList.add("hidden");
    showError(messageElement, error);
  }
}

function showEvent() {
  const event = currentEvent;
  document.title = event.event_name + " | EventHub";
  document.getElementById("event-name").textContent = event.event_name;
  document.getElementById("event-description").textContent =
    event.description || "The organiser has not added a description.";

  document.getElementById("event-facts").innerHTML = `
    <dt>Date</dt><dd>${formatDate(event.event_date)}</dd>
    <dt>Time</dt><dd>${formatTime(event.event_date)}</dd>
    <dt>Venue</dt><dd>${escapeHtml(event.venue_name)}</dd>
    <dt>Location</dt><dd>${escapeHtml(event.location)}</dd>
    <dt>Organiser</dt><dd>${escapeHtml(event.organiser_name)}</dd>
    <dt>Ticket price</dt><dd>${formatMoney(event.ticket_price)}</dd>
    <dt>Tickets left</dt><dd>${event.available_tickets} of ${event.total_tickets}</dd>`;
}

// Weather at the venue. Our API asks Open-Meteo (a third-party API)
// and returns either the forecast for the event day or, when the
// event is more than 16 days away, the weather right now.
async function loadWeather() {
  const weatherElement = document.getElementById("weather");

  // No point showing weather for an event that is over
  if (isPast(currentEvent.event_date)) {
    return;
  }

  weatherElement.classList.remove("hidden");
  weatherElement.innerHTML = `
    <h2>Weather at the venue</h2>
    <p class="muted">Loading weather…</p>`;

  const credit =
    '<p class="hint">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p>';

  try {
    const result = await api.getEventWeather(currentEvent.event_id);
    const weather = result.data.weather;
    const place = escapeHtml(result.data.place);
    let details;

    if (weather.type === "forecast") {
      const rain =
        weather.rain_chance === null || weather.rain_chance === undefined
          ? ""
          : ", " + weather.rain_chance + "% chance of rain";

      details = `
        <p><strong>${escapeHtml(weather.summary)}</strong>,
          ${Math.round(weather.temperature_min)} to ${Math.round(weather.temperature_max)} °C${rain}</p>
        <p class="muted">Forecast for ${formatDate(currentEvent.event_date)} in ${place}.</p>`;
    } else {
      details = `
        <p><strong>${escapeHtml(weather.summary)}</strong>,
          ${Math.round(weather.temperature)} °C in ${place} right now</p>
        <p class="muted">${escapeHtml(weather.note)}</p>`;
    }

    weatherElement.innerHTML = "<h2>Weather at the venue</h2>" + details + credit;
  } catch (error) {
    // 502 = the weather service is down, 404 = the location is unknown.
    // The rest of the page keeps working either way.
    weatherElement.innerHTML = `
      <h2>Weather at the venue</h2>
      <p class="muted">${escapeHtml(error.message)}
        ${error.status ? `<span class="status-code">HTTP ${error.status}</span>` : ""}</p>`;
  }
}

// What the booking panel shows depends on the event and on the user's role
function showBookingArea() {
  const event = currentEvent;
  const user = getUser();

  if (isPast(event.event_date)) {
    bookingArea.innerHTML = alertHtml("info", "This event has ended, so booking is closed.");
    return;
  }

  if (event.available_tickets === 0) {
    bookingArea.innerHTML = alertHtml("info", "This event is sold out.");
    return;
  }

  if (!user) {
    const next = encodeURIComponent("event.html?id=" + event.event_id);
    bookingArea.innerHTML = `
      <p>Log in with a customer account to book tickets for this event.</p>
      <a class="btn btn-block" href="login.html?next=${next}">Log in to book</a>
      <p class="auth-switch">New here? <a href="register.html">Create an account</a></p>`;
    return;
  }

  if (user.role !== "customer") {
    bookingArea.innerHTML = alertHtml(
      "info",
      "Only customer accounts can book tickets. You are logged in as " + user.role + "."
    );
    return;
  }

  bookingArea.innerHTML = `
    <form id="booking-form" novalidate>
      <div id="booking-message"></div>
      <div class="field">
        <label for="quantity">Number of tickets</label>
        <input type="number" id="quantity" min="1" max="${event.available_tickets}" step="1" value="1" inputmode="numeric">
        <p class="hint">${event.available_tickets} available at ${formatMoney(event.ticket_price)} each.</p>
      </div>
      <div class="total-line">
        <span>Total</span>
        <strong id="total">${formatMoney(event.ticket_price)}</strong>
      </div>
      <button type="submit" class="btn btn-block" id="book-button">Book tickets</button>
    </form>`;

  const form = document.getElementById("booking-form");
  const quantityInput = document.getElementById("quantity");

  // Update the total while the customer changes the quantity
  quantityInput.addEventListener("input", () => {
    const quantity = Number(quantityInput.value);
    const valid = Number.isInteger(quantity) && quantity > 0;
    document.getElementById("total").textContent =
      formatMoney(valid ? quantity * Number(event.ticket_price) : 0);
  });

  form.addEventListener("submit", bookTickets);
}

async function bookTickets(submitEvent) {
  submitEvent.preventDefault();

  const form = submitEvent.target;
  const quantityInput = document.getElementById("quantity");
  const bookingMessage = document.getElementById("booking-message");
  const button = document.getElementById("book-button");

  clearFieldErrors(form);
  bookingMessage.innerHTML = "";

  // Check the input in the browser first, before calling the API
  const quantity = Number(quantityInput.value);

  if (quantityInput.value.trim() === "" || !Number.isInteger(quantity) || quantity < 1) {
    setFieldError(quantityInput, "Enter a whole number of tickets, 1 or more.");
    quantityInput.focus();
    return;
  }

  if (quantity > currentEvent.available_tickets) {
    setFieldError(quantityInput, "Only " + currentEvent.available_tickets + " tickets are left for this event.");
    quantityInput.focus();
    return;
  }

  setBusy(button, true, "Booking…");

  try {
    const result = await api.createBooking(currentEvent.event_id, quantity);
    const booking = result.booking;

    bookingArea.innerHTML = `
      ${alertHtml("success", "Booking confirmed.")}
      <dl class="facts">
        <dt>Booking number</dt><dd>#${booking.booking_id}</dd>
        <dt>Tickets</dt><dd>${booking.quantity}</dd>
        <dt>Total</dt><dd>${formatMoney(booking.total_amount)}</dd>
      </dl>
      <a class="btn btn-block" href="bookings.html">View my bookings</a>`;

    // Load the event again so "Tickets left" shows the new number
    const fresh = await api.getEvent(currentEvent.event_id);
    currentEvent = fresh.data;
    showEvent();
  } catch (error) {
    // For example 409 when someone else took the last tickets first
    showError(bookingMessage, error);
    setBusy(button, false);
  }
}

if (!eventId) {
  messageElement.innerHTML = alertHtml("error", "No event was selected. Choose one from the events page.");
} else {
  loadEvent();
}
