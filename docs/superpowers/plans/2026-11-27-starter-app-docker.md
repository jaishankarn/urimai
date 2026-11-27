# Starter App and Docker Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docker compose up --build` shows Urimai's main screen at `http://localhost:3000` on a fresh clone with no `.env` and no keys.

**Architecture:** One container. A Node build stage compiles the React app; a Python stage runs FastAPI under Uvicorn, which serves `/api/*` and the built files on port 3000.

**Tech Stack:** React 19.3.1, Vite 8.4.0, TypeScript 7.0.2, Tailwind 4.3.5, FastAPI 0.165.0, Uvicorn 0.54.0, Python 3.11, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-27-starter-app-docker-design.md`

## Global Constraints

- The app starts with no `.env` file and no secret keys. `docker-compose.yml` has no `env_file`.
- `docker-compose.yml` has one service with `ports: "3000:3000"`; Uvicorn listens on `0.0.0.0:3000`.
- The key is read only at runtime, never at build time, never sent to the browser, never in the image.
- Placeholder in `.env.example`, treated as not set: `SARVAM_API_KEY=your_sarvam_key_here`.
- Missing-key notice, exact text: `Sarvam key not set`.
- Out of scope: voice, AI, scheme rules, saved progress, four-section navigation, translated UI text.
- Exact versions in `requirements*.txt` and `package.json` (no `^` or `~`). Commit `package-lock.json`.
- Work on branch `feat/starter-app`. Commits are local and need the user's OK. Never push or merge without asking. Stage only the listed files: `docs/` and `CLAUDE.md` stay uncommitted unless the user says otherwise. End commit messages with the attribution line given in the session.

## Review Focus

1. We build on arm64; graders probably run amd64. The image must also build for `linux/amd64` (Task 3, Step 5).
2. `.env.example` copied to `.env` unchanged, or a key that is empty or only spaces, counts as not set (Task 1 test; Task 3, Step 6).
3. A real key value never appears in an API response (Task 1 test).
4. If the health request fails or returns an error, the main screen still renders and says `Cannot reach the Urimai server` (Task 2, Step 4).
5. At 360px width there is no horizontal scroll and all four language names are readable (Task 2, Step 4).

## File Structure

| Path | Responsibility |
|---|---|
| `backend/app/__init__.py` | Empty package marker |
| `backend/app/main.py` | App factory, health route, static file serving |
| `backend/tests/test_main.py` | Backend tests |
| `backend/requirements.txt`, `requirements-dev.txt`, `pytest.ini` | Pinned dependencies and test config |
| `frontend/index.html`, `package.json`, `vite.config.ts`, `tsconfig.json` | Build setup |
| `frontend/src/main.tsx`, `App.tsx`, `index.css`, `vite-env.d.ts` | Main screen |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example` | Container setup |
| `.gitignore`, `README.md`, `CLAUDE.md` | Ignores and instructions |

---

### Task 1: Backend

**Files:**
- Create: `backend/app/__init__.py`, `backend/app/main.py`, `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/pytest.ini`
- Test: `backend/tests/test_main.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `create_app(static_dir: Path = STATIC_DIR) -> FastAPI` and module-level `app = create_app()` in `app.main`. `STATIC_DIR` is `backend/static` locally and `/app/static` in the image (the `static` folder beside the `app` package).
- Produces: `GET /api/health` returns `{"status": "ok", "sarvam_configured": bool}`.

- [ ] **Step 1: Create the branch and setup files**

Run `git switch -c feat/starter-app`.

- `requirements.txt`: `fastapi==0.165.0`, `uvicorn==0.54.0`
- `requirements-dev.txt`: `-r requirements.txt`, `pytest==9.2.0`, `httpx2==2.16.2`
- `pytest.ini`: `pythonpath = .` and `testpaths = tests`
- Append to `.gitignore`: `__pycache__/`, `*.pyc`, `.venv/`, `.pytest_cache/`

Run: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`
Expected: installs without errors.

- [ ] **Step 2: Write the failing tests**

```python
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.mark.parametrize(
    "value, configured",
    [(None, False), ("", False), ("   ", False), ("your_sarvam_key_here", False), ("test-secret-123", True)],
)
def test_health_reports_key_without_leaking_it(monkeypatch, tmp_path, value, configured):
    if value is None:
        monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    else:
        monkeypatch.setenv("SARVAM_API_KEY", value)
    response = TestClient(create_app(tmp_path / "missing")).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "sarvam_configured": configured}
    assert "test-secret-123" not in response.text


def test_serves_built_frontend_beside_api(tmp_path):
    (tmp_path / "index.html").write_text("<title>Urimai</title>")
    client = TestClient(create_app(tmp_path))
    assert "<title>Urimai</title>" in client.get("/").text
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/unknown").status_code == 404
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && .venv/bin/pytest -v`
Expected: FAIL, cannot import `app.main`.

- [ ] **Step 4: Implement `backend/app/main.py`**

Read the key from the environment on each request. Register the API route first, then mount `StaticFiles(directory=static_dir, html=True)` at `/` only if the folder exists, so the backend also runs before the frontend is built.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && .venv/bin/pytest -v`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add .gitignore backend/app backend/tests backend/requirements.txt backend/requirements-dev.txt backend/pytest.ini
git commit -m "feat: add FastAPI backend with health check"
```

---

### Task 2: Main screen

**Files:**
- Create: `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/vite-env.d.ts`

**Interfaces:**
- Consumes: `GET /api/health` from Task 1.
- Produces: `npm run build` writes `frontend/dist/`.

There is no frontend test framework in this step. The type check, the build and a browser check verify it.

- [ ] **Step 1: Write the build setup**

- Dependencies: `react@19.3.1`, `react-dom@19.3.1`.
- Dev dependencies: `vite@8.4.0`, `@vitejs/plugin-react@6.3.0`, `typescript@7.0.2`, `tailwindcss@4.3.5`, `@tailwindcss/vite@4.3.5`, `@types/react@19.3.3`, `@types/react-dom@19.3.0`.
- `"type": "module"`; scripts `dev`: `vite`, `build`: `tsc --noEmit && vite build`.
- `vite.config.ts`: React and Tailwind plugins; `server.proxy` sends `/api` to `http://localhost:8000`.
- `tsconfig.json`: strict, `jsx: react-jsx`, `moduleResolution: bundler`, includes `src`.
- `vite-env.d.ts`: reference `vite/client`.
- `index.css`: `@import "tailwindcss";`
- `index.html`: title `Urimai`, viewport meta, `<div id="root">`.

Run: `cd frontend && npm install`
Expected: installs and creates `package-lock.json`.

- [ ] **Step 2: Write `App.tsx` (default export `App`) and `main.tsx`**

One mobile-first column, large text, tap targets at least 48px high:

- Name `Urimai`, tagline `Your Voice. Your Rights. Your Benefits.`
- Four language buttons: `தமிழ்`, `हिन्दी`, `తెలుగు`, `English`, each with its `lang` attribute (`ta`, `hi`, `te`, `en`). The choice lives in component state, shown with `aria-pressed` and a visible style. English is selected at first. It translates nothing yet.
- A large disabled microphone button with the visible text `Voice is not working yet`.
- On load, fetch `/api/health`. If `sarvam_configured` is false, show `Sarvam key not set`. If the request fails, returns a non-2xx status or is not valid JSON, show `Cannot reach the Urimai server`. Nothing else on the screen waits for this request.

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: no type errors; `dist/index.html` exists.

- [ ] **Step 4: Check in a browser**

Start `npm run dev` with no backend on port 8000, and open the URL Vite prints at 360px width.
Expected: the whole screen renders with `Cannot reach the Urimai server`; no horizontal scroll; tapping a language moves the selection.

Then run `cd backend && env -u SARVAM_API_KEY .venv/bin/uvicorn app.main:app --port 8000` and reload.
Expected: the notice reads `Sarvam key not set`. Stop both servers.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/src
git commit -m "feat: add mobile-first main screen"
```

---

### Task 3: Docker setup and clean-clone check

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `app.main:app` and `STATIC_DIR` from Task 1; `npm run build` from Task 2.

- [ ] **Step 1: Write the container files**

`Dockerfile`:
- Stage `web`, from `node:24-slim`: copy `package.json` and `package-lock.json`, `npm ci`, copy `frontend/`, `npm run build`.
- Final stage, from `python:3.11-slim`, workdir `/app`: install `backend/requirements.txt` with `--no-cache-dir`, copy `backend/app` to `./app` and the `web` stage's `dist` to `./static`, switch to user `nobody`, expose 3000, run `uvicorn app.main:app --host 0.0.0.0 --port 3000`.
- No `ARG` or `ENV` for the key.

`docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      SARVAM_API_KEY: ${SARVAM_API_KEY:-}
```

`.dockerignore`: `.git`, `docs`, `**/.env`, `**/.env.*`, `**/node_modules`, `**/dist`, `**/__pycache__`, `**/.venv`, `**/.pytest_cache`.

`.env.example`: a one-line comment saying the key is optional, then `SARVAM_API_KEY=your_sarvam_key_here`.

- [ ] **Step 2: Update `README.md` and `CLAUDE.md`**

`README.md`: keep the name and tagline; add running with Docker (`docker compose up --build`, then `http://localhost:3000`), the optional key, and local development (backend venv and Uvicorn on port 8000, `npm run dev`, tests).

`CLAUDE.md`: replace the "Current state" section with the commands (Docker run, `cd backend && .venv/bin/pytest`, one test with `.venv/bin/pytest tests/test_main.py::test_serves_built_frontend_beside_api`, `npm run build`, `npm run dev`; no linter is set up) and the one-container architecture. It stays uncommitted.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore .env.example README.md
git commit -m "feat: add Docker setup"
```

- [ ] **Step 4: Check a clean clone**

First run `lsof -nP -iTCP:3000 -sTCP:LISTEN`. If anything is listening, ask the user to stop it. Do not kill it or change the port in the compose file.
Clone this repo into a new empty folder in the scratchpad. From that clone:

```bash
env -u SARVAM_API_KEY docker compose -p urimai-clean build --no-cache
env -u SARVAM_API_KEY docker compose -p urimai-clean up -d
curl -sf http://localhost:3000/
curl -sf http://localhost:3000/api/health
```

Expected: the first `curl` returns HTML with `<title>Urimai</title>`; the second returns `{"status":"ok","sarvam_configured":false}`. In a browser at 360px, `http://localhost:3000` shows the main screen with `Sarvam key not set`, with no console errors (a missing favicon is not a failure).

- [ ] **Step 5: Check the amd64 build**

Run, from the clone: `docker build --platform linux/amd64 --no-cache -t urimai-amd64 .`
Expected: succeeds. If it fails on a missing native package for Vite or Tailwind, fix the lockfile, commit and repeat Step 4.

- [ ] **Step 6: Check the copied example file and image contents**

Run, from the clone: `cp .env.example .env && env -u SARVAM_API_KEY docker compose -p urimai-clean up -d --force-recreate`, then `curl -sf http://localhost:3000/api/health`.
Expected: `sarvam_configured` is `false`.

Run: `docker compose -p urimai-clean exec app sh -c 'ls -A /app'`
Expected: `app` and `static` only, with no `.env`.

Finish with `docker compose -p urimai-clean down`.

## After this plan

Ask before merging into `main` and pushing. Graders see the default branch. After pushing, repeat Step 4 from a fresh clone of `https://github.com/jaishankarn/urimai.git`.
