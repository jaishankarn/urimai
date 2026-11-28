# urimai
URIMAI - Your Voice. Your Rights. Your Benefits.

A multilingual, voice-first companion that helps people in India find government benefits and apply for them.

This is a prototype for one journey: a widow asking what help she may get, in Tamil or English.

- **With a Sarvam key:** she tells her story by voice, Urimai shows what it understood, asks only the follow-up questions that can change a result, and speaks up to three suggestions.
- **Without a key:** the same questions are answered by tapping.

Eligibility is decided by rules a person has reviewed (`backend/app/content/schemes/`), never by AI. The AI only suggests details from what she says, which she confirms. Nothing here guarantees eligibility or approval. The rules are not checked against government orders. Tamil wording needs a native check. Search, form filling and saved progress are not part of this version.

## Run with Docker

```bash
docker compose up --build
```

Then open http://localhost:3000. No `.env` file or API key is needed.

### Optional key

To use voice, copy `.env.example` to `.env` and replace the placeholder with a Sarvam key. Never commit `.env`. With a key, voice recordings and typed replies are sent to Sarvam. Without a key, the app shows "Sarvam key not set". The microphone works on `localhost` or over HTTPS.

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
npm ci
npm run dev
```

Open the URL that Vite prints. It forwards `/api` requests to the backend on port 8001. The local backend does not read `.env`; set `SARVAM_API_KEY` in your shell if you need it.

## Tests

```bash
(cd backend && .venv/bin/pytest)
(cd frontend && npm run build)   # type check and build
```
