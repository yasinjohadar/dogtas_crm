-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 24, 2026 at 12:12 PM
-- Server version: 10.11.16-MariaDB
-- PHP Version: 8.5.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dogtas_crm_local`
--

-- --------------------------------------------------------

--
-- Table structure for table `branches`
--

CREATE TABLE `branches` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `manager_user_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `branches`
--

INSERT INTO `branches` (`id`, `name`, `address`, `phone`, `manager_user_id`, `is_active`, `created_at`) VALUES
(1, 'حلب', 'حلب الجديدة جنوبي جمعية البيئة2', '+963 960 622 271', NULL, 1, '2026-11-18 15:44:11'),
(2, 'دمشق', NULL, NULL, NULL, 1, '2026-11-18 15:44:11'),
(3, 'إدلب', 'شارع المولات، مقابل مشفى الحياة', '+963 960 622 271', 4, 1, '2026-11-18 15:44:11');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `address` mediumtext DEFAULT NULL,
  `notes` mediumtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `branch` varchar(50) DEFAULT NULL,
  `product` varchar(255) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `next_date` date DEFAULT NULL,
  `followup_history` longtext DEFAULT NULL CHECK (json_valid(`followup_history`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `full_name`, `phone`, `email`, `city`, `address`, `notes`, `created_at`, `branch`, `product`, `status`, `employee_id`, `next_date`, `followup_history`) VALUES
(9, 'Amal sabouni', '896735', NULL, NULL, NULL, '', '2026-11-22 19:49:11', 'حلب', 'غرفة نوم', 'جديد', 17, '2026-11-22', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `customer_reviews`
--

CREATE TABLE `customer_reviews` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `customer_name` varchar(150) NOT NULL,
  `customer_phone` varchar(30) DEFAULT NULL,
  `service_rating` tinyint(4) NOT NULL,
  `employee_rating` tinyint(4) DEFAULT NULL,
  `delivery_rating` tinyint(4) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `review_source` enum('employee','customer') NOT NULL,
  `review_token` varchar(64) DEFAULT NULL,
  `review_link_id` int(11) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `customer_reviews`
--

INSERT INTO `customer_reviews` (`id`, `customer_id`, `branch_id`, `employee_id`, `customer_name`, `customer_phone`, `service_rating`, `employee_rating`, `delivery_rating`, `comment`, `review_source`, `review_token`, `review_link_id`, `status`, `created_at`) VALUES
(1, NULL, 1, NULL, 'ب', '', 5, 5, 5, 'بيسلي', 'customer', NULL, 1, 'approved', '2026-11-18 19:07:45'),
(2, 4, 2, 5, 'زبون اختبار الصلاحيات', '896735', 5, 5, 5, '', 'customer', NULL, 5, 'approved', '2026-11-18 19:34:57'),
(3, 9, 1, 17, 'Amal sabouni', '896735', 5, 5, 5, '', 'customer', NULL, 18, 'approved', '2026-11-22 19:52:47');

-- --------------------------------------------------------

--
-- Table structure for table `customer_statuses`
--

CREATE TABLE `customer_statuses` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_statuses`
--

INSERT INTO `customer_statuses` (`id`, `name`, `is_active`, `sort_order`, `created_at`) VALUES
(1, 'جديد', 1, 1, '2026-11-21 21:13:32'),
(2, 'مهتم جداً', 1, 2, '2026-11-21 21:13:32'),
(3, 'بحاجة لمتابعة', 1, 3, '2026-11-21 21:13:32'),
(4, 'تم الشراء', 1, 4, '2026-11-21 21:13:32'),
(5, 'خسرنا الزبون', 1, 5, '2026-11-21 21:13:32'),
(6, 'بانتظار الرد', 1, 6, '2026-11-21 21:54:48');

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` int(11) NOT NULL,
  `legacy_id` varchar(36) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `branch` varchar(50) NOT NULL,
  `role` varchar(100) NOT NULL,
  `status` varchar(30) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`id`, `legacy_id`, `name`, `phone`, `branch`, `role`, `status`, `notes`, `created_at`) VALUES
(10, NULL, 'ايهم فيليس', '0960622235', 'إدلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:47:24'),
(11, NULL, 'ظافر ابو صالح', '0960622252', 'إدلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:47:50'),
(12, NULL, 'علاء سالم', '0960622241', 'حلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:48:11'),
(13, NULL, 'بلال الحداد', '0960622243', 'حلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:48:41'),
(14, NULL, 'محمد الشيخ', '0960622117', 'حلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:49:20'),
(15, NULL, 'محمد بركات', '0960622238', 'إدلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:49:36'),
(16, NULL, 'راما بكري', '0960622275', 'إدلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:50:14'),
(17, NULL, 'عائشة بريمو', '0960222271', 'حلب', 'موظف مبيعات', 'نشط', '', '2026-11-22 18:50:44');

-- --------------------------------------------------------

--
-- Table structure for table `review_links`
--

CREATE TABLE `review_links` (
  `id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `link_type` enum('branch','customer') NOT NULL,
  `token_hash` char(64) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `expires_at` datetime DEFAULT NULL,
  `max_uses` int(11) DEFAULT NULL,
  `use_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `token_encrypted` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `review_links`
--

INSERT INTO `review_links` (`id`, `branch_id`, `customer_id`, `link_type`, `token_hash`, `is_active`, `expires_at`, `max_uses`, `use_count`, `created_at`, `token_encrypted`) VALUES
(1, 1, NULL, 'branch', 'e9b157b572820c9f5595eec77fdd5caaf2fabc2d8f0af8ab45cc1ef897c568ea', 1, NULL, NULL, 1, '2026-11-18 19:05:46', NULL),
(2, 1, NULL, 'branch', '96865052e3f89723f82b967632ae8b82eb2104af089fb857735003f5fe71800e', 1, NULL, NULL, 0, '2026-11-18 19:08:19', NULL),
(3, 1, NULL, 'branch', 'b868a2eb2626c23b9c836284cc9e5e63221417abbf6e195c32fe5a9a26c7135b', 1, NULL, NULL, 0, '2026-11-18 19:10:07', NULL),
(4, 1, NULL, 'branch', '5e43396714a5af4686dac07e1f5911477efe03471af220ebd4482014bc3e6b3d', 1, NULL, NULL, 0, '2026-11-18 19:30:15', NULL),
(5, 2, 4, 'customer', '669d0fc00e8952e2efc22912bcf1c5efa58324257833e1b0e0c40aa127eb83f8', 1, '2026-12-18 22:32:49', 1, 1, '2026-11-18 19:32:49', NULL),
(6, 1, NULL, 'branch', '47b5a569b07607ec9ea2d458bc19d3e2221c0ed0e6c6912a84d60858646dc358', 1, NULL, NULL, 0, '2026-11-18 19:44:45', NULL),
(7, 2, NULL, 'branch', 'eb5b936c194dca5fd0285c32a2502eb41989acee73888815455a810e7ef9240e', 1, NULL, NULL, 0, '2026-11-18 19:53:03', NULL),
(8, 3, 6, 'customer', '215196060b92ca2806c069bc44e1132a3d682b59b4f879ec3059e63aa8cf9937', 1, '2026-12-18 22:53:41', 1, 0, '2026-11-18 19:53:41', NULL),
(9, 1, NULL, 'branch', '0542527233c90c9692c9309ae099863dcbc82276eca59b903f5cbd97cd360188', 1, NULL, NULL, 0, '2026-11-18 19:56:06', NULL),
(10, 2, NULL, 'branch', '194d47229391599bbb6bb585a22ebc68ecca5c93e3e883ab170583850e1c216b', 1, NULL, NULL, 0, '2026-11-18 20:10:07', '8e7bc8ce8bf0dbb56443ceb5:a64e693db7e8cbaac7e3ac0eb45055d5:2f178635401839d0b162711e8f4b1365ba791dad2503f31aed193183266463a9396226495cad5f86864c233f13130df92113925dd6cf046f6651f3978ac4dacc'),
(11, 3, NULL, 'branch', '3508fcfca7078366a1153480190d68b1c599ab2ae3d2e6a59996cd43aeb47e37', 1, NULL, NULL, 0, '2026-11-18 20:10:11', '5b2b573634f759bee04f0b40:fc3f1c815355f3db446ea2dd0795dbdc:1ae2961b30705ffd79f1139eed2f0b3aa4ca76253cee946c82a87018f8aa2852f1a7765c58f55987c3cdb7508db864eff95946d4776af9b6b592a3c91b77acea'),
(12, 1, NULL, 'branch', '2958af6ceb5c56a198e03e87e7a086637f1464085ebb8064e1a09ce2083101e6', 1, NULL, NULL, 0, '2026-11-18 20:41:51', NULL),
(13, 1, NULL, 'branch', 'c4dbe68ec3f6b86aac3abe122cea8242582b477a6d48f63568e6d711cfcfa80f', 1, NULL, NULL, 0, '2026-11-18 20:44:17', NULL),
(14, 1, NULL, 'branch', '143e17e1081365eb3529fc385a754b6c0402888d335820e125a5dc03317cecc1', 1, NULL, NULL, 0, '2026-11-18 20:47:18', NULL),
(15, 1, NULL, 'branch', '88f9b518aca7aa977cc2af7974bb2784df41a7614904b71a111e4d59f7288ce5', 1, NULL, NULL, 0, '2026-11-18 20:48:48', '5bd63b07246e739e05cc27d8:102c061ac18bd50594d045681dcd7b7b:a4b65d9f5f0e711e401cf8636acca0eb8f54ed75e25385740efb9ea36be408591a290ec227f81b5aa3c3a4766225e76cd0bf5836591fe57674c5aff7f54e0bd7'),
(16, 1, NULL, 'branch', 'aad2bc0084554973c076fbcc72f31308ffc2b0a23c7353a04bea9807cb3efac6', 1, NULL, NULL, 0, '2026-11-22 19:51:42', NULL),
(17, 2, NULL, 'branch', '015072e62c4cb556c97ae09b15f58fb6def00bdf9b7737c087d237373b0786b9', 1, NULL, NULL, 0, '2026-11-22 19:52:09', NULL),
(18, 1, 9, 'customer', '3eafef67c5bdd1738f8ba89f239f315c2e9233dc6649ea5d6aa79c0fbb5b9f04', 1, '2026-12-22 22:52:17', 1, 1, '2026-11-22 19:52:17', NULL),
(19, 1, NULL, 'branch', '173dd45e08bb7c35ff928318ca89c5050d3433c8d016fab332a537abbf359cd2', 1, NULL, NULL, 0, '2026-11-22 19:53:06', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `branch` varchar(50) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `product_type` varchar(100) NOT NULL,
  `model_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `sale_date` date NOT NULL,
  `sale_status` varchar(50) NOT NULL DEFAULT 'تم البيع',
  `payment_status` varchar(100) NOT NULL DEFAULT 'لم يتم دفع المبلغ كامل',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`id`, `customer_id`, `branch`, `employee_id`, `product_type`, `model_name`, `quantity`, `sale_date`, `sale_status`, `payment_status`, `notes`, `created_at`) VALUES
(1, 5, 'حلب', 8, 'غرفة جلوس', 'mılena', 1, '2026-11-17', 'ملغي', 'تم دفع المبلغ كامل', '', '2026-11-17 12:26:41'),
(2, 3, 'دمشق', 5, 'غرفة سفرة', 'يسبثص', 1, '2026-11-17', 'تم البيع', 'تم دفع المبلغ كامل', '', '2026-11-17 20:41:18');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','employee','branch_manager','sales','followup') NOT NULL DEFAULT 'employee',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `branch` varchar(50) DEFAULT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `token_version` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `username`, `password_hash`, `role`, `is_active`, `created_at`, `branch`, `employee_id`, `token_version`) VALUES
(1, 'CRM Administrator', 'admin-aisha', '$2a$12$ux8GJ4M15lwZUF.ZJ7i8D.kkm6r00JRO9ICsQcZPyO10GOg/DpaeW', 'admin', 1, '2026-11-15 19:46:52', NULL, NULL, 0),
(2, 'Amal Ammar Sabouni', 'amal', '$2a$12$8ZZ1v1/uEwrfpANyXG8wSu74ciilKIQ7ugjJcoZ2ro/pv0ZSE6Xim', 'branch_manager', 0, '2026-11-16 12:53:28', 'دمشق', 2, 1),
(3, 'umut', 'umut', '$2a$12$N9ErbmhB.HDcStJ5cnKRWeZXYu9U9b/ThHvHYXo24MVCKLZHSpPqe', 'sales', 0, '2026-11-16 12:56:12', 'حلب', 3, 1),
(4, 'sana', 'sana', '$2a$12$q4xCVzeXRLRt.nqLVkPXauaGS9dR2XzvAg9PfoBXH3m.EBypKJLLC', 'branch_manager', 0, '2026-11-16 13:39:35', 'إدلب', 4, 1),
(5, 'ال', 'follow', '$2a$12$zpnVWjHt7C6Mgc4PeMqoUuVUN4Tx20fQVmJS160wQEU4yK7JdmN0e', 'followup', 0, '2026-11-16 14:22:42', 'إدلب', 6, 3),
(6, 'leen', 'leen16', '$2a$12$EotwsaTw9rGxfzJDw.riSO1.Z0zerzMywrORWjaAyYN7xUzXqUcrK', 'sales', 0, '2026-11-16 14:46:06', 'إدلب', 7, 6),
(7, 'aysel', 'aysel16', '$2a$12$d9spnGRgXcjrMHU2/5LwMeIWd8QQJ8vFZ07uNqLAGK0NJPga/5Kda', 'sales', 0, '2026-11-16 14:59:34', 'دمشق', 5, 3),
(8, 'alı', 'nur16', '$2a$12$lgGZ0yMYJGCAd53NRkQ.SeIIg0upw3vaw7LhcmIog6X3r5zFSgZWO', 'followup', 0, '2026-11-16 15:41:52', 'حلب', 8, 4),
(9, 'عائشة بريمو', 'aysabirimo5', '$2a$12$7.l27Jb78YpADSGd5RMS3OgCZfcV3VNzie9kfqxl0.o.iyh469B6K', 'sales', 1, '2026-11-22 18:53:57', 'حلب', 17, 0),
(10, 'راما بكري', 'rama.bakri', '$2a$12$yEpGJm4gsgKAF1Jom0jsy.FIjRPj0foymthkb6HbicWjLc2f/4436', 'sales', 1, '2026-11-22 18:57:35', 'إدلب', 16, 0),
(11, 'محمد بركات', 'mohammad.barakat', '$2a$12$0kFUfvlso82agl6.7UNxQ.p7yvGQ.u0jhkrEj9rHgB34o8gOTGvLC', 'sales', 1, '2026-11-22 18:58:49', 'حلب', 15, 0),
(12, 'محمد الشيخ', 'mohammad.alsheikh', '$2a$12$52QRneyFelZyQyOmbtIEeOt9/4SnS5wZ96P5ZyqujEcoILXXs6Ekm', 'sales', 1, '2026-11-22 19:01:31', 'حلب', 14, 0),
(13, 'بلال الحداد', 'bilal.alhaddad', '$2a$12$b1MB2dgn6iDxnF6XiztLuuVuSNMLzEbfDSaXvBFq1vJgmxYuh/VgC', 'sales', 1, '2026-11-22 19:03:28', 'حلب', 13, 0),
(14, 'علاء سالم', 'alaa.salem', '$2a$12$qAubfHlkM.wyVqxMMQtbHeXTkwLw0T9s.LX4sZq7bcBB2yLi45PFu', 'sales', 1, '2026-11-22 19:04:28', 'حلب', 12, 0),
(15, 'ظافر ابو صالح', 'zafer.abosaleh', '$2a$12$Wt7kZl4dGkCz0I5iMq2mJug5c0CSA73/xxRhWFRKp1wRnhNzLprMe', 'sales', 1, '2026-11-22 19:05:21', 'إدلب', 11, 0),
(16, 'ايهم فيليس', 'ayham.felis', '$2a$12$DaYjFjGSeK3.Ae4zQ3Yrcu67bphvGQc.aoP2673lSkW716c7hS0O2', 'sales', 1, '2026-11-22 19:05:43', 'إدلب', 10, 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `device_info` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `user_id`, `token_hash`, `device_info`, `ip_address`, `created_at`, `expires_at`, `revoked_at`) VALUES
(1, 1, 'ef1ac89eff442bf421c488baf17376fce7a497cff3c3271f9f60bbb9cd4ff9ea', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 14:33:29', '2026-11-22 22:33:29', '2026-11-22 14:57:08'),
(2, 1, '23bc98b1cbf5d2294916fef6535bfa4b5fac58bfe3a372317a6063a716393246', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 14:35:02', '2026-11-22 22:35:02', '2026-11-22 14:57:14'),
(3, 1, '6a4178227d6d49d1b7f7b7693085bdf7a40e781cdc0370fc9111a7f73c4739c9', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 14:53:58', '2026-11-22 22:53:58', '2026-11-22 14:57:19'),
(4, 1, 'a2909c844eb9279df16987c92d1a34ad2e22e68e0d548bbba8c1d103e04b742e', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 14:56:43', '2026-11-22 22:56:43', '2026-11-22 15:01:27'),
(5, 1, 'c5fdbe1958dfc45ed74ce51047e57f4065d801aa0bf9abf1dc7abcfeab69859a', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 15:01:12', '2026-11-22 23:01:12', '2026-11-22 15:01:27'),
(6, 1, '2586b70650bc2341c47a4ce0f5f3a1582d728949ddb979f7308e29c3cfec278f', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 15:01:32', '2026-11-22 23:01:32', NULL),
(7, 1, 'aad3cea4b78ed2b4352dfc27f15630092709982d5ecfdd6b248fa969f7de7053', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 15:02:44', '2026-11-22 23:02:44', NULL),
(8, 1, '81e8efc668e4c9f17b85644d6cf82997444209e5be8a1abd9028ddd295a88de5', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 15:07:51', '2026-11-22 23:07:51', NULL),
(9, 1, 'bddf30292b5d1036b51c8fc4ae9e5b694ecf16e7a240345c92130c70e7777f11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 15:09:03', '2026-11-22 23:09:03', NULL),
(10, 1, 'c5ef693d70d300a39ed834faefbb92c30552e9f835c06dbc82c11dea58b191bb', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 15:09:30', '2026-11-22 23:09:30', NULL),
(11, 1, '46531281e33c4430f7f933b1e51069ef4866c64a66223779a394d6ee2e4f07be', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 18:36:31', '2026-11-23 02:36:31', NULL),
(12, 1, 'dc415a4bb9ddb297e3160de09c0b7af6041402c0788e7ee8eb320d88ce4035d6', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 18:45:27', '2026-11-23 02:45:27', NULL),
(13, 16, 'f53d295f9abc9660515429f8c44c04e60df9b5f8e1c66d6c37237de19249db21', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:24:58', '2026-11-23 03:24:58', NULL),
(14, 1, '8012adb061987075d6c2079371bf7c9891fc7cb0126c46eea5020e85667f0411', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:25:55', '2026-11-23 03:25:55', NULL),
(15, 1, 'db70873116708a18a3fd1ccd9f3fc89c070bc5e9e5ddbe1329e5afd3f4b2a82d', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:47:04', '2026-11-23 03:47:04', NULL),
(16, 1, '2d807fbd748a357fd6a23187c2cd50a7b3b2b686ea54995e895ed0b9569bc969', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:52:54', '2026-11-23 03:52:54', NULL),
(17, 9, '60ebc989fbe4dd2258cb09a1528b7e66a99a1dd9f6203313b6fd94abf965ab8e', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:55:11', '2026-11-23 03:55:11', NULL),
(18, 1, '124021a309d0fe86b84e42a54ee434253db54211ed2297605bf0a547320a3d25', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:55:43', '2026-11-23 03:55:43', NULL),
(19, 9, 'e440d0b094727e28e692b835632992e8c48e2dd2038a726f1495758754528ce0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', '::1', '2026-11-22 19:56:36', '2026-11-23 03:56:36', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `branches`
--
ALTER TABLE `branches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_branch_manager` (`manager_user_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customer_reviews`
--
ALTER TABLE `customer_reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `review_token` (`review_token`),
  ADD KEY `idx_review_branch` (`branch_id`),
  ADD KEY `idx_review_employee` (`employee_id`),
  ADD KEY `idx_review_customer` (`customer_id`),
  ADD KEY `idx_customer_reviews_link` (`review_link_id`);

--
-- Indexes for table `customer_statuses`
--
ALTER TABLE `customer_statuses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `legacy_id` (`legacy_id`);

--
-- Indexes for table `review_links`
--
ALTER TABLE `review_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_hash` (`token_hash`),
  ADD KEY `idx_review_links_branch` (`branch_id`),
  ADD KEY `idx_review_links_customer` (`customer_id`),
  ADD KEY `idx_review_links_type` (`link_type`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sales_branch` (`branch`),
  ADD KEY `idx_sales_customer` (`customer_id`),
  ADD KEY `idx_sales_employee` (`employee_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `uq_users_employee_id` (`employee_id`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_hash` (`token_hash`),
  ADD KEY `idx_user_sessions_user` (`user_id`),
  ADD KEY `idx_user_sessions_expires` (`expires_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `branches`
--
ALTER TABLE `branches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `customer_reviews`
--
ALTER TABLE `customer_reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_statuses`
--
ALTER TABLE `customer_statuses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `review_links`
--
ALTER TABLE `review_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `customer_reviews`
--
ALTER TABLE `customer_reviews`
  ADD CONSTRAINT `fk_customer_reviews_link` FOREIGN KEY (`review_link_id`) REFERENCES `review_links` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
