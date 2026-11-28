# Voice story demo: short design and plan

Approved on 2026-11-28 ("go with A"): AI only turns replies into suggested facts; our code leads the conversation.

## Flow

1. She picks Tamil or English, reads that her voice and replies go to Sarvam, and taps to talk.
2. Saved greeting. She tells her story. Transcript and understood details are shown; she confirms or says it again.
3. Code asks only questions that can still change a result, one at a time, by voice and on screen, with tap and typed backup.
4. She checks every answer (existing confirm screen). Only then do the rules run.
5. Up to three suggestion groups, shown and spoken: widow pensions (state and national together), welfare board death benefit, family benefit. Other matches stay visible. No benefit is called the best.

## Rules

- Nothing the chat model writes is shown or spoken. Spoken text is saved lines plus reviewed rule text.
- From the opening story only `lives_in_tn`, `age`, `widowed`, `husband_work`, `death_cause` are accepted.
- Every extracted fact needs a quote found in the transcript, and a value `Facts` accepts. A reply to a question fills only that question.
- Unclear or failed understanding changes nothing; the question stays with its buttons.
- Audio and conversation text are not stored or logged by the app.
- No key: voice routes answer "Sarvam key not set"; tapping works as before.
- Paid routes have size limits and a shared per-minute limit. Text-to-speech says only the app's own lines (saved lines, question read-backs and suggestion text it has written); anything else is refused.
- A spoken follow-up answer is read back before the next question. Quotes must match whole words.
- Back goes to the previous question; after a change from the confirm screen, only newly relevant questions are asked.

## Approaches

| | Trade-off |
|---|---|
| **A. AI understands replies, code leads (chosen)** | Predictable and testable; less free-flowing |
| B. AI leads the conversation | More natural; may invent guidance |

## Parts

| Path | Does |
|---|---|
| `backend/app/voice/sarvam.py` | The only code that calls Sarvam: `transcribe`, `speak`, `chat_json`. Shared with the form widget |
| `backend/app/brain/extract.py` | `extract(chat, said, question) -> Understood{facts, dont_know}` |
| `backend/app/brain/questions.py` | `next_question(schemes, questions, facts, skipped) -> str \| None` |
| `backend/app/brain/suggest.py` | `suggest(results, ui, lang) -> {suggestions, others, speech}` |
| `backend/app/api/voice.py` | `POST /api/voice/stt?lang=` (raw audio body, 5 MB), `POST /api/voice/tts` `{lang,text}` → WAV |
| `backend/app/api/conversation.py` | `POST /api/conversation/{understand,next,suggest}` |
| `frontend/src/journey/Talk.tsx`, `voice.ts` | Voice screen, recording and playback |

Models: `saaras:v4` (codemix), `bulbul:v3`, `sarvam-105b-conversations` (temperature 0, JSON reply). SDK `sarvamai==0.1.50`.

## Tasks

1. Voice and extraction, tests with a fake Sarvam.
2. Next question, suggestions, saved lines; test the demo story (six follow-ups).
3. Voice screen.
4. Docker and browser checks, including browser-recorded audio.
5. User tests a real voice; fix.

## Left out

Semantic search, Postgres, Hindi and Telugu, interrupting speech, hands-free turns, documents by voice, form filling.

## Measured before building (made-up text, computer-generated voice)

Speech out and in worked for Tamil and English (`.wav`, `.m4a`). Plain extraction invented "main earner". With the quote check, story allowlist and JSON reply: 33 of 36 exact (12 examples, 3 runs; the prompt was adjusted on them, so expect lower with real speech). The larger model scored 27.
