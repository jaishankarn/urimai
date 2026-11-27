# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

URIMAI ("Your Voice. Your Rights. Your Benefits.") is a multilingual, voice-first companion that helps elderly people, widows and low-income families in India discover government welfare schemes and complete applications through conversation. It is an entry in a hackathon run by Scalar and Wispr Flow. Round 1 is cleared, and the current work is Round 2.

## Commands

```bash
docker compose up --build                  # whole app at http://localhost:3000
cd backend && .venv/bin/pytest             # backend tests
cd backend && .venv/bin/pytest tests/test_main.py::test_serves_built_frontend_beside_api   # one test
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8001   # backend dev server
cd frontend && npm run dev                 # Vite dev server, forwards /api to port 8001
cd frontend && npm run build               # type check and build
```

First-time setup is in `README.md`. There is no linter or frontend test framework.

## Architecture

One container. The `Dockerfile` builds the React app (`frontend/`, Vite, TypeScript, Tailwind) in a Node stage, then copies it to `/app/static` in a Python stage, where FastAPI (`backend/app/main.py`) serves both `/api/*` and those files on port 3000.

- Register API routes before the static mount at `/`, or the mount swallows them. The mount is skipped when `static/` is missing, as in local development and tests.
- `SARVAM_API_KEY` is read at runtime on the server only. Empty or the `.env.example` placeholder counts as not set. A new environment variable needs entries in both `docker-compose.yml` (with an empty default, no `env_file`) and `.env.example`.
- The current app is a starter: the main screen, a language choice that translates nothing yet, and a disabled microphone button.

## Round 1 documents (`docs/`)

- `idea.md`: problem and product pitch.
- `prompt.md`: prototype spec (user journey, voice failure handling, data requirements). It has not been agreed as the Round 2 scope; confirm scope before building from it.
- `impact.md`: beneficiaries, pilot targets (not results) and main risk.

## Round 2 rules

One submission only, due 30 Nov 2026, 11:59 pm (time zone not stated). The target is a working prototype; the full product is built at the finale.

Deliverables: public GitHub repo, YouTube demo (public or unlisted, 3 minutes or less), pitch deck PDF, and an optional self-hosted live link (small bonus).

The code must meet all of these. If the app does not start, the entry cannot advance:

- A `docker-compose.yml` starts the app with one command.
- The port published in `docker-compose.yml` shows the app itself, not a default server page.
- The app starts and shows its main screen with no secret keys. Graders add none. A feature that needs a key may show a "key not set" message.
- The app starts without a `.env` file, so Compose must not require one. If the app uses environment variables, commit `.env.example` with placeholder values.
- At least about 300 lines of original code written during the hackathon. A lightly changed starter template does not pass.

Reviewers read the pitch deck's text, not its pictures. It must cover: problem and solution; target users and how many there could be; dependencies (voice tools, AI models, services) and what happens if they get costly or stop working; launch plan for first users and growth.

## Product constraints (from `docs/`)

- Eligibility comes from structured rules built on verified official sources, each with a last-verified date. AI interprets conversation and explains results; it does not invent criteria.
- Never guarantee eligibility or approval, and disclose missing or outdated information.
- Never claim submission, document verification or status tracking without a real integration. Keep user-reported progress distinct from verified government status.
- Never silently change or assume critical details such as age, income or location.
- Do not request Aadhaar numbers, OTPs or bank credentials for benefit discovery. Saving personal data needs consent, and users can delete it.
- Wispr Flow is a tool for the builders, not the app's speech engine. The app uses separate speech-to-text and text-to-speech services.
