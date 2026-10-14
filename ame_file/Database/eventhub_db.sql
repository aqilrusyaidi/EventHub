-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 14, 2026 at 10:27 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `eventhub_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `booking_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('confirmed','cancelled') DEFAULT 'confirmed',
  `booking_date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`booking_id`, `user_id`, `event_id`, `quantity`, `total_amount`, `status`, `booking_date`) VALUES
(1, 3, 1, 2, 100.00, 'confirmed', '2026-10-10 13:57:26'),
(2, 4, 2, 1, 120.00, 'confirmed', '2026-10-10 13:57:26'),
(3, 5, 3, 2, 40.00, 'confirmed', '2026-10-10 13:57:26'),
(4, 3, 4, 1, 150.00, 'confirmed', '2026-10-10 13:57:26'),
(5, 4, 5, 1, 80.00, 'confirmed', '2026-10-10 13:57:26'),
(6, 6, 3, 10, 200.00, 'confirmed', '2026-10-10 14:03:58'),
(7, 4, 1, 1, 50.00, 'cancelled', '2026-10-14 04:07:11'),
(8, 4, 7, 1, 0.00, 'confirmed', '2026-10-14 07:10:48');

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `event_id` int(11) NOT NULL,
  `organiser_id` int(11) NOT NULL,
  `venue_id` int(11) NOT NULL,
  `event_name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `event_date` datetime NOT NULL,
  `ticket_price` decimal(10,2) NOT NULL,
  `total_tickets` int(11) NOT NULL,
  `available_tickets` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`event_id`, `organiser_id`, `venue_id`, `event_name`, `description`, `event_date`, `ticket_price`, `total_tickets`, `available_tickets`) VALUES
(1, 2, 1, 'Technology Expo 2026', 'Technology and innovation exhibition', '2026-11-15 09:00:00', 50.00, 500, 498),
(2, 2, 2, 'Music Festival 2026', 'Live music performances', '2026-12-05 18:00:00', 120.00, 800, 799),
(3, 2, 3, 'Food Carnival', 'Malaysian food and beverage carnival', '2026-11-20 10:00:00', 20.00, 400, 388),
(4, 2, 4, 'Business Conference', 'Business and entrepreneurship event', '2026-12-10 09:00:00', 150.00, 600, 599),
(5, 2, 5, 'Cybersecurity Workshop', 'Cybersecurity training workshop', '2026-11-25 09:00:00', 80.00, 200, 199),
(6, 1, 1, 'Comic Fest', 'Anime convention', '2026-10-17 10:00:00', 10.00, 200, 200),
(7, 1, 6, 'Anime Fest', 'Part of the ACG Base 1st Anniversary celebration (\"Chapter 1: One Year of Fandom\"), featuring anime activities, merchandise, and fan gatherings.', '2026-10-17 10:00:00', 0.00, 10000, 9999);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','organiser','customer') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `name`, `email`, `password`, `role`, `created_at`) VALUES
(1, 'Admin EventHub', 'admin@eventhub.com', '$2b$12$CD7bg/rTyCbXYt7epWS06eu/5yTy0yXwmY7MQsDqNkgIgN8ZaDrQm', 'admin', '2026-10-10 13:57:26'),
(2, 'Ali Ahmad', 'ali@eventhub.com', '$2b$12$CD7bg/rTyCbXYt7epWS06eu/5yTy0yXwmY7MQsDqNkgIgN8ZaDrQm', 'organiser', '2026-10-10 13:57:26'),
(3, 'Siti Aminah', 'siti@eventhub.com', '$2b$12$CD7bg/rTyCbXYt7epWS06eu/5yTy0yXwmY7MQsDqNkgIgN8ZaDrQm', 'customer', '2026-10-10 13:57:26'),
(4, 'John Tan', 'john@eventhub.com', '$2b$12$CD7bg/rTyCbXYt7epWS06eu/5yTy0yXwmY7MQsDqNkgIgN8ZaDrQm', 'customer', '2026-10-10 13:57:26'),
(5, 'Nur Aisyah', 'aisyah@eventhub.com', '$2b$12$CD7bg/rTyCbXYt7epWS06eu/5yTy0yXwmY7MQsDqNkgIgN8ZaDrQm', 'customer', '2026-10-10 13:57:26'),
(6, 'kasim', 'kasim@eventhub.com', '$2b$12$CD7bg/rTyCbXYt7epWS06eu/5yTy0yXwmY7MQsDqNkgIgN8ZaDrQm', 'admin', '2026-10-10 14:03:25');

-- --------------------------------------------------------

--
-- Table structure for table `venues`
--

CREATE TABLE `venues` (
  `venue_id` int(11) NOT NULL,
  `venue_name` varchar(150) NOT NULL,
  `location` varchar(255) NOT NULL,
  `capacity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `venues`
--

INSERT INTO `venues` (`venue_id`, `venue_name`, `location`, `capacity`) VALUES
(1, 'KL Convention Centre', 'Kuala Lumpur', 3000),
(2, 'Unifi Arena', 'Bukit Jalil', 1000),
(3, 'Penang Event Hall', 'George Town', 800),
(4, 'Johor Exhibition Centre', 'Johor Bahru', 1500),
(5, 'Putrajaya Auditorium', 'Putrajaya', 500),
(6, 'LaLaport Bukit Bintang City Centre', '2, Jln Hang Tuah, Bukit Bintang, 55100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur', 10000);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`booking_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `event_id` (`event_id`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`event_id`),
  ADD KEY `organiser_id` (`organiser_id`),
  ADD KEY `venue_id` (`venue_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `venues`
--
ALTER TABLE `venues`
  ADD PRIMARY KEY (`venue_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `booking_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `event_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `venues`
--
ALTER TABLE `venues`
  MODIFY `venue_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`);

--
-- Constraints for table `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`organiser_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `events_ibfk_2` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`venue_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
