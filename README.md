# Room Tracking

App for displaying data from tracker in rooms.

## Structure

This project is structured to three parts:

1. `client` contains code for the web client.
2. `server` contains code for the API that is going to be consumed by the client.
3. `alert-worker` contains code for generating alerts based on the feed received from XYZ. this is intended to be a background worker.
4. `sql` contains code for related database schemas.
5. `dummy` and `mockup` contains design/prototype artifacts (images, dummy SQL, dummy worker, etc.).

Please see the respective `README.md` in each folder for details how to deploy/run each part of the application.