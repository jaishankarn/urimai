# Starter app and Docker setup: design

Status: approved on 2026-11-27

## Intent

Round 2 entries must start with Docker Compose, with no keys, and show the app on the published port. An entry that does not start cannot advance. So we get that working first, with a nearly empty app, and keep it working while we add features.

## Goals

- `docker compose up --build` starts the app on a fresh clone with no `.env` file and no keys.
- `http://localhost:3000` shows Urimai's main screen.

## Not in this step

Voice, AI, scheme rules, saved progress and the four-section navigation. Product scope for Round 2 is not decided yet.

## Would count as failure

- It runs only on our machines, for example because of a local `.env`, installed packages or a locally built frontend.
- A missing key stops startup or leaves the screen blank.

## Approaches

Stack (team choice: **B**):

| Option | Trade-off |
|---|---|
| A. Next.js + TypeScript | One language and project |
| **B. React + FastAPI** | Python backend; two languages and more Docker setup |

Container layout:

| Option | Trade-off |
|---|---|
| **One container: FastAPI serves the built React files and the API (chosen)** | One port, no CORS, no proxy. Frontend changes need a rebuild in Docker. |
| Two containers: nginx for React, FastAPI behind a proxy | More configuration, and a mistake can show the default nginx page, which fails the rules |

## Design

- `frontend/`: Vite, React, TypeScript, Tailwind. Commit the npm lockfile.
- `backend/`: FastAPI run by Uvicorn. Pin versions in `requirements.txt`.
- `Dockerfile`, two stages: a Node stage builds the frontend; a Python stage installs the backend and copies in the built files.
- `docker-compose.yml`: one service, `ports: "3000:3000"`, Uvicorn listening on `0.0.0.0:3000`. It passes the key as `SARVAM_API_KEY: ${SARVAM_API_KEY:-}` and has no `env_file`, so a missing `.env` is fine and an existing one is still read. The key is used only at runtime, never at build time.
- `.env.example`: a placeholder for `SARVAM_API_KEY`. The backend treats the placeholder as not set.
- `.dockerignore` excludes `.env`, `node_modules`, build output and Python caches. Add Python caches and virtual environments to `.gitignore`.
- `GET /api/health` returns the app status and whether the Sarvam key is set, never the key itself.
- Main screen, mobile-first: name, tagline, a choice of Tamil, Hindi, Telugu or English, and a large microphone button marked as not working yet. If no key is set, show "Sarvam key not set". The screen still appears if the health request fails.
- Local development: run the Vite dev server with `/api` forwarded to Uvicorn.
- `README.md`: how to run with Docker and for local development.

## How we check it

1. Clone the committed code into an empty folder, with no `.env` and no `SARVAM_API_KEY` in the shell.
2. Run `docker compose build --no-cache`, then `docker compose up`.
3. `http://localhost:3000` shows the main screen with the key notice.
4. `/api/health` reports that the key is not set.
5. One small backend test covers the health response with no key, the placeholder and a set value.

After pushing, repeat from a fresh clone of the GitHub repo.

## Left to the builder

File layout inside `frontend/` and `backend/`, styling and exact package versions.
