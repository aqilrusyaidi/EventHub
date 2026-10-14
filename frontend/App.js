/* EventHub frontend - vanilla JS single page app (hash routing) */

// If served by the Express app on port 3000 use same origin, otherwise call localhost:3000
const API =
  location.protocol !== "file:" && location.port === "3000"
    ? ""
    : "http://localhost:3000";

const state = {
  token: localStorage.getItem("token"),
  user: JSON.parse(localStorage.getItem("user") || "null")
};

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const app = $("#app");

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

const money = (n) => "RM " + Number(n || 0).toFixed(2);
const fmtDate = (d) =>
  new Date(d).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });

const pad = (n) => String(n).padStart(2, "0");
const toInputDate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const toSqlDate = (v) => v.replace("T", " ") + (v.length === 16 ? ":00" : "");

const role = () => state.user?.role;
const isStaff = () => ["admin", "organiser"].includes(role());

let toastTimer;
function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 3200);
}

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = "Bearer " + state.token;

  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  let data = {};
  try { data = await res.json(); } catch { /* no body */ }

  if (res.status === 401 && state.token) {
    logout();
    toast("Session expired. Please log in again.", "error");
    location.hash = "#/login";
  }
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

/* ---------- modal ---------- */
const modal = $("#modal");
$("#modal-close").onclick = () => modal.close();
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

function openModal(title, html, onSubmit) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  const form = $("#modal-body form");
  if (form) {
    const errBox = form.querySelector(".form-error");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      errBox.textContent = "";
      try {
        await onSubmit(new FormData(form));
        modal.close();
      } catch (err) {
        errBox.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };
    form.querySelector("[data-cancel]")?.addEventListener("click", () => modal.close());
  }
  modal.showModal();
}

function confirmBox(title, message, onYes, yesLabel = "Delete") {
  openModal(
    title,
    `<form><p>${esc(message)}</p><div class="form-error"></div>
     <div class="form-actions">
       <button type="button" class="btn secondary" data-cancel>Cancel</button>
       <button type="submit" class="btn danger">${esc(yesLabel)}</button>
     </div></form>`,
    onYes
  );
}

/* ---------- auth ---------- */
function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  renderNav();
}

/* ---------- nav ---------- */
function renderNav() {
  const cur = location.hash.split("/")[1] || "events";
  const link = (h, label) =>
    `<a href="#/${h}" class="${cur === h ? "active" : ""}">${label}</a>`;

  let html = link("events", "Events") + link("venues", "Venues");
  if (state.user) {
    html += link("bookings", role() === "customer" ? "My Bookings" : "Bookings");
    if (role() === "admin") html += link("users", "Users");
    html += `<span class="who">${esc(state.user.name)} <span class="badge ${esc(role())}">${esc(role())}</span></span>`;
    html += `<button id="logout-btn">Log out</button>`;
  } else {
    html += link("login", "Log in") + link("register", "Register");
  }
  $("#nav").innerHTML = html;
  $("#logout-btn")?.addEventListener("click", () => {
    logout();
    toast("Logged out");
    location.hash = "#/events";
  });
}

/* ---------- router ---------- */
const loading = () => (app.innerHTML = `<div class="loading">Loading…</div>`);
const showError = (err) =>
  (app.innerHTML = `<div class="empty"><strong>Something went wrong</strong><br>${esc(err.message)}</div>`);

async function router() {
  renderNav();
  const parts = (location.hash.replace(/^#\/?/, "") || "events").split("/");
  const [page, id] = parts;
  loading();
  try {
    if (page === "events" && id) await eventDetailPage(Number(id));
    else if (page === "events") await eventsPage();
    else if (page === "venues") await venuesPage();
    else if (page === "bookings") await bookingsPage();
    else if (page === "users") await usersPage();
    else if (page === "login") loginPage();
    else if (page === "register") registerPage();
    else location.hash = "#/events";
  } catch (err) {
    showError(err);
  }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", router);

const needLogin = () => {
  if (!state.user) {
    location.hash = "#/login";
    return true;
  }
  return false;
};

/* ---------- login / register ---------- */
function loginPage() {
  app.innerHTML = `
    <div class="panel auth-box">
      <h1>Welcome back</h1>
      <p class="sub">Log in to book tickets or manage events.</p>
      <form>
        <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>
        <div class="form-error"></div>
        <button class="btn" type="submit" style="width:100%">Log in</button>
      </form>
      <p class="sub" style="margin-top:16px">No account? <a href="#/register">Register</a></p>
    </div>`;
  bindForm(app.querySelector("form"), async (fd) => {
    const data = await api("/api/login", {
      method: "POST",
      body: { email: fd.get("email"), password: fd.get("password") }
    });
    setSession(data.token, data.user);
    toast("Logged in as " + data.user.name, "success");
    location.hash = "#/events";
  });
}

function registerPage() {
  app.innerHTML = `
    <div class="panel auth-box">
      <h1>Create account</h1>
      <p class="sub">Customer accounts can book tickets.</p>
      <form>
        <div class="field"><label>Name</label><input name="name" required maxlength="100"></div>
        <div class="field"><label>Email</label><input name="email" type="email" required maxlength="150"></div>
        <div class="field"><label>Password (8–72 characters)</label><input name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></div>
        <div class="form-error"></div>
        <button class="btn" type="submit" style="width:100%">Register</button>
      </form>
      <p class="sub" style="margin-top:16px">Already registered? <a href="#/login">Log in</a></p>
    </div>`;
  bindForm(app.querySelector("form"), async (fd) => {
    await api("/api/register", {
      method: "POST",
      body: { name: fd.get("name"), email: fd.get("email"), password: fd.get("password") }
    });
    toast("Registered! Please log in.", "success");
    location.hash = "#/login";
  });
}

// Binds an inline (non-modal) form
function bindForm(form, handler) {
  const errBox = form.querySelector(".form-error");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    errBox.textContent = "";
    try {
      await handler(new FormData(form));
    } catch (err) {
      errBox.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
}

/* ---------- events ---------- */
async function eventsPage() {
  const { data: events } = await api("/api/events");
  const now = Date.now();

  app.innerHTML = `
    <div class="page-head">
      <div><h1>Events</h1><p class="sub">${events.length} event(s) available</p></div>
      ${isStaff() ? `<button class="btn" id="new-event">+ New event</button>` : ""}
    </div>
    ${events.length === 0 ? `<div class="empty">No events yet.</div>` : `<div class="grid">${events.map((e) => {
      const past = new Date(e.event_date).getTime() <= now;
      const soldOut = e.available_tickets <= 0;
      return `
      <div class="card">
        <div class="row">
          <h3>${esc(e.event_name)}</h3>
          ${past ? `<span class="badge cancelled">Ended</span>` : soldOut ? `<span class="badge cancelled">Sold out</span>` : e.available_tickets <= 20 ? `<span class="badge low">Few left</span>` : ""}
        </div>
        <p>${esc(e.description || "No description")}</p>
        <div class="row"><span>📅 ${fmtDate(e.event_date)}</span></div>
        <div class="row"><span class="price">${money(e.ticket_price)}</span><span class="sub" style="margin:0">${e.available_tickets}/${e.total_tickets} left</span></div>
        <div class="actions"><a class="btn small" href="#/events/${e.event_id}">View details</a></div>
      </div>`;
    }).join("")}</div>`}`;

  $("#new-event")?.addEventListener("click", () => eventForm());
}

async function eventDetailPage(id) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid event ID");
  const [{ data: ev }, list] = await Promise.all([
    api("/api/events/" + id),
    api("/api/events")
  ]);
  // organiser_id is only in the list endpoint
  const raw = list.data.find((e) => e.event_id === id) || {};
  const owns = role() === "admin" || (role() === "organiser" && raw.organiser_id === state.user.user_id);
  const past = new Date(ev.event_date).getTime() <= Date.now();
  const canBook = role() === "customer" && !past && ev.available_tickets > 0;

  let bookingBox;
  if (!state.user) {
    bookingBox = `<p>Please <a href="#/login">log in</a> to book tickets.</p>`;
  } else if (role() !== "customer") {
    bookingBox = `<p class="sub">Only customer accounts can book tickets.</p>`;
  } else if (past) {
    bookingBox = `<p class="sub">This event has already taken place.</p>`;
  } else if (ev.available_tickets <= 0) {
    bookingBox = `<p class="sub">Sorry, this event is sold out.</p>`;
  } else {
    bookingBox = `
      <form id="book-form">
        <div class="field">
          <label>Quantity</label>
          <input type="number" name="quantity" min="1" max="${ev.available_tickets}" value="1" required>
        </div>
        <p>Total: <span class="price" id="book-total">${money(ev.ticket_price)}</span></p>
        <div class="form-error"></div>
        <button class="btn" type="submit" style="width:100%">Book now</button>
      </form>`;
  }

  app.innerHTML = `
    <p><a href="#/events">&larr; All events</a></p>
    <div class="detail-grid">
      <div class="panel">
        <div class="page-head" style="margin-bottom:0">
          <h1>${esc(ev.event_name)}</h1>
          ${owns ? `<div style="display:flex;gap:8px"><button class="btn secondary small" id="edit-ev">Edit</button><button class="btn danger small" id="del-ev">Delete</button></div>` : ""}
        </div>
        <p>${esc(ev.description || "No description provided.")}</p>
        <dl class="meta">
          <dt>Date</dt><dd>${fmtDate(ev.event_date)}</dd>
          <dt>Venue</dt><dd>${esc(ev.venue_name)} — ${esc(ev.location)}</dd>
          <dt>Organiser</dt><dd>${esc(ev.organiser_name)}</dd>
          <dt>Price</dt><dd class="price">${money(ev.ticket_price)}</dd>
          <dt>Availability</dt><dd>${ev.available_tickets} of ${ev.total_tickets} tickets left</dd>
        </dl>
      </div>
      <div class="panel"><h2 style="margin-bottom:12px">Tickets</h2>${bookingBox}</div>
    </div>`;

  const bf = $("#book-form");
  if (bf && canBook) {
    const qty = bf.querySelector("[name=quantity]");
    qty.addEventListener("input", () => {
      $("#book-total").textContent = money(Number(ev.ticket_price) * (Number(qty.value) || 0));
    });
    bindForm(bf, async (fd) => {
      const r = await api("/api/bookings", {
        method: "POST",
        body: { event_id: id, quantity: Number(fd.get("quantity")) }
      });
      toast(`Booking #${r.booking.booking_id} confirmed (${money(r.booking.total_amount)})`, "success");
      router();
    });
  }

  $("#edit-ev")?.addEventListener("click", () => eventForm({ ...ev, ...raw }));
  $("#del-ev")?.addEventListener("click", () =>
    confirmBox("Delete event", `Delete "${ev.event_name}"? This cannot be undone.`, async () => {
      await api("/api/events/" + id, { method: "DELETE" });
      toast("Event deleted", "success");
      location.hash = "#/events";
    })
  );
}

async function eventForm(ev) {
  const editing = !!ev;
  let venues = [];
  if (!editing) {
    venues = (await api("/api/venues")).data;
    if (venues.length === 0) return toast("Create a venue first", "error");
  }

  openModal(
    editing ? "Edit event" : "New event",
    `<form>
      ${editing ? "" : `<div class="field"><label>Venue</label>
        <select name="venue_id" required>
          ${venues.map((v) => `<option value="${v.venue_id}">${esc(v.venue_name)} (cap. ${v.capacity})</option>`).join("")}
        </select></div>`}
      <div class="field"><label>Event name</label><input name="event_name" required maxlength="150" value="${esc(ev?.event_name || "")}"></div>
      <div class="field"><label>Description</label><textarea name="description">${esc(ev?.description || "")}</textarea></div>
      <div class="field"><label>Date &amp; time</label><input type="datetime-local" name="event_date" required value="${ev ? toInputDate(ev.event_date) : ""}"></div>
      <div class="two">
        <div class="field"><label>Ticket price (RM)</label><input type="number" name="ticket_price" min="0" step="0.01" required value="${ev ? Number(ev.ticket_price) : ""}"></div>
        ${editing ? "" : `<div class="field"><label>Total tickets</label><input type="number" name="total_tickets" min="1" step="1" required></div>`}
      </div>
      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn secondary" data-cancel>Cancel</button>
        <button type="submit" class="btn">${editing ? "Save changes" : "Create event"}</button>
      </div>
    </form>`,
    async (fd) => {
      const desc = fd.get("description").trim();
      const base = {
        event_name: fd.get("event_name").trim(),
        description: desc || null,
        event_date: toSqlDate(fd.get("event_date")),
        ticket_price: parseFloat(fd.get("ticket_price"))
      };
      if (editing) {
        await api("/api/events/" + ev.event_id, { method: "PUT", body: base });
        toast("Event updated", "success");
      } else {
        await api("/api/events", {
          method: "POST",
          body: {
            ...base,
            venue_id: Number(fd.get("venue_id")),
            total_tickets: parseInt(fd.get("total_tickets"), 10)
          }
        });
        toast("Event created", "success");
      }
      router();
    }
  );
}

/* ---------- venues ---------- */
async function venuesPage() {
  const { data: venues } = await api("/api/venues");

  app.innerHTML = `
    <div class="page-head">
      <div><h1>Venues</h1><p class="sub">${venues.length} venue(s)</p></div>
      ${isStaff() ? `<button class="btn" id="new-venue">+ New venue</button>` : ""}
    </div>
    ${venues.length === 0 ? `<div class="empty">No venues yet.</div>` : `<div class="grid">${venues.map((v) => `
      <div class="card">
        <h3>${esc(v.venue_name)}</h3>
        <p>📍 ${esc(v.location)}</p>
        <p>Capacity: <strong>${Number(v.capacity).toLocaleString()}</strong></p>
        ${isStaff() ? `<div class="actions">
          <button class="btn secondary small" data-edit="${v.venue_id}">Edit</button>
          <button class="btn danger small" data-del="${v.venue_id}">Delete</button>
        </div>` : ""}
      </div>`).join("")}</div>`}`;

  $("#new-venue")?.addEventListener("click", () => venueForm());
  app.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => venueForm(venues.find((v) => v.venue_id === Number(b.dataset.edit))))
  );
  app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const v = venues.find((x) => x.venue_id === Number(b.dataset.del));
      confirmBox("Delete venue", `Delete "${v.venue_name}"?`, async () => {
        await api("/api/venues/" + v.venue_id, { method: "DELETE" });
        toast("Venue deleted", "success");
        router();
      });
    })
  );
}

function venueForm(v) {
  const editing = !!v;
  openModal(
    editing ? "Edit venue" : "New venue",
    `<form>
      <div class="field"><label>Venue name</label><input name="venue_name" required maxlength="150" value="${esc(v?.venue_name || "")}"></div>
      <div class="field"><label>Location</label><input name="location" required maxlength="255" value="${esc(v?.location || "")}"></div>
      <div class="field"><label>Capacity</label><input type="number" name="capacity" min="1" step="1" required value="${v ? Number(v.capacity) : ""}"></div>
      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn secondary" data-cancel>Cancel</button>
        <button type="submit" class="btn">${editing ? "Save changes" : "Create venue"}</button>
      </div>
    </form>`,
    async (fd) => {
      const body = {
        venue_name: fd.get("venue_name").trim(),
        location: fd.get("location").trim(),
        capacity: parseInt(fd.get("capacity"), 10)
      };
      if (editing) await api("/api/venues/" + v.venue_id, { method: "PUT", body });
      else await api("/api/venues", { method: "POST", body });
      toast(editing ? "Venue updated" : "Venue created", "success");
      router();
    }
  );
}

/* ---------- bookings ---------- */
async function bookingsPage() {
  if (needLogin()) return;
  const { data: bookings } = await api("/api/bookings");
  const title = role() === "customer" ? "My Bookings" : role() === "organiser" ? "Bookings for my events" : "All Bookings";

  app.innerHTML = `
    <div class="page-head"><div><h1>${title}</h1><p class="sub">${bookings.length} booking(s)</p></div></div>
    ${bookings.length === 0 ? `<div class="empty">No bookings yet. <a href="#/events">Browse events</a></div>` : `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Event</th>${role() !== "customer" ? "<th>Customer</th>" : ""}
        <th>Qty</th><th>Total</th><th>Status</th><th>Booked</th><th></th>
      </tr></thead>
      <tbody>${bookings.map((b) => {
        const canCancel = b.status !== "cancelled" && (role() === "admin" || (role() === "customer" && b.user_id === state.user.user_id));
        return `<tr>
          <td>${b.booking_id}</td>
          <td><a href="#/events/${b.event_id}">${esc(b.event_name)}</a></td>
          ${role() !== "customer" ? `<td>${esc(b.customer_name)}</td>` : ""}
          <td>${b.quantity}</td>
          <td>${money(b.total_amount)}</td>
          <td><span class="badge ${esc(b.status)}">${esc(b.status)}</span></td>
          <td>${fmtDate(b.booking_date)}</td>
          <td>${canCancel ? `<button class="btn danger small" data-cancel-id="${b.booking_id}">Cancel</button>` : ""}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`}`;

  app.querySelectorAll("[data-cancel-id]").forEach((btn) =>
    btn.addEventListener("click", () =>
      confirmBox("Cancel booking", `Cancel booking #${btn.dataset.cancelId}? Tickets will be returned to the event.`, async () => {
        const r = await api(`/api/bookings/${btn.dataset.cancelId}/cancel`, { method: "PATCH" });
        toast(`Booking cancelled (${r.tickets_restored} ticket(s) restored)`, "success");
        router();
      }, "Cancel booking")
    )
  );
}

/* ---------- users (admin) ---------- */
async function usersPage() {
  if (needLogin()) return;
  if (role() !== "admin") throw new Error("Only administrators can view users.");
  const { data: users } = await api("/api/users");

  app.innerHTML = `
    <div class="page-head"><div><h1>Users</h1><p class="sub">${users.length} user(s)</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
      <tbody>${users.map((u) => `<tr>
        <td>${u.user_id}</td>
        <td>${esc(u.name)}</td>
        <td>${esc(u.email)}</td>
        <td><span class="badge ${esc(u.role)}">${esc(u.role)}</span></td>
        <td>${fmtDate(u.created_at)}</td>
        <td><div class="actions">
          <button class="btn secondary small" data-edit="${u.user_id}">Edit</button>
          ${u.user_id !== state.user.user_id ? `<button class="btn danger small" data-del="${u.user_id}">Delete</button>` : ""}
        </div></td>
      </tr>`).join("")}</tbody>
    </table></div>`;

  app.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => userForm(users.find((u) => u.user_id === Number(b.dataset.edit))))
  );
  app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const u = users.find((x) => x.user_id === Number(b.dataset.del));
      confirmBox("Delete user", `Delete ${u.name} (${u.email})?`, async () => {
        await api("/api/users/" + u.user_id, { method: "DELETE" });
        toast("User deleted", "success");
        router();
      });
    })
  );
}

function userForm(u) {
  openModal(
    "Edit user",
    `<form>
      <div class="field"><label>Name</label><input name="name" required maxlength="100" value="${esc(u.name)}"></div>
      <div class="field"><label>Email</label><input type="email" name="email" required maxlength="150" value="${esc(u.email)}"></div>
      <div class="field"><label>Role</label>
        <select name="role">
          ${["customer", "organiser", "admin"].map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}
        </select></div>
      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn secondary" data-cancel>Cancel</button>
        <button type="submit" class="btn">Save changes</button>
      </div>
    </form>`,
    async (fd) => {
      await api("/api/users/" + u.user_id, {
        method: "PUT",
        body: { name: fd.get("name").trim(), email: fd.get("email").trim(), role: fd.get("role") }
      });
      toast("User updated", "success");
      router();
    }
  );
}

/* ---------- start ---------- */
router();