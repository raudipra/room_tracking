DROP TABLE IF EXISTS `zone_alerts`;
CREATE TABLE `zone_alerts` (
	`id` VARCHAR(36) NOT NULL,
	`zone_id` INT NOT NULL,
	`type` VARCHAR(1) NOT NULL,
	`created_at` TIMESTAMP NOT NULL,
	`person_id` BIGINT NOT NULL,
	`is_known` TINYINT(1) NOT NULL,
	`worker_id` VARCHAR(32) NOT NULL,
	PRIMARY KEY (`id`),
    INDEX `idx_zone_id` (`zone_id`) USING HASH,
	INDEX `idx_created_at` (`created_at` DESC) USING BTREE,
	FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`)
);