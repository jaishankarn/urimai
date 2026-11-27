# urimai
URIMAI - Your Voice. Your Rights. Your Benefits.

A multilingual, voice-first companion that helps people in India find government benefits and apply for them.

This is an early starter: the main screen runs, but voice and benefit discovery are not built yet.

## Run with Docker

```bash
docker compose up --build
```

Then open http://localhost:3000. No `.env` file or API key is needed.

### Optional key

To set a Sarvam key, copy `.env.example` to `.env` and replace the placeholder. Never commit `.env`. Without a key, the app shows "Sarvam key not set".

## Local development

You need Python 3.11 or later and Node 22.12 or later. Run the backend and frontend in two terminals.

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8001
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the URL that Vite prints. It forwards `/api` requests to the backend on port 8001. The local backend does not read `.env`; set `SARVAM_API_KEY` in your shell if you need it.

## Tests

```bash
cd backend && .venv/bin/pytest
cd frontend && npm run build   # type check and build
```
