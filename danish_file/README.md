# EventHub

Event Ticketing and Venue Booking System for SWC3633 / SWC4443.

One REST API (Node.js, Express, MySQL) shared by every member's frontend.
This folder holds the complete system: database scripts, backend, one
frontend and the Postman tests.

```
backend/     the REST API            (run with: node server.js)
frontend/    the website             (open index.html)
database/    SQL scripts             (import in phpMyAdmin)
postman/     Postman collection      (import in Postman)
```

## Run it

You need XAMPP and Node.js 18 or newer.

### 1. Database

1. In the XAMPP Control Panel, start **Apache** and **MySQL**.
2. Open `http://localhost/phpmyadmin`.
3. Click **Import**, choose `database/schema.sql`, click **Import**.
4. Click **Import** again, choose `database/seed.sql`, click **Import**.

If `eventhub_db` already exists and you only need working logins,
import `database/fix_passwords.sql` instead.

To start again with clean sample data: click `eventhub_db`, then
**Operations**, then **Drop the database**, and repeat steps 3 and 4.

### 2. Backend

1. Open the `backend` folder in File Explorer.
2. Click the address bar, type `cmd`, press Enter.
3. In the black window type `node server.js` and press Enter.

It must say:

```
MySQL connected successfully!
EventHub API running at http://localhost:3000
```

Keep the window open. Every request now appears there as one line.

The backend reads its settings from `backend/.env`. If that file is
missing, copy `.env.example` to `.env` and fill it in.

### 3. Frontend

Double-click `frontend/index.html`.

For a `http://localhost` address in the demo video, copy the `frontend`
folder into `C:\xampp\htdocs\` and open
`http://localhost/frontend/index.html`.

## Sample accounts

Password for all of them: `password123`

| Role      | Email               |
|-----------|---------------------|
| Admin     | admin@eventhub.com  |
| Organiser | ali@eventhub.com    |
| Customer  | siti@eventhub.com   |
| Customer  | john@eventhub.com   |
| Customer  | aisyah@eventhub.com |

## API endpoints

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Who | Purpose |
|--------|----------|-----|---------|
| POST | `/register` | anyone | create a customer account |
| POST | `/login` | anyone | get a JWT |
| GET | `/users` | admin | list users |
| GET | `/users/:id` | admin | one user |
| PUT | `/users/:id` | admin | update name, email, role |
| DELETE | `/users/:id` | admin | delete a user |
| GET | `/events` | anyone | list events (supports `?page=&limit=`) |
| GET | `/events/:id` | anyone | one event with venue and organiser |
| GET | `/events/:id/weather` | anyone | weather at the venue (Open-Meteo) |
| POST | `/events` | admin, organiser | create an event |
| PUT | `/events/:id` | admin, owner | update an event |
| DELETE | `/events/:id` | admin, owner | delete an event |
| GET | `/venues` | anyone | list venues |
| GET | `/venues/:id` | anyone | one venue |
| POST | `/venues` | admin, organiser | create a venue |
| PUT | `/venues/:id` | admin, organiser | update a venue |
| DELETE | `/venues/:id` | admin, organiser | delete a venue |
| GET | `/bookings` | logged in | bookings the user may see |
| GET | `/bookings/:id` | admin, owner, organiser | one booking |
| POST | `/bookings` | customer | book tickets |
| PATCH | `/bookings/:id/cancel` | admin, owner | cancel a booking |

Protected endpoints need the header `Authorization: Bearer <token>`.

## Third-party API: Open-Meteo weather

File: `backend/weatherService.js`. Route: `GET /api/events/:id/weather`.

The API takes the venue's location from the database, asks the
Open-Meteo **Geocoding API** for its coordinates, then asks the
Open-Meteo **Forecast API** for the weather there.

- Event within the next 16 days: the forecast for the event day.
- Event further away: the weather right now, with a note.
- Open-Meteo down or slow (8 second limit): the API answers 502 and
  everything else keeps working.
- Open-Meteo needs no API key for non-commercial use, so no secret is
  stored. Its two addresses can be changed in `.env`.

The frontend shows it on the event page under "Weather at the venue".

Try it: open `http://localhost:3000/api/events/1/weather`.
This needs an internet connection.

## API management features

| Feature | File | What it does | How to show it |
|---------|------|--------------|----------------|
| Logging | `backend/logger.js` | Every request is written to the terminal and to `backend/logs/access.log` with time, method, URL, status, duration, IP and user | Look at the backend window while using the site |
| Rate limiting | `backend/rateLimiter.js` | 300 requests per IP every 15 minutes on the whole API. Login: 10 failed attempts per IP every 5 minutes, then `429 Too Many Requests` | Postman request 21, or type a wrong password 11 times on the login page |
| Pagination | `backend/server.js`, `GET /api/events` | `?page=1&limit=2` returns one page plus a `pagination` block. Without these it returns every event, as before | Postman request 19 |
| Caching | `backend/weatherService.js` | Weather answers are kept for 30 minutes, so Open-Meteo is not called again for the same event | Postman request 18: response header `X-Cache: HIT` |

A rate-limit block clears by itself after 5 minutes, or straight away
when the backend is restarted.

## Postman tests

1. In Postman click **Import** and choose
   `postman/EventHub.postman_collection.json`.
2. Send the requests from top to bottom. The three login requests save
   the tokens that later requests use.
3. Each request has a test, so the **Test Results** tab shows PASS.
4. Send request 21 last. It blocks logins for 5 minutes.

## What each role can do in the frontend

| Page | Guest | Customer | Organiser | Admin |
|------|-------|----------|-----------|-------|
| Events | view | view | view | view |
| Event details and weather | view | view and book | view | view |
| Bookings | – | own bookings, cancel | bookings for own events | all bookings, cancel |
| Manage events | – | – | own events: create, edit, delete | all events |
| Venues | – | – | add, edit, delete | add, edit, delete |
| Users | – | – | – | edit, change role, delete |

## Before uploading to GitHub

Do **not** upload these three:

- `backend/.env` holds the JWT secret
- `backend/node_modules/` is rebuilt with `npm install`
- `backend/logs/` is created when the server runs

The `.gitignore` file already excludes them when you use Git or GitHub
Desktop. If you upload through the GitHub website by dragging files,
leave them out by hand.
