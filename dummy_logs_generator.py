import random 
import pymysql
from datetime import datetime

def get_camera(db):
    # prepare a cursor object using cursor() method
    cursor = db.cursor()
    sql = "SELECT name, zone_name FROM cameras"
    cursor.execute(sql)

    cameras = cur.fetchall()
    idx = random.randint(0, len(cameras)-1)

    return cameras[idx][0], cameras[idx][1]

def get_person(db):
    # prepare a cursor object using cursor() method
    cursor = db.cursor()
    sql = "SELECT id, portrait FROM persons"
    cursor.execute(sql)

    persons = cur.fetchall()

    # 1 means known, 0 unknown
    if random.randint(0, 1):
        idx = random.randint(0, len(persons)-2)
        return 0, persons[idx][0], persons[idx][1]
    else:
        # Unknown use portrait from biggest person id
        return persons[-1][0], 'NULL', persons[-1][1]

host = 'localhost'
username = 'root'
password = ''

# Open database connection
db = pymysql.connect(host, username, password, "roomTrackingDB" )

# prepare a cursor object using cursor() method
cursor = db.cursor()

while True:
    sleep_duration = random.randint(0, 10) 
    time.sleep(sleep_duration)

    current_timestamp = int(time.time())

    datetime_timestamp = datetime.fromtimestamp(current_timestamp)
    
    camera_name, camera_zone = get_camera(db)

    unknown_person_id, person_id, portrait = get_person(db)

    insertion_query = """
    INSERT INTO roomTrackingDB.cameras 
        (creation_time, age, calibratedScore, camera_name, data, gender, image, out_time, score, unknown_person_id, zone_name, person)
    VALUES 
        ({}, NULL, 0, {}, {}, NULL, 'x', '', 0.5, {}, {}, {})
    """.format(datetime_timestamp, camera_name, portrait, unknown_person_id, camera_zone, person_id)
    
    cursor.execute(insertion_query)
    
    db.commit()

    print(cursor.rowcount, "record inserted.")

# disconnect from server
db.close()