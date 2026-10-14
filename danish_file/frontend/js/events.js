// ---------------------------------------------------------
// events.js  (index.html)
// Public page: lists every event as a ticket card.
// Endpoints used: GET /events, GET /venues
// ---------------------------------------------------------

renderHeader();

const listElement = document.getElementById("event-list");
const messageElement = document.getElementById("message");
const countElement = document.getElementById("event-count");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");

let allEvents = [];

async function loadEvents() {
  messageElement.innerHTML = "";

  try {
    // The events list only holds venue_id, so the venues are loaded
    // at the same time and joined to the events here in the browser.
    const [eventsResult, venuesResult] = await Promise.all([
      api.getEvents(),
      api.getVenues()
    ]);

    const venuesById = {};
    venuesResult.data.forEach((venue) => {
      venuesById[venue.venue_id] = venue;
    });

    allEvents = eventsResult.data.map((event) => {
      const venue = venuesById[event.venue_id] || {};
      return {
        ...event,
        venue_name: venue.venue_name || "Venue to be confirmed",
        location: venue.location || ""
      };
    });

    showEvents();
  } catch (error) {
    countElement.textContent = "Events could not be loaded.";
    listElement.innerHTML = "";
    messageElement.innerHTML =
      alertHtml("error", error.message, error.status) +
      '<button type="button" class="btn btn-secondary" id="retry">Try again</button>';
    document.getElementById("retry").addEventListener("click", loadEvents);
  }
}

// Applies the search box and sort menu, then draws the cards
function showEvents() {
  const term = searchInput.value.trim().toLowerCase();

  const matches = allEvents.filter((event) => {
    const text = (event.event_name + " " + event.venue_name + " " + event.location).toLowerCase();
    return text.includes(term);
  });

  const sorters = {
    "date": (a, b) => new Date(a.event_date) - new Date(b.event_date),
    "price-low": (a, b) => Number(a.ticket_price) - Number(b.ticket_price),
    "price-high": (a, b) => Number(b.ticket_price) - Number(a.ticket_price),
    "name": (a, b) => a.event_name.localeCompare(b.event_name)
  };
  matches.sort(sorters[sortSelect.value]);

  if (allEvents.length === 0) {
    countElement.textContent = "No events yet.";
    listElement.innerHTML = "";
    messageElement.innerHTML = `
      <div class="state">
        <h2>No events have been published</h2>
        <p>Organisers can add the first one from Manage events.</p>
      </div>`;
    return;
  }

  countElement.textContent =
    matches.length === allEvents.length
      ? allEvents.length + (allEvents.length === 1 ? " event" : " events") + " listed across Malaysia."
      : "Showing " + matches.length + " of " + allEvents.length + " events.";

  if (matches.length === 0) {
    listElement.innerHTML = "";
    messageElement.innerHTML = `
      <div class="state">
        <h2>No events match “${escapeHtml(searchInput.value.trim())}”</h2>
        <p>Try a different event name, venue or city.</p>
      </div>`;
    return;
  }

  messageElement.innerHTML = "";
  listElement.innerHTML = matches.map(ticketCard).join("");
}

// Builds one ticket card
function ticketCard(event) {
  const date = new Date(event.event_date);
  const month = date.toLocaleDateString("en-MY", { month: "short" });
  const link = "event.html?id=" + event.event_id;

  return `
    <li class="ticket">
      <div class="ticket-stub">
        <span class="stub-day">${date.getDate()}</span>
        <span class="stub-month">${month}</span>
        <span class="stub-year">${date.getFullYear()}</span>
      </div>
      <div class="ticket-body">
        <h2><a href="${link}">${escapeHtml(event.event_name)}</a></h2>
        <p>${escapeHtml(event.venue_name)}${event.location ? ", " + escapeHtml(event.location) : ""}</p>
        <p class="muted">${formatDate(event.event_date)} at ${formatTime(event.event_date)}</p>
        <div class="ticket-foot">
          <span class="price">${formatMoney(event.ticket_price)}</span>
          ${availabilityLabel(event)}
          <a class="btn btn-small" href="${link}">View event</a>
        </div>
      </div>
    </li>`;
}

function availabilityLabel(event) {
  if (isPast(event.event_date)) {
    return '<span class="availability none">Event has ended</span>';
  }
  if (event.available_tickets === 0) {
    return '<span class="availability none">Sold out</span>';
  }
  if (event.available_tickets <= 20) {
    return `<span class="availability low">Only ${event.available_tickets} left</span>`;
  }
  return `<span class="availability">${event.available_tickets} tickets left</span>`;
}

searchInput.addEventListener("input", showEvents);
sortSelect.addEventListener("change", showEvents);

loadEvents();
