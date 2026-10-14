// ---------------------------------------------------------
// logger.js
// API management feature 1: REQUEST LOGGING
//
// Records one line for every request the API answers:
//   time, method, URL, status code, how long it took,
//   the caller's IP address and the logged-in user (if any).
//
// Each line is printed in the terminal and also saved to
// logs/access.log, so there is a record of who called what.
// ---------------------------------------------------------

const fs = require("fs");
const path = require("path");

const LOG_FOLDER = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_FOLDER, "access.log");

// Create the logs folder the first time the server starts
fs.mkdirSync(LOG_FOLDER, { recursive: true });

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  // "finish" fires after the response has been sent, so the
  // status code and the time taken are known at that point.
  res.on("finish", () => {
    const duration = Date.now() - startedAt;

    // req.user is set by authMiddleware when a valid token was sent
    const user = req.user
      ? "user " + req.user.user_id + " (" + req.user.role + ")"
      : "guest";

    const line =
      "[" + new Date().toISOString() + "] " +
      req.method + " " + req.originalUrl + " " +
      res.statusCode + " " + duration + "ms " +
      req.ip + " " + user;

    console.log(line);

    // Append to the log file. A logging problem must never
    // break the API, so a write error is only reported.
    fs.appendFile(LOG_FILE, line + "\n", (error) => {
      if (error) {
        console.error("Could not write to access.log:", error.message);
      }
    });
  });

  next();
}

module.exports = requestLogger;
