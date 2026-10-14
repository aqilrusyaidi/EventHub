-- Use this ONLY if your database is already loaded and the sample
-- accounts cannot log in. It sets the password of sample users 1-5
-- to:  password123
-- It does not touch events, venues, bookings or any other users.
USE eventhub_db;
UPDATE users
SET password = '$2b$10$8Ppxlin1uf3jMyHG24Fobe7CwyNFLqHbMa/kQp4ixmdyUlqw0Hxn.'
WHERE user_id IN (1, 2, 3, 4, 5);
