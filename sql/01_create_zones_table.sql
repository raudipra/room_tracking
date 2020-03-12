DROP TABLE IF EXISTS `zones`;
CREATE TABLE `zones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NOT NULL DEFAULT '',
    `config` JSON NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- NOTE: this assumes that the table is EMPTY. if the table already has some data,
-- consider migrating them first.

ALTER TABLE `cameras` DROP COLUMN `zone_name`;
ALTER TABLE `cameras` ADD COLUMN `zone_id` INT NOT NULL DEFAULT 1;
ALTER TABLE `cameras` ADD CONSTRAINT `fk_zone_id` FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`);