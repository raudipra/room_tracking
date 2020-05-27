UPDATE zone_alerts
SET `details` = JSON_SET(`details`, '$.from', 
	DATE_FORMAT(
	 	CONVERT_TZ(str_to_date(JSON_UNQUOTE(`details`->'$.from'), '%Y-%m-%dT%H:%i:%s.%f+07:00'), "+07:00", "SYSTEM"),
		'%Y-%m-%d %T'
	)
);

ALTER TABLE `zone_alerts`
ADD COLUMN `alert_from_virtual` TIMESTAMP
GENERATED ALWAYS AS 
(COALESCE(STR_TO_DATE(JSON_UNQUOTE(`details`->'$.from'), '%Y-%m-%d %T'), NULL))
STORED;