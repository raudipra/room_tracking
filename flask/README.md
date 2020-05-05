#\[Cognixy\] Room Tracking

## How to Run (development)

1. Install required python dependencies using `pip install -e .`
2. Set environment variables `FLASK_APP=web` and `FLASK_ENV=development`
3. Run the development web server `flask run`

## Notes

- Default dev endpoint: 127.0.0.1:5000
- Program follows Flask project template, as defined in https://flask.palletsprojects.com/en/1.1.x/tutorial/layout/
  - project root: `web`
  - static files: `web/static`
  - files compiled from `client`: `web/static/dist` (will be ignored by git)
  - frontend: `web/templates`
