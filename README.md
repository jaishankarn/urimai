# urimai
URIMAI - Your Voice. Your Rights. Your Benefits.

A multilingual, voice-first companion that helps people in India find government benefits and apply for them.

This is a prototype for one journey: a widow asking what help she may get, in Tamil or English.

- **With a Sarvam key:** she tells her story by voice, Urimai shows what it understood, asks only the follow-up questions that can change a result, and speaks up to three suggestions.
- **Without a key:** the same questions are answered by tapping.

Eligibility is decided by rules a person has reviewed (`backend/app/content/schemes/`), never by AI. The AI only suggests details from what she says, which she confirms. Nothing here guarantees eligibility or approval. The rules are not checked against government orders. Tamil wording needs a native check. Search and saved progress are not part of this version.

It also has the **voice form widget**: a small script an application website adds with one line. It fills the form by voice while the person confirms each value. The person types Aadhaar and captcha, uploads documents and presses Submit. To show it, the app includes a **practice portal** at `/portal/`, a demo pension form clearly marked "not a government site".

Design: [docs/architecture.md](docs/architecture.md). Widget plan: [docs/voice-form-widget-plan.md](docs/voice-form-widget-plan.md).

## Run with Docker

```bash
docker compose up --build
```

Then open http://localhost:3000. No `.env` file or API key is needed.

- Practice portal: http://localhost:3000/portal/ (tap "Fill by voice")
- The widget with the sample widow's confirmed answers, as if handed over from Urimai: http://localhost:3000/api/demo/handoff?form_id=demo-destitute-widow-pension&lang=ta (`lang=en` for English)
- From the website: answer the questions, then press "Fill the application with Urimai" on a result.

To check a key works (one chat call; the SDK is a development dependency only):

```bash
cd backend
set -a; . ../.env; set +a
.venv/bin/python -m scripts.sarvam_hello
```

**Saving Sarvam credits while testing.** Set `AI_PROVIDER=local` to send the AI step (replies the built-in rules cannot parse, and names in English letters) to a small local model (Qwen2.5 1.5B) instead of Sarvam. Its quality is much lower, so use it to exercise the flow, not to judge understanding. Listening and speaking still use Sarvam. With Docker:

```bash
AI_PROVIDER=local docker compose --profile local-ai up --build
```

The first start downloads the model (about 1.1 GB). For local development, run any OpenAI-compatible server on port 8080 (for example `python -m llama_cpp.server --model <file>.gguf --port 8080`) and set `AI_PROVIDER=local` in your shell.

Without a key the widget works by tapping and typing and says voice is not set up. With a key it listens (Sarvam Saaras), speaks (Bulbul), and understands replies it cannot parse with its own rules (Sarvam-105B).

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

Widget (needed for the practice portal; builds `widget.js` and copies it where the backend serves it):

```bash
cd widget
npm ci
npm run build:local
```

Open the URL that Vite prints. It forwards `/api`, `/portal` and `/widget` requests to the backend on port 8001. The local backend does not read `.env`; set `SARVAM_API_KEY` in your shell if you need it.

## Tests

```bash
(cd backend && .venv/bin/pytest)
(cd frontend && npm run build)   # type check and build
(cd widget && npm test)           # widget unit tests
(cd widget && npm run e2e)        # 6 browser scenarios: English and Tamil, tap/type and voice, website start, unknown site checks
(cd widget && npm run e2e -- 3 6) # only some scenarios
```

The end-to-end tests need `backend/.venv`, Playwright's Chromium, and the website built (`cd frontend && npm run build`). They need no Sarvam key: the voice scenario uses Chromium's fake microphone and a stand-in for Sarvam.


