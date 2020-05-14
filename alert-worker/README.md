# Room Tracking (alert-worker)

Alert Generator and Location Updater module for room tracking, built using NodeJS

## Requirements

- NodeJS v12 (or latest LTS version, check [here](https://nodejs.org/en/about/releases/))
- MySQL (tested with version 5.7)

## Setup & Run

1. Run `npm install` to fetch all required packages.
2. Set the database connection using `.env`. An example has been provided in `.env.example`. NOTE: You can also set the variables from the Environment Variable of your OS.
3. Make sure you have run the migrations at the `sql` folder of this project.
4. Run `npm run dev`. This will run the worker using a dev runtime that will show debug-related output to the console.
5. If required, run `npm run mock-generator` to generate mock data to the `face_logs` table.
6. For production, run `npm run start` to run the production build.

## Project Structure

1. `main.js` is the main entry point of the app.
2. `alert-generator.js` contains code responsible for generating the alerts.
3. `location-update.js` contains code responsible for updating the location of each detected person.
4. `utils` folder contains various utilities:
  1. `db.js` contains database entry point used by the app and database-related functions
  2. `date-time.js` contains date-time related functions
  3. `logger.js` contains the logger
5. `mock-log-generator.js` contains code for generating mock data to the `face_logs` table.

## Dev Notes

1. The `AlertGenerator` is set to run on one of these two conditions:
  1. The interval at `main.js` is reached.
  2. A `finish` event is captured from `LocationUpdater`
2. `AlertGenerator` currently causes spikes in the CPU usage of the database. This is likely due to either of the following causes:
  1. The amount of queries it generates for backoff feature (every time an alert condition is fulfilled, 1 query will be generated to check if the previous alert exists within the backoff period).
  2. The amount of queries executed whenever an alert is generated (1 `INSERT` query/alert).
3. The `mock-log-generator` requires `faker.js`, which will be installed only if the `--no-dev` flag of `npm install` is *NOT* specified

## Additional References

- [Promise in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [Bluebird.js](http://bluebirdjs.com/docs/getting-started.html)
- [NodeJS Events](https://nodejs.org/docs/latest-v12.x/api/events.html)
- [node-mysql2](https://github.com/sidorares/node-mysql2/tree/master/documentation)