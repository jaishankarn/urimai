# Urimai: How It Works

**Your Voice. Your Rights. Your Benefits.**

Urimai is a voice-first website that helps people in India find the government benefits they may qualify for, prepare for them, and apply. The user talks in their own language (Tamil first). Urimai finds the right schemes, explains the documents needed, and then **guides the user by voice through the real application form**. The user types and submits the form themselves.

---

## 1. What the user experiences

1. **Choose a language** and hear a greeting (Tamil, Hindi, Telugu or English).
2. **Tell their story** by speaking: "I am 58, my husband passed away, is there any help?" The words appear on screen.
3. **Confirm the details.** Urimai reads back age, marital status and place. The user corrects anything by voice. Nothing is assumed.
4. **See matching schemes.** Each is marked *may be eligible*, *needs more information* or *appears not eligible*, with a plain reason. Urimai never says "approved".
5. **Get ready.** Urimai explains the documents one at a time and where to get any that are missing.
6. **Apply, with a guide.** Urimai asks: "Do you want to fill the form now?" On yes, the user is sent to the application site, and the Urimai assistant starts there.
7. **The assistant guides, the user fills.** The assistant says which box comes next, shows the value from the conversation in large text (with a Copy button), explains unfamiliar questions, and waits. The user says "next", "repeat", "what is this?" or "go back". The user types, logs in, enters any OTP, and presses Submit themselves.
8. **Finish.** The user tells the assistant they are done and may enter their reference number. Urimai shows it as *reported by you*. A 4-digit code lets them return to their journey.

## 2. What Urimai is, and is not

- Urimai **helps and guides**. It does **not** fill, log in, or submit anything on anyone's behalf.
- It does **not** guarantee any benefit and never says "approved".
- It does **not** ask for Aadhaar numbers, OTPs, passwords or bank details.
- Progress the user reports is kept separate from anything officially verified.
- The demo uses a **practice site we built**, clearly marked "Demo – not a government site". There is no integration with the real portal.

---

## 3. The building blocks

Each block is built and tested **on its own**, with pretend ("fake") versions of the others, then plugged together.

| # | Block | Its one job | Needs an API key? |
|---|---|---|---|
| 1 | **Scheme library** | Stores every scheme: rules, benefits, documents, websites, dates, sources, application forms | No |
| 2 | **Eligibility checker** | Compares confirmed details with each scheme's rules; gives one of three answers | No |
| 3 | **Knowledge search** | Finds the right passage for a question, in Tamil or any language | No (better with a key) |
| 4 | **Voice** | Turns speech into text and replies into speech | Yes |
| 5 | **Conversation brain** | Runs the journey: what to ask next, when to confirm, when to explain | Yes for the real AI |
| 6 | **Handoff** | Passes the confirmed details to the assistant using a one-time code | No |
| 7 | **Practice portal** | A copy of an application website (login, form, receipt), marked Demo | No |
| 8 | **Guidance assistant** | Guides the user through the form by voice. Never fills or submits | Uses the voice block |
| 9 | **Saved progress** | Remembers the journey with consent; resume code; delete button | No |
| 10 | **Website screens** | Home, Discover Benefits, My Journey, My Profile, the microphone | No |

Without any API key the site still opens, shows the schemes, checks eligibility from typed answers, and runs the practice portal. Anything needing a key shows a plain message such as "Sarvam key not set".

---

## 4. What we use

| Purpose | What we use | Notes |
|---|---|---|
| Listening | **Sarvam Saaras** | Tamil mixed with English words |
| Speaking | **Sarvam Bulbul** | Natural Tamil, Hindi, Telugu, English |
| Conversation AI | **Sarvam-105B** | Understands the user and writes replies. Never decides eligibility |
| Search by meaning (no key) | **multilingual-e5-large**, runs inside our app (about 2.2 GB) | The user's Tamil question is matched directly to English passages. No translation step |
| Search by meaning (better) | **Sarvam embeddings** | Only if Sarvam enables it for our account |
| Database | **SQLite** | Schemes, knowledge, saved journeys |
| Backend / website | **FastAPI** (Python), **React** | One container, one command |
| Assistant | **TypeScript widget** built separately | Delivered as a page script now, an extension and an app later |

All outside services sit behind swappable plugs. **Wispr Flow** is used by the team to build. It is not part of the app. Playwright is only a test tool, not part of the app.

**Language handling.** The AI reads Tamil directly and turns it into language-neutral details (numbers and fixed labels). Replies are written back in Tamil from those details. We do not translate the user's speech to English.

---

## 5. How each block works

### Scheme library
One entry per scheme: name in four languages, central or state, official websites, important dates, benefits (central and state shares, age bands), required documents, eligibility rules, how to apply, **and when each fact was last checked and from where**. Facts not yet checked against an official document are marked *not yet verified*. Data lives in simple text files in `backend/app/content/` so changes can be reviewed, and is loaded into the database when the app builds. The first official source is the Tamil Nadu social security page in `docs/sources/` (about ten state and central pension schemes).

Each application form is also stored here: the application site, the page's fingerprint (labels we expect to see), the steps in order, and each field's name, the question to ask in each language, an explanation of unfamiliar terms, which confirmed detail fills it, and whether the user must do it themselves (login, OTP, captcha, Aadhaar, password, Submit).

### Eligibility checker
Plain rules, no AI. For each scheme: *may be eligible*, *needs more information* (and exactly what is missing), or *appears not eligible* (and why). It only uses details the user has **confirmed**. Where the rules depend on judgement (for example "destitute"), the answer says officials will decide. The missing-information list also decides which question to ask next.

### Knowledge search
Each scheme has written passages (explanations, steps, FAQs), kept in English with their source. A Tamil question is matched directly to them. In our test with the chosen model, the right passage was in the top 3 results for 15 of 16 sample questions. The AI then answers in Tamil from those passages and shows the source. Without a key, the passages are shown as they are.

### Voice
Tap the microphone and speak (up to about 30 seconds). The words show immediately. If audio is unclear, Urimai asks the user to repeat without losing the conversation. If speech fails, the user can type. Fixed lines (greetings, read-backs, consent, assistant steps) are hand-written in all four languages and recorded once, so they sound natural and cost nothing per use.

### Conversation brain
Moves through the stages: welcome, understand, confirm, discover, prepare, hand off. Takes what the user said, pulls out the details, asks for confirmation, runs the eligibility checker, searches the knowledge when asked, and writes a short reply. One question at a time. Its conversation **ends at the handoff**.

### Handoff
When the user agrees to start the form, Urimai creates a **one-time code** holding the confirmed details, the scheme and form, and the language. The user is sent to the application site with `#urimai=CODE` added. The part after `#` is never sent to the site's server. The assistant reads the code, fetches the details from Urimai, and removes it from the address. A code works once and expires in about 10 minutes. Nothing is saved unless the user consents.

### Practice portal
Our own look-alike of an application site: login, citizen profile, the pension application form, and a receipt with a reference number. It carries a "Demo – not a government site" banner and is treated like any third-party site: the assistant sees it only as a web page.

### Guidance assistant
A separate small program with one job: guide. It knows nothing about schemes or eligibility. It receives the form definition and the details from the handoff.

- It greets the user by name and confirms they are on the right page. (The extension can check the page's fingerprint. The phone app asks the user: "Do you see the page titled…?")
- For each field, it says what to do, shows the value in large text with a **Copy** button, and explains unfamiliar questions.
- On desktop, it also **highlights** the box it is talking about, without changing anything in it.
- The user steers by voice: "next", "repeat", "what is this?", "I don't have it", "go back", "stop". Microphone use is **push-to-talk** by default.
- For login, OTP, captcha, Aadhaar and Submit it says "this one is yours to do", and waits.
- It never fills or submits, never reads typed values, and works only on the sites in a short approved list.
- At the end it asks the user to check everything, press Submit themselves, and tell it the reference number.

### Saved progress
Urimai asks consent before saving anything. By default nothing is kept after the session. If the user agrees, it saves the confirmed details, chosen scheme, document checklist and progress. The user returns with the same browser or a 4-digit code, and a **Delete my data** button removes everything.

### Website screens
Large text, one big microphone, a live transcript, and four sections: Home, Discover Benefits, My Journey, My Profile.

---

## 6. How the pieces fit together

```
User's browser: Urimai website
   conversation + microphone
          |
   Conversation brain ---> Eligibility checker --> Scheme library
     |     |                Knowledge search -----> Scheme library
     |     +--> Voice --> Sarvam (listen, speak, think)
     |     +--> Saved progress
     v
   Handoff (one-time code)
     |
     v   (new tab / app)
Application site (practice portal now; real portal later)
   + Guidance assistant  <--- fetches details with the code, uses Voice
```

The conversation brain is the only block that knows the whole conversation. The assistant is separate: its only link to the rest is the handoff code and the voice services.

---

## 7. One assistant, three carriers

| Where | How the assistant is delivered | Status |
|---|---|---|
| **Demo (any browser, phones too)** | The practice site loads the assistant itself, so judges install nothing | Build now. We say this openly: on the real site, an extension or app would load it |
| **Desktop (Chrome, Edge, Firefox)** | Browser extension on the application site | After the hackathon |
| **Android** | Small app that floats over the browser (like Wispr Flow's bubble), with microphone and "display over other apps" permission only | After the hackathon. Guidance only. Filling fields through accessibility access is a later option and depends on Google Play rules |
| **iPhone** | Not planned: apps cannot float over other apps | Open |

**Android flow:** Urimai website, user says yes, link opens the Urimai app with the handoff code, the app opens the application site in the browser, and the bubble appears and says "You're on the form. Let's start." Because it cannot see the screen, it follows the stored form step by step and asks the user to confirm each screen.

**How the assistant ends**
- The user says "I'm done" or taps the bubble's close button, after the final step. It then closes itself and turns off the microphone.
- The always-visible notification has a **Stop** button.
- After about 10 minutes of silence it asks "Are you still there?", and if there is no answer, it closes.
- A hard limit of about 60 minutes applies, and the handoff expires on its own.
- Leaving the browser does not end it. The bubble stays until one of the above happens.

---

## 8. Folder structure

```
urimai/
├─ docs/                      this file, plus sources/ (official pages we've received)
├─ backend/
│   ├─ app/
│   │   ├─ main.py            the only place blocks are wired together
│   │   ├─ config.py          environment variables, "key not set" checks
│   │   ├─ contracts/         shared data shapes (details, scheme, form, handoff)
│   │   ├─ content/           facts and words reviewable by non-developers
│   │   │   ├─ schemes/<slug>/    scheme.yaml, form.yaml, passages/*.md
│   │   │   └─ lines/             hand-written spoken and on-screen lines: ta, hi, te, en
│   │   ├─ scheme_library/    block 1
│   │   ├─ eligibility/       block 2
│   │   ├─ knowledge_search/  block 3
│   │   ├─ voice/             block 4
│   │   ├─ brain/             block 5
│   │   ├─ handoff/           block 6
│   │   ├─ saved_progress/    block 9
│   │   └─ api/               thin web routes, one file per block
│   ├─ scripts/               build_knowledge.py, refresh_sources.py
│   └─ tests/                 mirrors the folders above
├─ portal/                    block 7: practice site (its own small app)
├─ assistant/                 block 8: guidance assistant (own build)
│   ├─ src/                   panel, voice client, step-by-step guide, highlighter
│   └─ extension/             browser-extension wrapper (later)
└─ frontend/                  block 10: the Urimai website
```

Each block folder has a public interface, a fake version for tests, and tests. Blocks never import each other. Only the conversation brain and `main.py` connect them.

---

## 9. How we build it, and the scope for 30 Nov

The submission is due **30 Nov, 11:59 pm**, so we build in this order, each block alone, then plugged in. Items marked *later* are not part of the submission.

1. **Agreement and pretend services.** Shared data shapes, database layout, fakes. The app still starts with no keys.
2. **Scheme library and eligibility checker.** Load the pension schemes from the official page. Widow pension gets the full form and documents.
3. **Discover screen.** First working demo, no key needed.
4. **Voice.** Microphone, transcripts, speaking replies, "repeat please", typed fallback.
5. **Conversation brain.** First in text with fakes, then with real speech and AI.
6. **Handoff, practice portal and guidance assistant.** The full journey works in Tamil.
7. **Knowledge search.** Local model first. Sarvam embeddings *later*.
8. **Saved progress, other languages, recovery behaviours.** Do as time allows. Tamil and English first.
9. **Pitch deck, 3-minute video, live link.** Reserve the last stretch for these.

*Later:* desktop extension, Android app, official integration, scheme data beyond the pensions.

---

## 10. If something goes wrong

| If this fails | What happens |
|---|---|
| No API key | Site opens; voice and AI show "key not set"; typed answers, schemes, eligibility and the practice portal still work |
| Sarvam is slow, costly or down | Plugs let us switch provider; typing works meanwhile |
| Sarvam credits run out | A plain "voice is paused, you can still type" message |
| Local search model not downloaded | Plain word search is used |
| Page does not match the stored form | The assistant says the site may have changed and gives step-by-step spoken instructions |
| Network drops | Urimai explains and keeps saved progress |

---

## 11. Still to do

- Receive the Sarvam API key; test Tamil extraction on about 20 sample sentences and check which Saaras version we can use.
- Send e-Sevai application steps and required-documents sources; official sources for health insurance, women's grant and other schemes. Until each fact is checked against a government order, data stays marked *not yet verified*.
- Confirm Sarvam's embeddings access for our account (optional).
- Before any real pilot: read the real portal's terms on assisted use, and ask the e-governance agency (TNeGA) for a written no-objection.
- Check whether the competition requires showing Wispr Flow in the demo video.
