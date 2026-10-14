const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const authenticateToken = require("./authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------
// API management features
// ---------------------------------------------------------
const requestLogger = require("./logger");
const createRateLimiter = require("./rateLimiter");
const { getEventWeather } = require("./weatherService");

// Feature 1 - Logging: one line per request, in the terminal
// and in logs/access.log
app.use(requestLogger);

// Feature 2 - Rate limiting: at most 300 requests per IP address
// every 15 minutes across the whole API
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  message: "Too many requests. Please try again later."
});

app.use("/api", apiLimiter);

// A stricter limit for login: 10 FAILED attempts per IP address
// every 5 minutes. This slows down password guessing.
const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  message: "Too many failed login attempts. Please try again in a few minutes.",
  countOnlyFailures: true
});

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to EventHub API",
    status: "running"
  });
});

// Test MySQL database connection
app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DATABASE() AS database_name"
    );

    res.json({
      message: "Database connected successfully!",
      database: rows[0].database_name
    });
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      message: "Database connection failed"
    });
  }
});

// GET all events from MySQL
// Feature 4 - Pagination (optional):
//   /api/events                  -> every event (as before)
//   /api/events?page=1&limit=2   -> one page, soonest event first
app.get("/api/events", async (req, res) => {
  try {
    const wantsPage =
      req.query.page !== undefined || req.query.limit !== undefined;

    if (wantsPage) {
      const page = Number(req.query.page === undefined ? 1 : req.query.page);
      const limit = Number(req.query.limit === undefined ? 10 : req.query.limit);

      if (
        !Number.isSafeInteger(page) || page < 1 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "page must be 1 or more, and limit must be between 1 and 100"
        });
      }

      const [totals] = await db.query(
        "SELECT COUNT(*) AS total FROM events"
      );
      const totalItems = totals[0].total;
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));

      // LIMIT and OFFSET make MySQL return only the rows of this page
      const [pageEvents] = await db.query(
        "SELECT * FROM events ORDER BY event_date ASC, event_id ASC LIMIT ? OFFSET ?",
        [limit, (page - 1) * limit]
      );

      return res.status(200).json({
        success: true,
        count: pageEvents.length,
        pagination: {
          page: page,
          limit: limit,
          total_items: totalItems,
          total_pages: totalPages,
          has_previous: page > 1,
          has_next: page < totalPages
        },
        data: pageEvents
      });
    }

    const [events] = await db.query(
      "SELECT * FROM events"
    );

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });

  } catch (error) {
    console.error("Error fetching events:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve events"
    });
  }
});

// PUT - Update an existing event
app.put("/api/events/:id", authenticateToken, async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID"
      });
    }

    if (!["admin", "organiser"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update events"
      });
    }

    const [events] = await db.query(
      "SELECT * FROM events WHERE event_id = ?",
      [eventId]
    );

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const event = events[0];

    // Organisers can only update events they own
    if (
      req.user.role === "organiser" &&
      event.organiser_id !== req.user.user_id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own events"
      });
    }

    const {
      event_name,
      description,
      event_date,
      ticket_price
    } = req.body || {};

    // Require all fields for PUT
    if (
      typeof event_name !== "string" ||
      !event_name.trim() ||
      event_name.trim().length > 150 ||
      typeof event_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(event_date) ||
      !Number.isFinite(
        new Date(event_date.replace(" ", "T")).getTime()
      ) ||
      typeof ticket_price !== "number" ||
      !Number.isFinite(ticket_price) ||
      ticket_price < 0 ||
      ticket_price > 99999999.99 ||
      (description !== null &&
        typeof description !== "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid event details"
      });
    }

    await db.query(
      `UPDATE events
       SET event_name = ?,
           description = ?,
           event_date = ?,
           ticket_price = ?
       WHERE event_id = ?`,
      [
        event_name.trim(),
        description,
        event_date,
        ticket_price,
        eventId
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event_id: eventId
    });

  } catch (error) {
    console.error("Update event error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update event"
    });
  }
});

// DELETE - Remove an event
app.delete("/api/events/:id", authenticateToken, async (req, res) => {
  const eventId = Number(req.params.id);

  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid event ID"
    });
  }

  if (!["admin", "organiser"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You are not allowed to delete events"
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Lock the event while checking deletion rules
    const [events] = await connection.query(
      "SELECT organiser_id FROM events WHERE event_id = ? FOR UPDATE",
      [eventId]
    );

    if (events.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Organisers can delete only their own events
    if (
      req.user.role === "organiser" &&
      events[0].organiser_id !== req.user.user_id
    ) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can only delete your own events"
      });
    }

    // Do not delete events with booking history
    const [bookings] = await connection.query(
      "SELECT booking_id FROM bookings WHERE event_id = ? LIMIT 1",
      [eventId]
    );

    if (bookings.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Cannot delete an event with existing bookings"
      });
    }

    await connection.query(
      "DELETE FROM events WHERE event_id = ?",
      [eventId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully"
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Delete event error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete event"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET - Weather at the venue of an event
// Third-party API integration: Open-Meteo (see weatherService.js)
app.get("/api/events/:id/weather", async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID"
      });
    }

    // The venue's location is what gets sent to the weather API
    const [events] = await db.query(
      `SELECT
        e.event_id,
        e.event_name,
        e.event_date,
        v.venue_name,
        v.location
      FROM events e
      JOIN venues v ON e.venue_id = v.venue_id
      WHERE e.event_id = ?`,
      [eventId]
    );

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const event = events[0];

    const result = await getEventWeather(event.location, event.event_date);

    // Shows in Postman whether the answer came from the cache
    res.setHeader("X-Cache", result.cached ? "HIT" : "MISS");

    return res.status(200).json({
      success: true,
      data: {
        event_id: event.event_id,
        event_name: event.event_name,
        venue_name: event.venue_name,
        location: event.location,
        event_date: event.event_date,
        ...result
      }
    });

  } catch (error) {
    console.error("Weather error:", error.message);

    if (error.code === "LOCATION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Weather is not available for this venue's location"
      });
    }

    // 502 Bad Gateway: our API is fine, the outside service is not
    return res.status(502).json({
      success: false,
      message: "The weather service is not available right now. Please try again later."
    });
  }
});

// GET - Retrieve a specific event by ID
app.get("/api/events/:id", async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    // Validate event ID
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID"
      });
    }

    // Retrieve event together with venue and organiser
    const [events] = await db.query(
      `SELECT
        e.event_id,
        e.event_name,
        e.description,
        e.event_date,
        e.ticket_price,
        e.total_tickets,
        e.available_tickets,
        v.venue_id,
        v.venue_name,
        v.location,
        u.name AS organiser_name
      FROM events e
      JOIN venues v ON e.venue_id = v.venue_id
      JOIN users u ON e.organiser_id = u.user_id
      WHERE e.event_id = ?`,
      [eventId]
    );

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: events[0]
    });

  } catch (error) {
    console.error("Error retrieving event:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve event"
    });
  }
});

// POST - Create a new event
// Only admin and organiser are allowed
app.post("/api/events", authenticateToken, async (req, res) => {
  try {
    if (!["admin", "organiser"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only administrators and organisers can create events"
      });
    }

    const {
      venue_id,
      event_name,
      description,
      event_date,
      ticket_price,
      total_tickets
    } = req.body || {};

    // Validate required fields
    if (
      !Number.isSafeInteger(venue_id) ||
      venue_id <= 0 ||
      typeof event_name !== "string" ||
      !event_name.trim() ||
      event_name.trim().length > 150 ||
      typeof event_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(event_date) ||
      !Number.isFinite(new Date(event_date.replace(" ", "T")).getTime()) ||
      !Number.isFinite(Number(ticket_price)) ||
      Number(ticket_price) < 0 ||
      !Number.isSafeInteger(total_tickets) ||
      total_tickets <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid event details"
      });
    }

    // Check venue exists and capacity is sufficient
    const [venues] = await db.query(
      "SELECT capacity FROM venues WHERE venue_id = ?",
      [venue_id]
    );

    if (venues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    if (total_tickets > venues[0].capacity) {
      return res.status(400).json({
        success: false,
        message: "Total tickets exceed venue capacity"
      });
    }

    // Set organiser from verified JWT, not user input
    const organiserId = req.user.user_id;

    const [result] = await db.query(
      `INSERT INTO events
       (organiser_id, venue_id, event_name, description,
        event_date, ticket_price, total_tickets, available_tickets)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organiserId,
        venue_id,
        event_name.trim(),
        description || null,
        event_date,
        Number(ticket_price),
        total_tickets,
        total_tickets
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event_id: result.insertId
    });

  } catch (error) {
    console.error("Create event error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create event"
    });
  }
});

// GET all venues from MySQL
app.get("/api/venues", async (req, res) => {
  try {
    const [venues] = await db.query(
      "SELECT * FROM venues"
    );

    res.status(200).json({
      success: true,
      count: venues.length,
      data: venues
    });

  } catch (error) {
    console.error("Error fetching venues:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve venues"
    });
  }
});

// GET - Retrieve a specific venue by ID
app.get("/api/venues/:id", async (req, res) => {
  try {
    const venueId = Number(req.params.id);

    // Validate venue ID
    if (!Number.isSafeInteger(venueId) || venueId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid venue ID"
      });
    }

    const [venues] = await db.query(
      `SELECT venue_id, venue_name, location, capacity
       FROM venues
       WHERE venue_id = ?`,
      [venueId]
    );

    if (venues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: venues[0]
    });

  } catch (error) {
    console.error("Error retrieving venue:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve venue"
    });
  }
});

// POST - Create a new venue
app.post("/api/venues", authenticateToken, async (req, res) => {
  try {
    // Only administrators and organisers can create venues
    if (!["admin", "organiser"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only administrators and organisers can create venues"
      });
    }

    const { venue_name, location, capacity } = req.body || {};

    // Validate venue information
    if (
      typeof venue_name !== "string" ||
      !venue_name.trim() ||
      venue_name.trim().length > 150 ||
      typeof location !== "string" ||
      !location.trim() ||
      location.trim().length > 255 ||
      !Number.isSafeInteger(capacity) ||
      capacity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid venue name, location and capacity are required"
      });
    }

    // Insert new venue into MySQL
    const [result] = await db.query(
      `INSERT INTO venues (venue_name, location, capacity)
       VALUES (?, ?, ?)`,
      [
        venue_name.trim(),
        location.trim(),
        capacity
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Venue created successfully",
      venue: {
        venue_id: result.insertId,
        venue_name: venue_name.trim(),
        location: location.trim(),
        capacity
      }
    });

  } catch (error) {
    console.error("Create venue error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create venue"
    });
  }
});

// PUT - Update an existing venue
app.put("/api/venues/:id", authenticateToken, async (req, res) => {
  try {
    const venueId = Number(req.params.id);

    // Check user role
    if (!["admin", "organiser"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only administrators and organisers can update venues"
      });
    }

    // Validate venue ID
    if (!Number.isSafeInteger(venueId) || venueId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid venue ID"
      });
    }

    const { venue_name, location, capacity } = req.body || {};

    // Validate input
    if (
      typeof venue_name !== "string" ||
      !venue_name.trim() ||
      venue_name.trim().length > 150 ||
      typeof location !== "string" ||
      !location.trim() ||
      location.trim().length > 255 ||
      !Number.isSafeInteger(capacity) ||
      capacity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid venue information"
      });
    }

    // Check whether venue exists
    const [venues] = await db.query(
      "SELECT venue_id FROM venues WHERE venue_id = ?",
      [venueId]
    );

    if (venues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Do not reduce capacity below existing event ticket allocations
    const [events] = await db.query(
      `SELECT MAX(total_tickets) AS required_capacity
       FROM events
       WHERE venue_id = ?`,
      [venueId]
    );

    if (capacity < Number(events[0].required_capacity || 0)) {
      return res.status(409).json({
        success: false,
        message: "Capacity is below an existing event ticket allocation"
      });
    }

    // Update venue
    await db.query(
      `UPDATE venues
       SET venue_name = ?, location = ?, capacity = ?
       WHERE venue_id = ?`,
      [
        venue_name.trim(),
        location.trim(),
        capacity,
        venueId
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      venue_id: venueId
    });

  } catch (error) {
    console.error("Update venue error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update venue"
    });
  }
});

// DELETE - Remove a venue
app.delete("/api/venues/:id", authenticateToken, async (req, res) => {
  const venueId = Number(req.params.id);

  // Check user role
  if (!["admin", "organiser"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only administrators and organisers can delete venues"
    });
  }

  // Validate venue ID
  if (!Number.isSafeInteger(venueId) || venueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid venue ID"
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check whether the venue exists
    const [venues] = await connection.query(
      "SELECT venue_id FROM venues WHERE venue_id = ? FOR UPDATE",
      [venueId]
    );

    if (venues.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Prevent deletion of venues associated with events
    const [events] = await connection.query(
      "SELECT event_id FROM events WHERE venue_id = ? LIMIT 1",
      [venueId]
    );

    if (events.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Cannot delete a venue that is used by an event"
      });
    }

    // Delete venue
    await connection.query(
      "DELETE FROM venues WHERE venue_id = ?",
      [venueId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Venue deleted successfully"
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Delete venue error:", error.message);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Venue is still referenced by an event"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete venue"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET all bookings from MySQL
// Temporary endpoint for local testing only
// GET bookings with role-based access control
app.get("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;

    let sql = `
      SELECT
        b.booking_id,
        b.user_id,
        u.name AS customer_name,
        b.event_id,
        e.event_name,
        b.quantity,
        b.total_amount,
        b.status,
        b.booking_date
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN events e ON b.event_id = e.event_id
    `;

    let params = [];

    if (role === "admin") {
      // Administrators can view all bookings
      sql += " ORDER BY b.booking_id DESC";

    } else if (role === "customer") {
      // Customers can only view their own bookings
      sql += " WHERE b.user_id = ? ORDER BY b.booking_id DESC";
      params = [userId];

    } else if (role === "organiser") {
      // Organisers can view bookings for their own events
      sql += " WHERE e.organiser_id = ? ORDER BY b.booking_id DESC";
      params = [userId];

    } else {
      return res.status(403).json({
        success: false,
        message: "Access forbidden for this role"
      });
    }

    const [bookings] = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });

  } catch (error) {
    console.error("Error fetching bookings:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bookings"
    });
  }
});

// GET - Retrieve an individual booking
app.get("/api/bookings/:id", authenticateToken, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    // Validate booking ID
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    // Retrieve booking with customer and event details
    const [bookings] = await db.query(
      `SELECT
        b.booking_id,
        b.user_id,
        u.name AS customer_name,
        b.event_id,
        e.event_name,
        e.organiser_id,
        b.quantity,
        b.total_amount,
        b.status,
        b.booking_date
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN events e ON b.event_id = e.event_id
      WHERE b.booking_id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookings[0];

    // Check permission
    const allowed =
      req.user.role === "admin" ||
      (req.user.role === "customer" &&
        booking.user_id === req.user.user_id) ||
      (req.user.role === "organiser" &&
        booking.organiser_id === req.user.user_id);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this booking"
      });
    }

    // Do not expose internal organiser ID unnecessarily
    delete booking.organiser_id;

    return res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error("Booking details error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve booking"
    });
  }
});

// POST - Create a new ticket booking
app.post("/api/bookings", authenticateToken, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Only customers can book tickets"
    });
  }

  const { event_id, quantity } = req.body || {};

  if (
    !Number.isSafeInteger(event_id) ||
    event_id <= 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid event_id and quantity are required"
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Lock the event row to prevent overselling
    const [events] = await connection.query(
      "SELECT * FROM events WHERE event_id = ? FOR UPDATE",
      [event_id]
    );

    if (events.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const event = events[0];

    if (new Date(event.event_date) <= new Date()) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Cannot book a past event"
      });
    }

    if (event.available_tickets < quantity) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Not enough tickets available"
      });
    }

    const totalAmount = (
      Number(event.ticket_price) * quantity
    ).toFixed(2);

    // Create booking
    const [result] = await connection.query(
      `INSERT INTO bookings
       (user_id, event_id, quantity, total_amount, status)
       VALUES (?, ?, ?, ?, 'confirmed')`,
      [
        req.user.user_id,
        event_id,
        quantity,
        totalAmount
      ]
    );

    // Reduce available tickets
    await connection.query(
      `UPDATE events
       SET available_tickets = available_tickets - ?
       WHERE event_id = ?`,
      [quantity, event_id]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: {
        booking_id: result.insertId,
        user_id: req.user.user_id,
        event_id,
        quantity,
        total_amount: totalAmount,
        status: "confirmed"
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Booking error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// PATCH - Cancel an existing booking
app.patch("/api/bookings/:id/cancel", authenticateToken, async (req, res) => {

  const bookingId = Number(req.params.id);

  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking ID"
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Lock booking to prevent concurrent cancellations
    const [bookings] = await connection.query(
      "SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE",
      [bookingId]
    );

    if (bookings.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookings[0];

    // Customer can cancel only their own booking
    if (
      req.user.role !== "admin" &&
      (
        req.user.role !== "customer" ||
        booking.user_id !== req.user.user_id
      )
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "You cannot cancel this booking"
      });
    }

    // Prevent cancelling an already cancelled booking
    if (booking.status === "cancelled") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Booking is already cancelled"
      });
    }

    // Prevent cancelling bookings for past events
    const [events] = await connection.query(
      "SELECT event_date FROM events WHERE event_id = ?",
      [booking.event_id]
    );

    if (
      events.length === 0 ||
      new Date(events[0].event_date) <= new Date()
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Cannot cancel a past event booking"
      });
    }

    // Update booking status
    await connection.query(
      "UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?",
      [bookingId]
    );

    // Restore available tickets
    await connection.query(
      `UPDATE events
       SET available_tickets = available_tickets + ?
       WHERE event_id = ?`,
      [booking.quantity, booking.event_id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking_id: bookingId,
      status: "cancelled",
      tickets_restored: booking.quantity
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Cancellation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel booking"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET all users from MySQL
// Temporary endpoint for local testing only
// GET - Retrieve all users (Admin only)
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    // Check administrator role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can view users"
      });
    }

    // Retrieve users without exposing passwords
    const [users] = await db.query(
      `SELECT user_id, name, email, role, created_at
       FROM users
       ORDER BY user_id ASC`
    );

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error("Get users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users"
    });
  }
});

// GET - Retrieve individual user details (Admin only)
app.get("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    // Only administrators can view user details
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can view user details"
      });
    }

    const userId = Number(req.params.id);

    // Validate user ID
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Retrieve user without password information
    const [users] = await db.query(
      `SELECT user_id, name, email, role, created_at
       FROM users
       WHERE user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error("Get user details error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user details"
    });
  }
});

// PUT - Update user information (Admin only)
app.put("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    // Only administrators can update users
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can update users"
      });
    }

    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const { name, email, role } = req.body || {};

    // Validate user information
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      typeof email !== "string" ||
      email.trim().length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !["admin", "organiser", "customer"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user information"
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check user exists
    const [users] = await db.query(
      "SELECT user_id, role FROM users WHERE user_id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent administrator from changing own role
    if (
      userId === req.user.user_id &&
      role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove your own administrator role"
      });
    }

    // Check email uniqueness
    const [existing] = await db.query(
      "SELECT user_id FROM users WHERE email = ? AND user_id <> ?",
      [cleanEmail, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already used by another user"
      });
    }

    // Update user without modifying password
    await db.query(
      `UPDATE users
       SET name = ?, email = ?, role = ?
       WHERE user_id = ?`,
      [cleanName, cleanEmail, role, userId]
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: {
        user_id: userId,
        name: cleanName,
        email: cleanEmail,
        role
      }
    });

  } catch (error) {
    console.error("Update user error:", error.message);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email is already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update user"
    });
  }
});


app.delete("/api/users/:id", authenticateToken, async (req, res) => {
  // Only administrators can delete users
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only administrators can delete users"
    });
  }

  const userId = Number(req.params.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID"
    });
  }

  // Prevent administrator from deleting own account
  if (userId === req.user.user_id) {
    return res.status(403).json({
      success: false,
      message: "You cannot delete your own account"
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Lock user record
    const [users] = await connection.query(
      "SELECT user_id FROM users WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check existing bookings
    const [bookings] = await connection.query(
      "SELECT booking_id FROM bookings WHERE user_id = ? LIMIT 1",
      [userId]
    );

    // Check events organised by this user
    const [events] = await connection.query(
      "SELECT event_id FROM events WHERE organiser_id = ? LIMIT 1",
      [userId]
    );

    if (bookings.length > 0 || events.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Cannot delete a user with bookings or events"
      });
    }

    await connection.query(
      "DELETE FROM users WHERE user_id = ?",
      [userId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Delete user error:", error.message);

    if (
      error.code === "ER_ROW_IS_REFERENCED_2" ||
      error.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        success: false,
        message: "User is referenced by existing records"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete user"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// Import bcryptjs for password hashing
const bcrypt = require("bcryptjs");

// POST - Register a new customer
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    // Validate input lengths and email format
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanName.length > 100 ||
      cleanEmail.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid name or email"
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8 to 72 characters"
      });
    }

    // Check whether email already exists
    const [existingUsers] = await db.query(
      "SELECT user_id FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered"
      });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 12);

    // New registrations always receive customer role
    const [result] = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES (?, ?, ?, 'customer')`,
      [cleanName, cleanEmail, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      user: {
        user_id: result.insertId,
        name: cleanName,
        email: cleanEmail,
        role: "customer"
      }
    });

  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email is already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

// Import JWT library
const jwt = require("jsonwebtoken");

// POST - Customer Login
app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate login input
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find user by email
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = users[0];

    // Verify password against bcrypt hash
    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check that JWT secret exists
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    // Generate JWT authentication token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Return successful login response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});


// Start server
async function startServer() {
  try {
    const connection = await db.getConnection();
    console.log("MySQL connected successfully!");
    connection.release();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(
        `EventHub API running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("MySQL error:", error.message);
    process.exit(1);
  }
}

startServer();