DROP TABLE IF EXISTS `zone_authorization`;
CREATE TABLE `zone_authorization` (
    `zone_id` INT NOT NULL,
    `person_Id` BIGINT NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    INDEX `index_zone_id` (`zone_id`) USING HASH,
    PRIMARY KEY (`zone_id`, `person_id`),
    FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`),
    FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`)
);