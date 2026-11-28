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
cd widget && npm run build:local           # build widget.js into backend/widget_dist for local runs
cd widget && npm test                      # widget unit tests (Vitest, jsdom)
cd widget && npm run e2e                   # Playwright, 6 scenarios (needs frontend built); `-- 3 6` runs some
```

First-time setup is in `README.md`. There is no linter. The website has no test framework; the widget has Vitest and a Playwright end-to-end script.

## Architecture

One container. The `Dockerfile` builds the React app (`frontend/`) and the voice form widget (`widget/`, one IIFE script, no runtime dependencies) in Node stages, then copies them to `/app/static` and `/app/widget_dist/v1/widget.js` in a Python stage, where FastAPI (`backend/app/main.py`) serves `/api/*`, `/widget/v1/widget.js`, the practice portal at `/portal/` and the website on port 3000.

- Register API routes before the static mount at `/`, or the mount swallows them. The mount is skipped when `static/` is missing, as in local development and tests.
- `AI_PROVIDER=local` (testing only) sends the AI step to an OpenAI-compatible local model at `LOCAL_AI_URL` (Compose profile `local-ai`); speech still uses Sarvam. The live Sarvam chat API takes `reasoning_effort` low, medium or high only, and reasoning counts against `max_tokens`.
- `SARVAM_API_KEY` is read at runtime on the server only. Empty or the `.env.example` placeholder counts as not set. A new environment variable needs entries in both `docker-compose.yml` (with an empty default, no `env_file`) and `.env.example`.
- Voice form widget: form maps in `backend/app/content/forms/` (data only), widget lines in `content/lines/widget.{en,ta}.yaml` (same keys and placeholders, tested), routes in `backend/app/api/widget.py`, rule-based reply understanding in `backend/app/understand/` (AI fallback only when rules fail, and its values go back through the rules), the widget's Sarvam adapter in `backend/app/voice/widget_sarvam.py` (the journey uses `voice/sarvam.py`; folding them together is a follow-up). The sensitive-field detector exists twice (`contracts/forms.py`, `widget/src/dom/sensitive.ts`); keep them in step.
- The practice portal (`backend/app/portal/`) is treated like a third-party site: it knows Urimai only through the one script line.
- No validation of our own: form maps never encode a site's rules, and reply understanding only converts speech to values (digits, dates, options). The widget detects whatever the site reports (`widget/src/dom/errors.ts`) and relays it; keep it that way.

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
