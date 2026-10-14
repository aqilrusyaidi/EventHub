-- EventHub database schema (DDL)
CREATE DATABASE IF NOT EXISTS eventhub_db;
USE eventhub_db;

-- TABLE 1: USERS
CREATE TABLE users (
  user_id    INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('admin', 'organiser', 'customer') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 2: VENUES
CREATE TABLE venues (
  venue_id   INT AUTO_INCREMENT PRIMARY KEY,
  venue_name VARCHAR(150) NOT NULL,
  location   VARCHAR(255) NOT NULL,
  capacity   INT NOT NULL
);

-- TABLE 3: EVENTS
CREATE TABLE events (
  event_id          INT AUTO_INCREMENT PRIMARY KEY,
  organiser_id      INT NOT NULL,
  venue_id          INT NOT NULL,
  event_name        VARCHAR(150) NOT NULL,
  description       TEXT,
  event_date        DATETIME NOT NULL,
  ticket_price      DECIMAL(10,2) NOT NULL,
  total_tickets     INT NOT NULL,
  available_tickets INT NOT NULL,
  FOREIGN KEY (organiser_id) REFERENCES users(user_id),
  FOREIGN KEY (venue_id)     REFERENCES venues(venue_id)
);

-- TABLE 4: BOOKINGS
CREATE TABLE bookings (
  booking_id   INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  event_id     INT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  status       ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  FOREIGN KEY (event_id) REFERENCES events(event_id)
);
