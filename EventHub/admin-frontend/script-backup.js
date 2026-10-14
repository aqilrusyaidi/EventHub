// STEP 7R - Admin/Organiser Authentication

const STAFF_API_URL = "http://localhost:3000/api";

const staffLoginForm = document.getElementById("staffLoginForm");
const staffLoginBtn = document.getElementById("staffLoginBtn");
const staffLogoutBtn = document.getElementById("staffLogoutBtn");
const staffWelcome = document.getElementById("staffWelcome");
const staffLoginMessage = document.getElementById("staffLoginMessage");

// Dashboard management buttons
const managementButtons = [
  document.getElementById("manageEventsBtn"),
  document.getElementById("manageVenuesBtn"),
  document.getElementById("manageBookingsBtn"),
  document.getElementById("manageUsersBtn")
];

function updateStaffDashboard() {
  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  const isStaff =
    Boolean(token) &&
    ["admin", "organiser"].includes(role);

  staffLoginBtn.classList.toggle("d-none", isStaff);
  staffLogoutBtn.classList.toggle("d-none", !isStaff);

  staffWelcome.textContent = isStaff
    ? "Welcome, " + role.charAt(0).toUpperCase() + role.slice(1)
    : "Admin / Organiser Portal";

  // Only enable buttons allowed for the staff role
  managementButtons.forEach((button, index) => {
    if (!button) return;

    const isUsersButton = index === 3;

    button.disabled = !isStaff || (isUsersButton && role !== "admin");
  });
}

// Login to backend
staffLoginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("staffEmail").value.trim();
  const password = document.getElementById("staffPassword").value;
  const submitButton = staffLoginForm.querySelector(
    'button[type="submit"]'
  );

  submitButton.disabled = true;
  staffLoginMessage.textContent = "Logging in...";
  staffLoginMessage.className = "alert alert-info";

  try {
    const response = await fetch(STAFF_API_URL + "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Login failed");
    }

    const token = result.token || result.accessToken;

    if (!token) {
      throw new Error("No JWT token returned by the server");
    }

    // Decode role for interface display.
    // Backend remains responsible for authorisation.
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    if (!["admin", "organiser"].includes(payload.role)) {
      throw new Error("Only admins and organisers can access this portal");
    }

    // Keep staff credentials separate from the Customer Portal
    sessionStorage.setItem("eventhub_staff_token", token);
    sessionStorage.setItem("eventhub_staff_role", payload.role);

    staffLoginMessage.textContent =
      "Login successful! Welcome to the dashboard.";
    staffLoginMessage.className = "alert alert-success";

    document.getElementById("staffPassword").value = "";

    
async function restoreStaffDashboard() {
  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  // Do not load protected statistics when logged out
  if (!token || !["admin", "organiser"].includes(role)) {
    return;
  }

  // Reload dashboard statistics after a page refresh
  await Promise.allSettled([
    loadTotalEvents(),
    loadTotalVenues(),
    loadTotalBookings(),
    ...(role === "admin" ? [loadTotalUsers()] : [])
  ]);
}

    updateStaffDashboard();
    loadTotalBookings();
    loadTotalUsers();
    loadTotalEvents();
    loadTotalVenues();

  } catch (error) {
    staffLoginMessage.textContent = error.message;
    staffLoginMessage.className = "alert alert-danger";

  } finally {
    submitButton.disabled = false;
  }
});

// Logout
staffLogoutBtn.addEventListener("click", function () {
  sessionStorage.removeItem("eventhub_staff_token");
  sessionStorage.removeItem("eventhub_staff_role");

  // Clear previous dashboard summary data
  ["totalEvents", "totalVenues", "totalBookings", "totalUsers"]
    .forEach((id) => {
      document.getElementById(id).textContent = "--";
    });

  updateStaffDashboard();
  alert("You have successfully logged out.");
});

// Lock the dashboard when the page first loads
updateStaffDashboard();

// STEP 7S - Load Total Events

async function loadTotalEvents() {
  const totalEventsElement =
    document.getElementById("totalEvents");

  try {
    const response = await fetch(
      STAFF_API_URL + "/events"
    );

    if (!response.ok) {
      throw new Error("Failed to load events");
    }

    const result = await response.json();

    const events = Array.isArray(result)
      ? result
      : (result.data || result.events || []);

    if (!Array.isArray(events)) {
      throw new Error("Invalid events response");
    }

    totalEventsElement.textContent = events.length;

  } catch (error) {
    console.error("Dashboard events error:", error);
    totalEventsElement.textContent = "Error";
  }
}

// Load event statistics when the dashboard opens
loadTotalEvents();

// STEP 7T - Load Total Venues

async function loadTotalVenues() {
  const totalVenuesElement =
    document.getElementById("totalVenues");

  try {
    const response = await fetch(
      STAFF_API_URL + "/venues"
    );

    if (!response.ok) {
      throw new Error("Failed to load venues");
    }

    const result = await response.json();

    // Support existing EventHub API response format
    const venues = Array.isArray(result)
      ? result
      : (result.data || result.venues || []);

    if (!Array.isArray(venues)) {
      throw new Error("Invalid venues response");
    }

    // Display total number of venues
    totalVenuesElement.textContent = venues.length;

  } catch (error) {
    console.error("Dashboard venues error:", error);
    totalVenuesElement.textContent = "Error";
  }
}

// Load venue statistics when dashboard opens
loadTotalVenues();

// STEP 7U - Load Total Bookings

async function loadTotalBookings() {
  const totalBookingsElement =
    document.getElementById("totalBookings");

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  // Booking statistics require staff authentication
  if (!token || !["admin", "organiser"].includes(role)) {
    totalBookingsElement.textContent = "--";
    return;
  }

  totalBookingsElement.textContent = "Loading...";

  try {
    const response = await fetch(
      STAFF_API_URL + "/bookings",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (response.status === 401) {
  handleExpiredStaffSession();
  return;
}

    const result = await response.json();  


    if (!response.ok) {
      throw new Error(
        result.message || "Failed to load bookings"
      );
    }

    const bookings = Array.isArray(result)
      ? result
      : (result.data || result.bookings || []);

    if (!Array.isArray(bookings)) {
      throw new Error("Invalid bookings response");
    }

    totalBookingsElement.textContent = bookings.length;

  } catch (error) {
    console.error("Dashboard bookings error:", error);
    totalBookingsElement.textContent = "Error";
  }
}

// STEP 7V - Load Total Users (Admin Only)

async function loadTotalUsers() {
  const totalUsersElement =
    document.getElementById("totalUsers");

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  // Only administrators can view user statistics
  if (!token || role !== "admin") {
    totalUsersElement.textContent = "--";
    return;
  }

  totalUsersElement.textContent = "Loading...";

  try {
    const response = await fetch(
      STAFF_API_URL + "/users",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

if (response.status === 401) {
  handleExpiredStaffSession();
  return;
}

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to load users"
      );
    }

    const users = Array.isArray(result)
      ? result
      : (result.data || result.users || []);

    if (!Array.isArray(users)) {
      throw new Error("Invalid users response");
    }

    totalUsersElement.textContent = users.length;

  } catch (error) {
    console.error("Dashboard users error:", error);
    totalUsersElement.textContent = "Error";
  }
}

// STEP 7X - Display Events in Management Dashboard

const manageEventsBtn = document.getElementById("manageEventsBtn");
const manageEventsSection =
  document.getElementById("manageEventsSection");

const eventsManagementBody =
  document.getElementById("eventsManagementBody");

const eventsManagementMessage =
  document.getElementById("eventsManagementMessage");

// Show and load events when the button is clicked
manageEventsBtn.addEventListener("click", async function () {
  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  if (!token || !["admin", "organiser"].includes(role)) {
    alert("Please log in as an administrator or organiser.");
    return;
  }

  manageEventsSection.classList.remove("d-none");
  manageEventsSection.scrollIntoView({ behavior: "smooth" });

  eventsManagementMessage.textContent = "Loading events...";
  eventsManagementBody.innerHTML = "";

  try {
    const response = await fetch(STAFF_API_URL + "/events");

    if (!response.ok) {
      throw new Error("Failed to load events");
    }

    const result = await response.json();

    const events = Array.isArray(result)
      ? result
      : (result.data || result.events || []);

    if (!Array.isArray(events)) {
      throw new Error("Invalid events response format");
    }

    if (events.length === 0) {
      eventsManagementMessage.textContent =
        "No events available.";
      return;
    }

    eventsManagementMessage.textContent = "";

    events.forEach((event) => {
      const row = document.createElement("tr");

      const values = [
        event.event_id,
        event.event_name,
        event.event_date
          ? new Date(event.event_date).toLocaleDateString("en-MY")
          : "-",
        "RM " + Number(event.ticket_price).toFixed(2),
        event.available_tickets
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      // Actions will be implemented in later steps
      // STEP 7AA - Edit Event Button
const actionsCell = document.createElement("td");

const editButton = document.createElement("button");
editButton.type = "button";
editButton.className = "btn btn-sm btn-warning";
editButton.textContent = "Edit";

editButton.addEventListener("click", function () {
  // Store the selected event ID
  document.getElementById("editEventId").value =
    event.event_id;

  // Fill the form with existing event information
  document.getElementById("editEventName").value =
    event.event_name || "";

  document.getElementById("editEventDescription").value =
    event.description || "";

  // Convert API date to datetime-local format
  const date = new Date(event.event_date);

  if (!Number.isNaN(date.getTime())) {
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );

    document.getElementById("editEventDate").value =
      localDate.toISOString().slice(0, 16);
  }

  document.getElementById("editEventVenue").value =
    event.venue_id;

  document.getElementById("editEventPrice").value =
    event.ticket_price;

  document.getElementById("editEventTickets").value =
    event.total_tickets;

  // Clear previous messages
  const message = document.getElementById("editEventMessage");
  message.textContent = "";
  message.className = "";

  // Open Edit Event pop-up
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("editEventModal")
  ).show();
});

actionsCell.appendChild(editButton);
// STEP 7AC - Delete Event Button

const deleteButton = document.createElement("button");
deleteButton.type = "button";
deleteButton.className = "btn btn-sm btn-danger ms-2";
deleteButton.textContent = "Delete";

deleteButton.addEventListener("click", async function () {

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  if (!token || !["admin", "organiser"].includes(role)) {
    alert("Please log in as an administrator or organiser.");
    return;
  }

  // Prevent accidental deletion
  const confirmed = confirm(
    "Are you sure you want to delete this event?\n\n" +
    event.event_name +
    "\n\nThis action cannot be undone."
  );

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  deleteButton.textContent = "Deleting...";

  try {
    const response = await fetch(
      STAFF_API_URL + "/events/" + event.event_id,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    // Handle JSON or empty responses
    const responseText = await response.text();
    let result = {};

    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error("Invalid server response");
      }
    }

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to delete event"
      );
    }

    alert("Event deleted successfully!");

    // Refresh the dashboard count
    await loadTotalEvents();

    // Refresh the Manage Events table
    manageEventsBtn.click();

  } catch (error) {
    console.error("Delete event error:", error);
    alert("Delete failed: " + error.message);

    deleteButton.disabled = false;
    deleteButton.textContent = "Delete";
  }
});

actionsCell.appendChild(deleteButton);

row.appendChild(actionsCell);
eventsManagementBody.appendChild(row);
    });

  } catch (error) {
    console.error("Manage Events error:", error);

    eventsManagementMessage.textContent = error.message;
    eventsManagementMessage.className = "text-danger";
  }
});

// STEP 7Z - Create New Event

const addEventForm = document.getElementById("addEventForm");

addEventForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  const message = document.getElementById("addEventMessage");
  const submitButton = addEventForm.querySelector(
    'button[type="submit"]'
  );

  // Check staff login
  if (!token || !["admin", "organiser"].includes(role)) {
    message.textContent = "Please log in as an administrator or organiser.";
    message.className = "alert alert-danger";
    return;
  }

  // Read form values
  const eventName = document.getElementById("newEventName").value.trim();

  const description = document.getElementById(
    "newEventDescription"
  ).value.trim();

  const eventDate = document.getElementById("newEventDate").value;

  const venueId = Number(
    document.getElementById("newEventVenue").value
  );

  const ticketPrice = Number(
    document.getElementById("newEventPrice").value
  );

  const totalTickets = Number(
    document.getElementById("newEventTickets").value
  );

  // Validate input
  if (
    !eventName ||
    !description ||
    !eventDate ||
    !Number.isInteger(venueId) ||
    venueId < 1 ||
    !Number.isFinite(ticketPrice) ||
    ticketPrice < 0 ||
    !Number.isInteger(totalTickets) ||
    totalTickets < 1
  ) {
    message.textContent = "Please enter valid event information.";
    message.className = "alert alert-danger";
    return;
  }

  // Convert datetime-local to MySQL DATETIME format
  const mysqlDate = eventDate.replace("T", " ") + ":00";

  submitButton.disabled = true;
  message.textContent = "Creating event...";
  message.className = "alert alert-info";

  try {
    const response = await fetch(
      STAFF_API_URL + "/events",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          event_name: eventName,
          description: description,
          event_date: mysqlDate,
          venue_id: venueId,
          ticket_price: ticketPrice,
          total_tickets: totalTickets
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to create event"
      );
    }

    message.textContent = "Event created successfully!";
    message.className = "alert alert-success";

    addEventForm.reset();

    // Refresh dashboard event count
    await loadTotalEvents();

    // Refresh event management table
    manageEventsBtn.click();

  } catch (error) {
    message.textContent = error.message;
    message.className = "alert alert-danger";

  } finally {
    submitButton.disabled = false;
  }
});

// STEP 7AB - Update Existing Event

const editEventForm = document.getElementById("editEventForm");

editEventForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  const message = document.getElementById("editEventMessage");
  const submitButton = editEventForm.querySelector(
    'button[type="submit"]'
  );

  // Check staff login
  if (!token || !["admin", "organiser"].includes(role)) {
    message.textContent =
      "Please log in as an administrator or organiser.";
    message.className = "alert alert-danger";
    return;
  }

  // Read selected event ID
  const eventId = Number(
    document.getElementById("editEventId").value
  );

  // Read updated form values
  const eventName =
    document.getElementById("editEventName").value.trim();

  const description =
    document.getElementById("editEventDescription").value.trim();

  const eventDate =
    document.getElementById("editEventDate").value;

  const venueId = Number(
    document.getElementById("editEventVenue").value
  );

  const ticketPrice = Number(
    document.getElementById("editEventPrice").value
  );

  const totalTickets = Number(
    document.getElementById("editEventTickets").value
  );

  // Validate input
  if (
    !Number.isSafeInteger(eventId) ||
    eventId <= 0 ||
    !eventName ||
    !description ||
    !eventDate ||
    !Number.isSafeInteger(venueId) ||
    venueId <= 0 ||
    !Number.isFinite(ticketPrice) ||
    ticketPrice < 0 ||
    !Number.isSafeInteger(totalTickets) ||
    totalTickets < 1
  ) {
    message.textContent =
      "Please enter valid event information.";
    message.className = "alert alert-danger";
    return;
  }

  // Convert datetime-local to MySQL DATETIME format
  const mysqlDate = eventDate.replace("T", " ") + ":00";

  submitButton.disabled = true;
  message.textContent = "Updating event...";
  message.className = "alert alert-info";

  try {
    const response = await fetch(
      STAFF_API_URL + "/events/" + eventId,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          event_name: eventName,
          description: description,
          event_date: mysqlDate,
          venue_id: venueId,
          ticket_price: ticketPrice,
          total_tickets: totalTickets
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to update event"
      );
    }

    message.textContent = "Event updated successfully!";
    message.className = "alert alert-success";

    // Refresh dashboard statistics
    await loadTotalEvents();

    // Refresh Manage Events table
    manageEventsBtn.click();

  } catch (error) {
    console.error("Update event error:", error);

    message.textContent = error.message;
    message.className = "alert alert-danger";

  } finally {
    submitButton.disabled = false;
  }
});

// ==========================================
// STEP 7AE - Manage Venues
// ==========================================

const manageVenuesButton =
  document.getElementById("manageVenuesBtn");

const manageVenuesSection =
  document.getElementById("manageVenuesSection");

const venuesManagementBody =
  document.getElementById("venuesManagementBody");

const venuesManagementMessage =
  document.getElementById("venuesManagementMessage");

manageVenuesButton.addEventListener("click", async function () {

  // Check staff login
  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  if (!token || !["admin", "organiser"].includes(role)) {
    alert("Please log in as an administrator or organiser.");
    return;
  }

  // Show Manage Venues section
  manageVenuesSection.classList.remove("d-none");

  // Hide Manage Events section
  document.getElementById("manageEventsSection")
    .classList.add("d-none");

  manageVenuesSection.scrollIntoView({
    behavior: "smooth"
  });

  venuesManagementMessage.textContent = "Loading venues...";
  venuesManagementMessage.className = "";

  venuesManagementBody.innerHTML = "";

  try {
    // Retrieve venues from backend
    const response = await fetch(STAFF_API_URL + "/venues");

    if (!response.ok) {
      throw new Error("Failed to load venues");
    }

    const result = await response.json();

    // Support existing API response structure
    const venues = Array.isArray(result)
      ? result
      : (result.data || result.venues || []);

    if (!Array.isArray(venues)) {
      throw new Error("Invalid venues response format");
    }

    if (venues.length === 0) {
      venuesManagementMessage.textContent =
        "No venues available.";
      return;
    }

    venuesManagementMessage.textContent = "";

    venues.forEach((venue) => {
      const row = document.createElement("tr");

      // Display venue information safely
      const values = [
        venue.venue_id,
        venue.venue_name,
        venue.location,
        venue.capacity
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "-";
        row.appendChild(cell);
      });

      // Venue editing and deletion come later
      
    // STEP 7AH - Edit Venue Button
    const actionsCell = document.createElement("td");

    const editVenueButton = document.createElement("button");
    editVenueButton.type = "button";
    editVenueButton.className = "btn btn-sm btn-warning";
    editVenueButton.textContent = "Edit";

    editVenueButton.addEventListener("click", function () {
      // Remember which venue was selected
      document.getElementById("editVenueId").value =
        venue.venue_id;

      // Populate the form with existing venue details
      document.getElementById("editVenueName").value =
        venue.venue_name || "";

      document.getElementById("editVenueLocation").value =
        venue.location || "";

      document.getElementById("editVenueCapacity").value =
        venue.capacity;

      // Clear previous messages
      const message = document.getElementById("editVenueMessage");
      message.textContent = "";
      message.className = "";

      // Open the Edit Venue modal
      bootstrap.Modal.getOrCreateInstance(
        document.getElementById("editVenueModal")
      ).show();
    });

    actionsCell.appendChild(editVenueButton);

    // STEP 7AJ - Delete Venue Button

const deleteVenueButton = document.createElement("button");
deleteVenueButton.type = "button";
deleteVenueButton.className = "btn btn-sm btn-danger ms-2";
deleteVenueButton.textContent = "Delete";

deleteVenueButton.addEventListener("click", async function () {
  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  // Only administrators can delete venues
  if (!token || role !== "admin") {
    alert("Only administrators can delete venues.");
    return;
  }

  // Ask for confirmation before deleting
  const confirmed = confirm(
    "Are you sure you want to delete this venue?\n\n" +
    venue.venue_name +
    "\n\nThis action cannot be undone."
  );

  if (!confirmed) {
    return;
  }

  deleteVenueButton.disabled = true;
  deleteVenueButton.textContent = "Deleting...";

  try {
    const response = await fetch(
      STAFF_API_URL + "/venues/" + venue.venue_id,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const responseText = await response.text();

    let result = {};

    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        if (!response.ok) {
          throw new Error(
            "Server returned an invalid response"
          );
        }
      }
    }

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to delete venue"
      );
    }

    alert("Venue deleted successfully!");

    // Refresh Total Venues dashboard card
    await loadTotalVenues();

    // Refresh Manage Venues table
    manageVenuesButton.click();

  } catch (error) {
    console.error("Delete Venue error:", error);
    alert("Delete failed: " + error.message);

  } finally {
    deleteVenueButton.disabled = false;
    deleteVenueButton.textContent = "Delete";
  }
});

actionsCell.appendChild(deleteVenueButton);

    row.appendChild(actionsCell);
    venuesManagementBody.appendChild(row);

    });

  } catch (error) {
    console.error("Manage Venues error:", error);

    venuesManagementMessage.textContent =
      "Unable to load venues: " + error.message;

    venuesManagementMessage.className = "text-danger";
  }
});

// ==========================================
// STEP 7AG - Create New Venue
// ==========================================

const addVenueForm = document.getElementById("addVenueForm");

addVenueForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  const message = document.getElementById("addVenueMessage");
  const submitButton = addVenueForm.querySelector(
    'button[type="submit"]'
  );

  // Only administrators can create venues
  if (!token || role !== "admin") {
    message.textContent =
      "Only administrators can create venues.";
    message.className = "alert alert-danger";
    return;
  }

  // Read the form values
  const venueName = document.getElementById(
    "newVenueName"
  ).value.trim();

  const location = document.getElementById(
    "newVenueLocation"
  ).value.trim();

  const capacity = Number(
    document.getElementById("newVenueCapacity").value
  );

  // Validate inputs before submitting
  if (
    !venueName ||
    !location ||
    !Number.isSafeInteger(capacity) ||
    capacity < 1
  ) {
    message.textContent =
      "Please enter a venue name, location and valid capacity.";
    message.className = "alert alert-danger";
    return;
  }

  // Prevent duplicate clicks
  submitButton.disabled = true;

  message.textContent = "Creating venue...";
  message.className = "alert alert-info";

  try {
    const response = await fetch(
      STAFF_API_URL + "/venues",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          venue_name: venueName,
          location: location,
          capacity: capacity
        })
      }
    );

    const responseText = await response.text();
    let result = {};

    if (responseText) {
      result = JSON.parse(responseText);
    }

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to create venue"
      );
    }

    message.textContent = "Venue created successfully!";
    message.className = "alert alert-success";

    // Clear the form after successful creation
    addVenueForm.reset();

    // Update Total Venues dashboard card
    await loadTotalVenues();

    // Refresh the Manage Venues table
    manageVenuesButton.click();

  } catch (error) {
    console.error("Create Venue error:", error);

    message.textContent = error.message;
    message.className = "alert alert-danger";

  } finally {
    submitButton.disabled = false;
  }
});

// ==========================================
// STEP 7AI - Update Existing Venue
// ==========================================

const editVenueForm = document.getElementById("editVenueForm");

editVenueForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  const message = document.getElementById("editVenueMessage");
  const submitButton = editVenueForm.querySelector(
    'button[type="submit"]'
  );

  // Only administrators can update venues
  if (!token || role !== "admin") {
    message.textContent =
      "Only administrators can update venues.";
    message.className = "alert alert-danger";
    return;
  }

  // Read venue ID and form values
  const venueId = Number(
    document.getElementById("editVenueId").value
  );

  const venueName = document.getElementById(
    "editVenueName"
  ).value.trim();

  const location = document.getElementById(
    "editVenueLocation"
  ).value.trim();

  const capacity = Number(
    document.getElementById("editVenueCapacity").value
  );

  // Validate inputs
  if (
    !Number.isSafeInteger(venueId) ||
    venueId < 1 ||
    !venueName ||
    !location ||
    !Number.isSafeInteger(capacity) ||
    capacity < 1
  ) {
    message.textContent =
      "Please enter a valid venue name, location and capacity.";
    message.className = "alert alert-danger";
    return;
  }

  // Prevent duplicate submissions
  submitButton.disabled = true;

  message.textContent = "Updating venue...";
  message.className = "alert alert-info";

  try {
    const response = await fetch(
      STAFF_API_URL + "/venues/" + venueId,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          venue_name: venueName,
          location: location,
          capacity: capacity
        })
      }
    );

    const responseText = await response.text();
    const result = responseText
      ? JSON.parse(responseText)
      : {};

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to update venue"
      );
    }

    message.textContent = "Venue updated successfully!";
    message.className = "alert alert-success";

    // Refresh venue statistics
    await loadTotalVenues();

    // Refresh Manage Venues table
    manageVenuesButton.click();

  } catch (error) {
    console.error("Update Venue error:", error);

    message.textContent = error.message;
    message.className = "alert alert-danger";

  } finally {
    submitButton.disabled = false;
  }
});

// ==========================================
// STEP 7AL - Manage Bookings
// ==========================================

const manageBookingsButton =
  document.getElementById("manageBookingsBtn");

const manageBookingsSection =
  document.getElementById("manageBookingsSection");

const bookingsManagementBody =
  document.getElementById("bookingsManagementBody");

const bookingsManagementMessage =
  document.getElementById("bookingsManagementMessage");

manageBookingsButton.addEventListener("click", async function () {

alert("Manage Bookings function is running!");

  // Check staff login
  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  if (!token || !["admin", "organiser"].includes(role)) {
    alert("Please log in as an administrator or organiser.");
    return;
  }

  // Hide other management sections
  document.getElementById("manageEventsSection")
    .classList.add("d-none");

  document.getElementById("manageVenuesSection")
    .classList.add("d-none");

  // Show Manage Bookings section
  manageBookingsSection.classList.remove("d-none");

  bookingsManagementMessage.textContent = "Loading bookings...";
  bookingsManagementMessage.className = "";

  bookingsManagementBody.innerHTML = "";

  try {
    const response = await fetch(
      STAFF_API_URL + "/bookings",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to load bookings"
      );
    }

    // Support the existing API response structure
    const bookings = Array.isArray(result)
      ? result
      : (result.data || result.bookings || []);

    if (!Array.isArray(bookings)) {
      throw new Error("Invalid bookings response format");
    }

    if (bookings.length === 0) {
      bookingsManagementMessage.textContent =
        "No booking records available.";
      return;
    }

    bookingsManagementMessage.textContent = "";

    
bookingsManagementMessage.textContent = "";

// TEMPORARY DEBUGGING LINE
console.log("Step 7AL booking records:", bookings.length);

bookings.forEach((booking) => {
  const row = document.createElement("tr");

  // Keep your existing booking table code here.
});

    bookings.forEach((booking) => {
      const row = document.createElement("tr");

      const values = [
        booking.booking_id,
        booking.event_id,
        booking.user_id,
        booking.quantity,
        "RM " + Number(booking.total_amount).toFixed(2),
        booking.status
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "-";
        row.appendChild(cell);
      });

      // Booking actions will be implemented later
      
      // STEP 7AP - Edit User Button
      const actionsCell = document.createElement("td");

      const editUserButton = document.createElement("button");
      editUserButton.type = "button";
      editUserButton.className = "btn btn-sm btn-warning";
      editUserButton.textContent = "Edit";

      editUserButton.addEventListener("click", function () {

        const token = sessionStorage.getItem("eventhub_staff_token");
        const role = sessionStorage.getItem("eventhub_staff_role");

        if (!token || role !== "admin") {
          alert("Only administrators can edit users.");
          return;
        }

        // Store selected user ID
        document.getElementById("editUserId").value =
          user.user_id;

        // Fill form with existing user information
        document.getElementById("editUserName").value =
          user.full_name ?? user.name ?? "";

        document.getElementById("editUserEmail").value =
          user.email ?? "";

        document.getElementById("editUserRole").value =
          user.role ?? "customer";

        // Clear previous messages
        const message = document.getElementById("editUserMessage");
        message.textContent = "";
        message.className = "";

        // Open Edit User modal
        bootstrap.Modal.getOrCreateInstance(
          document.getElementById("editUserModal")
        ).show();
      });

      actionsCell.appendChild(editUserButton);

      row.appendChild(actionsCell);
      usersManagementBody.appendChild(row);

    });

    // STEP 7AL - Temporary debugging
console.log(
  "Booking rows after loop:",
  bookingsManagementBody.querySelectorAll("tr").length
);

  } catch (error) {
    console.error("Manage Bookings error:", error);

    bookingsManagementMessage.textContent =
      "Unable to load bookings: " + error.message;

    bookingsManagementMessage.className = "text-danger";
  }

  manageBookingsSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});


 // ==========================================
 // STEP 7AM - Dashboard Section Navigation
 // ==========================================

 function showManagementSection(sectionId) {
   const sections = [
  "manageEventsSection",
  "manageVenuesSection",
  "manageBookingsSection",
  "manageUsersSection"
];


   sections.forEach((id) => {
     const section = document.getElementById(id);

     if (section) {
       section.classList.toggle("d-none", id !== sectionId);
     }
   });
 }

 // Hide other sections when Manage Events is clicked
 document.getElementById("manageEventsBtn")
   .addEventListener("click", function () {
     showManagementSection("manageEventsSection");
   });

 // Hide other sections when Manage Venues is clicked
 document.getElementById("manageVenuesBtn")
   .addEventListener("click", function () {
     showManagementSection("manageVenuesSection");
   });

 // Hide other sections when Manage Bookings is clicked
 document.getElementById("manageBookingsBtn")
   .addEventListener("click", function () {
     showManagementSection("manageBookingsSection");
   });


 // ==========================================
 // STEP 7AO - Manage Users (Admin Only)
 // ==========================================

 const manageUsersButton =
   document.getElementById("manageUsersBtn");

 const manageUsersSection =
   document.getElementById("manageUsersSection");

 const usersManagementBody =
   document.getElementById("usersManagementBody");

 const usersManagementMessage =
   document.getElementById("usersManagementMessage");

 manageUsersButton.addEventListener("click", async function () {

   const token = sessionStorage.getItem("eventhub_staff_token");
   const role = sessionStorage.getItem("eventhub_staff_role");

   // Restrict Manage Users to administrators
   if (!token || role !== "admin") {
     alert("Only administrators can manage users.");
     return;
   }

   // Hide other management sections
   [
     "manageEventsSection",
     "manageVenuesSection",
     "manageBookingsSection"
   ].forEach((id) => {
     document.getElementById(id).classList.add("d-none");
   });

   // Show Manage Users section
   manageUsersSection.classList.remove("d-none");

   usersManagementMessage.textContent = "Loading users...";
   usersManagementMessage.className = "";

   usersManagementBody.innerHTML = "";

   try {
     const response = await fetch(
       STAFF_API_URL + "/users",
       {
         method: "GET",
         headers: {
           "Authorization": `Bearer ${token}`
         }
       }
     );

     const result = await response.json();

     if (!response.ok) {
       throw new Error(
         result.message || "Failed to load users"
       );
     }

     const users = Array.isArray(result)
       ? result
       : (result.data || result.users || []);

     if (!Array.isArray(users)) {
       throw new Error("Invalid users response format");
     }

     if (users.length === 0) {
       usersManagementMessage.textContent =
         "No registered users found.";
       return;
     }

     usersManagementMessage.textContent = "";

     users.forEach((user) => {
       const row = document.createElement("tr");

       const values = [
         user.user_id,
         user.full_name ?? user.name ?? "-",
         user.email,
         user.role
       ];

       values.forEach((value) => {
         const cell = document.createElement("td");
         cell.textContent = value ?? "-";
         row.appendChild(cell);
       });

       
      // STEP 7AP - Edit User Button
      const actionsCell = document.createElement("td");

      const editUserButton = document.createElement("button");
      editUserButton.type = "button";
      editUserButton.className = "btn btn-sm btn-warning";
      editUserButton.textContent = "Edit";

      editUserButton.addEventListener("click", function () {

        const token = sessionStorage.getItem("eventhub_staff_token");
        const role = sessionStorage.getItem("eventhub_staff_role");

        if (!token || role !== "admin") {
          alert("Only administrators can edit users.");
          return;
        }

        document.getElementById("editUserId").value =
          user.user_id;

        document.getElementById("editUserName").value =
          user.full_name ?? user.name ?? "";

        document.getElementById("editUserEmail").value =
          user.email ?? "";

        document.getElementById("editUserRole").value =
          user.role ?? "customer";

        const message = document.getElementById("editUserMessage");
        message.textContent = "";
        message.className = "";

        bootstrap.Modal.getOrCreateInstance(
          document.getElementById("editUserModal")
        ).show();
      });

      actionsCell.appendChild(editUserButton);

      // STEP 7AR - Delete User Button

const deleteUserButton = document.createElement("button");
deleteUserButton.type = "button";
deleteUserButton.className = "btn btn-sm btn-danger ms-2";
deleteUserButton.textContent = "Delete";

// Disable deletion for administrator accounts
if (user.role === "admin") {
  deleteUserButton.disabled = true;
  deleteUserButton.title = "Administrator deletion is disabled";
}

deleteUserButton.addEventListener("click", async function () {

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  if (!token || role !== "admin") {
    alert("Only administrators can delete users.");
    return;
  }

  if (user.role === "admin") {
    alert("Administrator accounts cannot be deleted here.");
    return;
  }

  const confirmed = confirm(
    "Are you sure you want to delete this user?\n\n" +
    (user.name || user.full_name || "Unknown user") +
    "\n" + user.email +
    "\n\nThis action cannot be undone."
  );

  if (!confirmed) {
    return;
  }

  deleteUserButton.disabled = true;
  deleteUserButton.textContent = "Deleting...";

  try {
    const response = await fetch(
      STAFF_API_URL + "/users/" + user.user_id,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const responseText = await response.text();
    const result = responseText ? JSON.parse(responseText) : {};

    if (!response.ok) {
      throw new Error(result.message || "Failed to delete user");
    }

    alert("User deleted successfully!");

    await loadTotalUsers();
    manageUsersButton.click();

  } catch (error) {
    console.error("Delete User error:", error);
    alert("Delete failed: " + error.message);

  } finally {
    deleteUserButton.disabled = false;
    deleteUserButton.textContent = "Delete";
  }
});

actionsCell.appendChild(deleteUserButton);

      row.appendChild(actionsCell);
      usersManagementBody.appendChild(row);

     });

   } catch (error) {
     console.error("Manage Users error:", error);

     usersManagementMessage.textContent =
       "Unable to load users: " + error.message;

     usersManagementMessage.className = "text-danger";
   }

   manageUsersSection.scrollIntoView({
     behavior: "smooth",
     block: "start"
   });
 });

 // ==========================================
// STEP 7AQ - Update Existing User
// ==========================================

const editUserForm = document.getElementById("editUserForm");

editUserForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const token = sessionStorage.getItem("eventhub_staff_token");
  const role = sessionStorage.getItem("eventhub_staff_role");

  const message = document.getElementById("editUserMessage");
  const submitButton = editUserForm.querySelector(
    'button[type="submit"]'
  );

  // Only administrators can update users
  if (!token || role !== "admin") {
    message.textContent = "Only administrators can edit users.";
    message.className = "alert alert-danger";
    return;
  }

  const userId = Number(
    document.getElementById("editUserId").value
  );

  const fullName = document.getElementById(
    "editUserName"
  ).value.trim();

  const email = document.getElementById(
    "editUserEmail"
  ).value.trim();

  const selectedRole = document.getElementById(
    "editUserRole"
  ).value;

  // Validate form values
  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    !fullName ||
    !editUserForm.checkValidity() ||
    !["customer", "organiser", "admin"].includes(selectedRole)
  ) {
    message.textContent = "Please enter valid user information.";
    message.className = "alert alert-danger";
    return;
  }

  // Prevent accidental role changes in this step
  let originalRole;

  try {
    const checkResponse = await fetch(
      STAFF_API_URL + "/users/" + userId,
      {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const checkResult = await checkResponse.json();

    if (!checkResponse.ok) {
      throw new Error(
        checkResult.message || "Unable to verify user"
      );
    }

    const existingUser =
      checkResult.data || checkResult.user || checkResult;

    originalRole = existingUser.role;

  } catch (error) {
    message.textContent = error.message;
    message.className = "alert alert-danger";
    return;
  }

  if (selectedRole !== originalRole) {
    message.textContent =
      "Role changes are not part of this test. Keep the original role.";
    message.className = "alert alert-warning";
    return;
  }

  submitButton.disabled = true;
  message.textContent = "Updating user...";
  message.className = "alert alert-info";

  try {
    const response = await fetch(
      STAFF_API_URL + "/users/" + userId,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: fullName,
          email: email,
          role: selectedRole
        })
      }
    );

    const responseText = await response.text();
    const result = responseText
      ? JSON.parse(responseText)
      : {};

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to update user"
      );
    }

    message.textContent = "User updated successfully!";
    message.className = "alert alert-success";

    // Refresh users table
    manageUsersButton.click();

  } catch (error) {
    console.error("Update User error:", error);
    message.textContent = error.message;
    message.className = "alert alert-danger";

  } finally {
    submitButton.disabled = false;
  }
});

// ==========================================
// STEP 7AT - Clear Dashboard After Logout
// ==========================================

document.getElementById("staffLogoutBtn")
  .addEventListener("click", function () {

    // Hide all management sections
    const sections = [
      "manageEventsSection",
      "manageVenuesSection",
      "manageBookingsSection",
      "manageUsersSection"
    ];

    sections.forEach((id) => {
      const section = document.getElementById(id);

      if (section) {
        section.classList.add("d-none");
      }
    });

    // Clear previously loaded table records
    const tables = [
      "eventsManagementBody",
      "venuesManagementBody",
      "bookingsManagementBody",
      "usersManagementBody"
    ];

    tables.forEach((id) => {
      const tableBody = document.getElementById(id);

      if (tableBody) {
        tableBody.innerHTML = "";
      }
    });

    // Clear management status messages
    const messages = [
      "eventsManagementMessage",
      "venuesManagementMessage",
      "bookingsManagementMessage",
      "usersManagementMessage"
    ];

    messages.forEach((id) => {
      const message = document.getElementById(id);

      if (message) {
        message.textContent = "";
      }
    });

    console.trace("DEBUG: What triggered the logout cleanup?");
    console.log("EventHub dashboard cleared after logout.");
  });

  
 // STEP 7AU - Restore Dashboard After Refresh

 async function restoreStaffDashboard() {
   const token = sessionStorage.getItem("eventhub_staff_token");
   const role = sessionStorage.getItem("eventhub_staff_role");

   if (!token || !["admin", "organiser"].includes(role)) {
     return;
   }

   await loadTotalBookings();

   if (role === "admin") {
     await loadTotalUsers();
   }
 }

 // Run automatically when the page loads
 restoreStaffDashboard();

 // ==========================================
// STEP 7AV - Handle Expired Staff Sessions
// ==========================================

function handleExpiredStaffSession() {
  // Remove expired authentication information
  sessionStorage.removeItem("eventhub_staff_token");
  sessionStorage.removeItem("eventhub_staff_role");

  // Hide management sections
  const sections = [
    "manageEventsSection",
    "manageVenuesSection",
    "manageBookingsSection",
    "manageUsersSection"
  ];

  sections.forEach((id) => {
    const section = document.getElementById(id);

    if (section) {
      section.classList.add("d-none");
    }
  });

  // Clear protected records
  const tables = [
    "eventsManagementBody",
    "venuesManagementBody",
    "bookingsManagementBody",
    "usersManagementBody"
  ];

  tables.forEach((id) => {
    const table = document.getElementById(id);

    if (table) {
      table.innerHTML = "";
    }
  });

  // Reset statistics
  [
    "totalEvents",
    "totalVenues",
    "totalBookings",
    "totalUsers"
  ].forEach((id) => {
    const card = document.getElementById(id);

    if (card) {
      card.textContent = "--";
    }
  });

  // Update login/logout controls
  updateStaffDashboard();

  alert("Your session has expired. Please log in again.");
}