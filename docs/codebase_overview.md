# Vacation System Codebase Overview

This guide is aimed at newcomers who want to understand how the Vacation System project is organised and how the pieces fit together.

## High-level architecture

The project is a **React Native (Expo Router) front end** that talks to a **Flask API backed by MySQL**:

- The mobile client lets employees log in and submit vacation requests for upcoming days.
- The Flask service exposes REST endpoints for employee lookup and vacation request CRUD, persisting data to a MySQL database. Database bootstrap scripts ensure the schema and sample employees exist.

## Repository layout

| Path | Description |
| --- | --- |
| `app/` | Expo Router screens. `index.tsx` handles employee login, `_layout.tsx` registers the router stack, and `vacation.tsx` renders the calendar-style vacation picker and submission form.【F:app/index.tsx†L1-L102】【F:app/vacation.tsx†L1-L206】 |
| `components/` | Reusable UI building blocks (buttons, themed containers, etc.) generated from the Expo template. Useful when extracting shared visual pieces.【F:components/themed-view.tsx†L1-L63】 |
| `constants/config.ts` | Defines the API base URL (overridable through `EXPO_PUBLIC_API_URL`) and routes consumed by the front end.【F:constants/config.ts†L1-L8】 |
| `hooks/` | Theme-related hooks supplied by the Expo template.【F:hooks/use-theme-color.ts†L1-L40】 |
| `assets/` | Static resources (images, fonts). |
| `server/` | Flask application and helper scripts. `app.py` exposes API endpoints and applies database bootstrap logic when the service starts.【F:server/app.py†L1-L216】 |
| `order_db/` | MySQL connection helpers and schema seeding logic used by the Flask app. Running `python -m order_db.db_connection` recreates tables and seeds demo employees.【F:order_db/db_connection.py†L1-L108】 |
| `scripts/` | Utility scripts from the Expo template (`reset-project.js`). |
| `package.json` | Lists Expo dependencies and npm scripts for the front end.【F:package.json†L1-L36】 |
| `README.md` | Project-level setup instructions, prerequisites, and API overview.【F:README.md†L1-L107】 |

## Front-end flow

1. **Login (`app/index.tsx`)**
   - Builds a map of employee IDs (1–10) and default passwords.
   - Validates local input and, on success, navigates to the vacation screen with the selected `employeeId` in the router params.【F:app/index.tsx†L13-L54】

2. **Vacation scheduler (`app/vacation.tsx`)**
   - Calculates a rolling 30-day window in GMT+8 and disables dates that are either in the past or too close to the current week, enforcing scheduling rules.【F:app/vacation.tsx†L16-L112】【F:app/vacation.tsx†L200-L260】
   - Lets employees pick start/end times per date and submits the selection via `submitVacationRequest`, which POSTs to the Flask API.【F:app/vacation.tsx†L224-L307】
   - Displays server feedback and resets the selection after successful submission.【F:app/vacation.tsx†L249-L307】

## Back-end flow

- `server/app.py` registers endpoints for health checks, employee lookup, listing vacation requests, and creating or updating vacation entries. It applies CORS headers to allow the Expo app to communicate with it during development.【F:server/app.py†L40-L141】【F:server/app.py†L146-L216】
- `_bootstrap_database()` ensures tables exist and that sample employees are inserted when the server boots up.【F:server/app.py†L18-L34】
- Data access relies on helpers in `order_db/db_connection.py`, which create the `employees` and `vacation` tables (dropping the legacy `vacation_requests` table) and seed fixtures if empty.【F:order_db/db_connection.py†L17-L108】
- Database credentials come from environment variables parsed in `order_db/db.py` and default to local development-friendly values.【F:order_db/db.py†L1-L44】

## Key development tasks

- **Running the front end:** `npm install` then `npx expo start`. You can target iOS, Android, or web previews from the Expo CLI.【F:README.md†L23-L55】
- **Running the backend:** Create/activate a virtualenv in `server/`, install Flask and the MySQL connector, ensure the schema via `python -m order_db.db_connection`, then launch with `flask --app app run` (or use the provided PowerShell script on Windows).【F:README.md†L55-L86】【F:server/run_flask.ps1†L1-L25】
- **Environment variables:** Set `EXPO_PUBLIC_API_URL` to point the app at your running Flask server. Backend uses `MYSQL_*` variables to connect to MySQL and defaults to localhost.【F:README.md†L17-L22】【F:order_db/db.py†L1-L44】

## What to learn next

1. **API integration details** – Inspect or create a shared API helper (e.g., `lib/orderingApi.ts`) to centralise fetch logic and error handling. This keeps screen components lean and makes adding new endpoints easier.
2. **State management** – As the app grows (e.g., showing existing vacation requests), consider introducing a lightweight state store such as Zustand or Redux Toolkit.【F:README.md†L107-L112】
3. **Testing strategy** – Add unit tests for date/time rules on the front end and request validation logic on the backend. Automated tests will prevent regressions as scheduling rules evolve.【F:README.md†L107-L112】
4. **Backend validation & auth** – Expand login to call the backend instead of using hardcoded credentials, and add real authentication/authorization so the API can be safely exposed beyond development.【F:README.md†L103-L112】
5. **Deployment readiness** – Learn about running Flask with production servers (Gunicorn/Uvicorn), securing MySQL, and using services like ngrok or Expo Publish for remote previews.【F:README.md†L87-L102】

Refer back to this document whenever you need a refresher on where things live or what to explore next. Happy coding!
