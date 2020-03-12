DROP TABLE IF EXISTS `cameras`;
CREATE TABLE `cameras` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `creation_time` datetime DEFAULT NULL,
  `face_detect_threshold` varchar(255) DEFAULT NULL,
  `face_min_quality` varchar(255) DEFAULT NULL,
  `face_min_size` varchar(255) DEFAULT NULL,
  `fps` int(11) DEFAULT NULL,
  `running` bit(1) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `number_of_faces` int(11) DEFAULT NULL,
  `resolution` varchar(255) DEFAULT NULL,
  `server_name` varchar(255) DEFAULT NULL,
  `threshold` int(11) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `viewport_bottom` varchar(255) DEFAULT NULL,
  `viewport_left` varchar(255) DEFAULT NULL,
  `viewport_right` varchar(255) DEFAULT NULL,
  `viewport_top` varchar(255) DEFAULT NULL,
  `zone_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `face_logs`
--

DROP TABLE IF EXISTS `face_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `face_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `creation_time` datetime DEFAULT NULL,
  `age` bigint(20) DEFAULT NULL,
  `calibratedScore` float DEFAULT NULL,
  `camera_name` varchar(64) NOT NULL,
  `data` longblob,
  `gender` varchar(255) DEFAULT NULL,
  `image` longblob,
  `out_time` datetime DEFAULT NULL,
  `score` float DEFAULT NULL,
  `unknown_person_id` bigint(20) DEFAULT NULL,
  `zone_name` varchar(64) NOT NULL,
  `person` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `unPerson_index` (`unknown_person_id`),
  KEY `FK_iv6bqe6f2xtoe9wwynd1xh2s` (`person`)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS `persons`;
CREATE TABLE `persons` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `creation_time` datetime DEFAULT NULL,
  `code` varchar(32) NOT NULL,
  `enabled` bit(1) DEFAULT NULL,
  `gender` int(11) DEFAULT NULL,
  `name` varchar(64) NOT NULL,
  `portrait` longblob,
  `app` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_degx2qccraqjhrov52g8ggp8a` (`app`,`code`),
  FULLTEXT KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT;