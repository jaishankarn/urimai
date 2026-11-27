# Urimai: How It Works

**Your Voice. Your Rights. Your Benefits.**

Urimai is a website where a person speaks in their own language (Tamil first), and Urimai helps them find the government benefits they may qualify for and fill in the application. The user talks. Urimai listens, answers by voice, and, when it is time to apply, opens a browser window on the screen and fills in the form while the user watches and guides it by voice.

---

## 1. What the user experiences

1. **Choose a language** and hear a greeting (Tamil, Hindi, Telugu or English).
2. **Tell their story** by speaking: "I am 58, my husband passed away, is there any help?" The words appear on screen as they are heard.
3. **Confirm the details.** Urimai reads back age, marital status and place. The user corrects anything by voice. Nothing is assumed.
4. **See matching schemes.** Each one is marked *may be eligible*, *needs more information* or *appears not eligible*, with a plain reason. Urimai never says "approved".
5. **Get ready.** Urimai explains the documents needed, one at a time, and where to get any that are missing.
6. **Apply.** A browser window opens on the screen. Urimai logs in, types each answer into the form, and checks that what was typed matches what the user said. The user can say "wait", "change that" or "continue" at any time.
7. **Finish.** The application is submitted to our practice portal and a reference number is read out. A printable summary is also offered.
8. **Come back later.** A 4-digit code (or just reopening the site) continues where the user stopped. The user can delete all saved data at any time.

**What Urimai is not.** It does not guarantee any benefit. It does not claim to submit to the real government portal. The practice portal is clearly labelled "Demo". Progress the user reports is kept separate from anything officially verified.

---

## 2. The building blocks

Each block is built and tested **on its own**, with pretend ("fake") versions of the others, and then plugged together. Each block has one job.

| # | Block | Its one job | Needs an API key? |
|---|---|---|---|
| 1 | **Scheme library** | Stores every scheme: who can apply, benefits, documents, websites, dates, how to apply | No |
| 2 | **Eligibility checker** | Compares the user's confirmed details with each scheme's rules and gives one of three answers | No |
| 3 | **Knowledge search** | Finds the right passage when the user asks a question, in Tamil or any language | No (better with a key) |
| 4 | **Voice** | Turns speech into text and replies into speech | Yes |
| 5 | **Conversation brain** | Runs the journey: what to ask next, when to confirm, when to explain | Yes for the real AI |
| 6 | **Practice portal** | A copy of a government application website (login, profile, form, receipt), clearly marked Demo | No |
| 7 | **Browser agent** | Operates the practice portal like a person and streams what it does to the screen | No |
| 8 | **Saved progress** | Remembers the journey with consent; resume code; delete button | No |
| 9 | **Website screens** | Home, Discover Benefits, My Journey, My Profile, the microphone, and the live browser window | No |

Without any API key the site still opens, shows the schemes, checks eligibility from typed answers, and runs the practice portal. Anything needing a key shows a plain message such as "Sarvam key not set".

---

## 3. What we use

| Purpose | What we use | Notes |
|---|---|---|
| Listening (speech to text) | **Sarvam Saaras** | Understands Tamil mixed with English words |
| Speaking (text to speech) | **Sarvam Bulbul** | Natural Tamil, Hindi, Telugu, English voices |
| Conversation AI | **Sarvam-105B** (chat model) | Understands what the user said and writes replies. It never decides eligibility |
| Search by meaning | **multilingual-e5-large** (runs inside our app, about 2.2 GB, no key) | Used when no key is set |
| Search by meaning, better | **Sarvam's embeddings model** | Only if Sarvam enables it for our account. It is gated, so it is a bonus, not a dependency |
| Browser agent | **Playwright** with Chromium | Drives the practice portal |
| Database | **SQLite** (a single file) | Schemes, knowledge and saved journeys |
| Backend / website | **FastAPI** (Python) and **React** | Already set up; everything runs in one container with one command |

Every outside service sits behind a swappable plug, so we can change a provider without touching the rest. **Wispr Flow** is used by the team to build faster. It is not part of the app.

---

## 4. How each block works

### Scheme library
One entry per scheme: name in four languages, central or state, official websites, important dates, benefits, required documents (shared across schemes), eligibility rules, how and where to apply, and **when each fact was last checked and where it came from**. Facts not yet checked against an official document are marked *not yet verified*, and the app says so. The data lives in simple text files in the project, so changes can be reviewed, and is loaded into the database when the app builds.

### Eligibility checker
Plain rules, no AI. For each scheme it answers *may be eligible*, *needs more information* (and exactly what is missing), or *appears not eligible* (and why). It only uses details the user has **confirmed**. The missing-information list also decides which question to ask next, so Urimai asks only what it needs.

### Knowledge search
Each scheme has a set of written passages (explanations, steps, frequently asked questions), kept in English with their source. When the user asks something in Tamil, the Tamil question is turned into a "meaning fingerprint" and matched directly against the English passages. There is **no translation step**, which is faster and has one fewer thing to fail. We tested this on sample Tamil questions; the right passage was in the top 3 results for 15 of 16 with the model we chose. The AI then answers in Tamil from those passages and shows the source. Without a key the passages are shown as they are. The screen shows which mode is active ("offline search" or "enhanced search").

### Voice
The user taps the microphone and speaks (up to about 30 seconds). The words are shown immediately. If the audio is unclear, Urimai asks the user to repeat without losing the conversation. If speech fails, the user can type. Fixed lines (greetings, read-backs, consent) are hand-written in all four languages so they sound natural.

### Conversation brain
Moves through the stages: welcome, understand, confirm, discover, prepare, fill, review, submit. At each turn it takes what the user said, pulls out the details, asks for confirmation, runs the eligibility checker, searches the knowledge when asked, and writes a short reply. One question at a time.

### Practice portal
Our own look-alike of the Tamil Nadu e-Sevai website: login, citizen profile, the pension application form, and a receipt with a reference number. It carries a "Demo portal" banner. It exists so the application can really be filled and submitted somewhere safe, without touching a real government system or real people's records.

### Browser agent
This is what makes the experience feel real.

- Urimai starts a hidden Chromium browser on the server and **streams its picture to a window on the user's screen** (like a live video).
- It works like a person: moves a visible pointer to a field, highlights it, types the answer letter by letter, and says what it is doing ("Entering your name: Lakshmi").
- The login password comes from server settings. It is **never spoken, shown or stored in the conversation**.
- After filling each field it **reads the value back from the page** and compares it with what the user confirmed. A tick appears when it matches. If not, it fixes it.
- The user guides by voice: "wait", "go back", "change the age to 59", "continue". A step-by-step mode pauses after each group of fields to ask "Is this right?".
- At the end the portal gives a reference number and Urimai reads it aloud.
- The user watches only; they cannot click inside the window. Voice is the control.
- At most two applications run at the same time; others see a "please wait" message.
- If the browser cannot run, the user still gets a printable, pre-filled summary with the document checklist to take to an e-Sevai centre.

### Saved progress
Urimai asks consent before saving anything. It saves the confirmed details, chosen scheme, document checklist and form progress. The user reopens the site or enters a 4-digit code to continue, and a **Delete my data** button removes everything. No Aadhaar numbers, OTPs or bank details are ever requested for finding benefits.

### Website screens
Large text, one big microphone, a live transcript, and four sections: Home, Discover Benefits, My Journey, My Profile. On a computer, the live browser window appears beside the conversation. Phone layout is not a goal for now.

---

## 5. How the pieces fit together

```
User's browser (React website)
   conversation + microphone      live browser window
          |                              ^
          v                              | picture + step captions
   Conversation brain -----------> Browser agent --> Practice portal
     |      |      |
     |      |      +--> Saved progress
     |      +---------> Eligibility checker --> Scheme library
     |      +---------> Knowledge search -----> Scheme library
     +----------------> Voice --> Sarvam (listen, speak, think)
```

The conversation brain is the only block that knows the whole journey. Every other block knows only its own job and talks through a small agreed set of data shapes (user details, scheme, application task, progress event). Because of that, any block can be replaced or tested alone.

---

## 6. How we build it

Each step is built alone, tested alone, then added to the whole. After steps 3, 6 and 8 the app is demonstrable end to end.

1. **Agreement and pretend services.** Write down the data each block passes, create the database layout, and make fake versions of speech, AI and the browser. The app still starts with no keys.
2. **Scheme library and eligibility checker.** Add the Destitute Widow Pension in full (documents, form fields, sources) and the other schemes for discovery. Test all three eligibility answers.
3. **Discover screen.** Show real schemes and reasons on the website. First working demo, no key needed.
4. **Knowledge search.** Add the passages, the local model and the better Sarvam option. Test with Tamil questions.
5. **Voice.** Microphone, transcripts, speaking replies, "repeat please", typed fallback.
6. **Conversation brain.** First in text with fakes, then with real speech and AI. A Tamil user can now describe their situation and get matches.
7. **Practice portal.** Build and test by hand.
8. **Browser agent and live window.** Playwright fills the portal while the picture streams to the screen. Add voice controls and read-back checks. The full journey now works.
9. **Saved progress.** Consent, resume code, delete, printable summary.
10. **Languages and polish.** Hand-written lines in all four languages, recovery behaviours, the other schemes, pitch deck, 3-minute video, live link.

---

## 7. If something goes wrong

| If this fails | What happens |
|---|---|
| No API key | Site opens; voice and AI show "key not set"; typing, schemes, eligibility and the portal still work |
| Sarvam is slow, costly or down | Plugs let us switch provider; typing works meanwhile |
| Sarvam embeddings not enabled | The local search model is used |
| Local search model not downloaded | Plain word search is used |
| Chromium cannot start | The printable summary is offered instead |
| Network drops | Urimai explains and keeps saved progress |

---

## 8. Still to do

- Receive the Sarvam API key and confirm which Saaras version and Tamil quality we get.
- The official Tamil Nadu social security page (Tamil text) is saved in `docs/sources/`. It gives eligibility, amounts and the online route for the state and central pension schemes, and it overrides the earlier news-based notes (for example, the Destitute Widow Pension is age 18+ at Rs.1,200 a month, with immovable property up to Rs.1,00,000). It does not list required documents or define "destitute", so those still need an official source. Other schemes (health insurance, women's rights grant, farmer and health schemes) still need their own sources. Until each fact is checked against a government order, the data stays marked *not yet verified*.
- Confirm Sarvam's embeddings access for our account (optional).
- Check whether the competition requires showing Wispr Flow in the demo video.
