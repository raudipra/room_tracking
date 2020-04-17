DROP TABLE IF EXISTS `zone_persons`;
CREATE TABLE `zone_persons` (
	`zone_id` INT NOT NULL,
	`person_id` INT NOT NULL,
	`is_known` TINYINT(1) NOT NULL,
	`from` TIMESTAMP NOT NULL,
	`to` TIMESTAMP NULL,
	`created_at` TIMESTAMP NOT NULL,
	`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `worker_created_at` VARCHAR(32) NOT NULL,
    `worker_updated_at` VARCHAR(32) NULL,
    PRIMARY KEY (`zone_id`, `person_id`, `is_known`, `from`),
	INDEX `idx_from` (`from`) USING BTREE,
	INDEX `idx_to` (`to`) USING BTREE,
	FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`)
);