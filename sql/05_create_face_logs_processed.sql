DROP TABLE IF EXISTS `face_logs_processed`;
CREATE TABLE `face_logs_processed` (
	`face_log_id` BIGINT NOT NULL,
	`state` VARCHAR(1) NOT NULL,
	`created_at` TIMESTAMP NOT NULL,
	`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`worker_id` VARCHAR(32) NOT NULL,
	PRIMARY KEY (`face_log_id`),
	FOREIGN KEY (`face_log_id`) REFERENCES `face_logs` (`id`)
);