-- EventHub sample data (DML)
-- Run AFTER schema.sql.
-- All five sample accounts use the password:  password123
-- (the hash below is a real bcrypt hash, so these accounts can log in)
--   admin@eventhub.com   admin
--   ali@eventhub.com     organiser
--   siti@eventhub.com    customer
--   john@eventhub.com    customer
--   aisyah@eventhub.com  customer
USE eventhub_db;
INSERT INTO users (user_id, name, email, password, role) VALUES
(1, 'Admin EventHub', 'admin@eventhub.com', '$2b$10$8Ppxlin1uf3jMyHG24Fobe7CwyNFLqHbMa/kQp4ixmdyUlqw0Hxn.', 'admin'),
(2, 'Ali Ahmad', 'ali@eventhub.com', '$2b$10$8Ppxlin1uf3jMyHG24Fobe7CwyNFLqHbMa/kQp4ixmdyUlqw0Hxn.', 'organiser'),
(3, 'Siti Aminah', 'siti@eventhub.com', '$2b$10$8Ppxlin1uf3jMyHG24Fobe7CwyNFLqHbMa/kQp4ixmdyUlqw0Hxn.', 'customer'),
(4, 'John Tan', 'john@eventhub.com', '$2b$10$8Ppxlin1uf3jMyHG24Fobe7CwyNFLqHbMa/kQp4ixmdyUlqw0Hxn.', 'customer'),
(5, 'Nur Aisyah', 'aisyah@eventhub.com', '$2b$10$8Ppxlin1uf3jMyHG24Fobe7CwyNFLqHbMa/kQp4ixmdyUlqw0Hxn.', 'customer');
INSERT INTO venues (venue_id, venue_name, location, capacity) VALUES
(1, 'KL Convention Centre', 'Kuala Lumpur', 3000),
(2, 'Unifi Arena', 'Bukit Jalil', 1000),
(3, 'Penang Event Hall', 'George Town', 800),
(4, 'Johor Exhibition Centre', 'Johor Bahru', 1500),
(5, 'Putrajaya Auditorium', 'Putrajaya', 500);
INSERT INTO events (event_id, organiser_id, venue_id, event_name, description, event_date, ticket_price, total_tickets, available_tickets) VALUES
(1, 2, 1, 'Technology Expo 2026', 'Technology and innovation exhibition', '2026-11-15 09:00:00', 50.00, 500, 498),
(2, 2, 2, 'Music Festival 2026', 'Live music performances', '2026-12-05 18:00:00', 120.00, 800, 799),
(3, 2, 3, 'Food Carnival', 'Malaysian food and beverage carnival', '2026-11-20 10:00:00', 20.00, 400, 398),
(4, 2, 4, 'Business Conference', 'Business and entrepreneurship event', '2026-12-10 09:00:00', 150.00, 600, 599),
(5, 2, 5, 'Cybersecurity Workshop', 'Cybersecurity training workshop', '2026-11-25 09:00:00', 80.00, 200, 199);
INSERT INTO bookings (booking_id, user_id, event_id, quantity, total_amount, status) VALUES
(1, 3, 1, 2, 100.00, 'confirmed'),
(2, 4, 2, 1, 120.00, 'confirmed'),
(3, 5, 3, 2, 40.00, 'confirmed'),
(4, 3, 4, 1, 150.00, 'confirmed'),
(5, 4, 5, 1, 80.00, 'confirmed');
