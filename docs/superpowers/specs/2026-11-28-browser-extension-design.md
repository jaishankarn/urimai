# Guidance assistant, browser extension: design

Status: draft for review, 2026-11-28
Scope: the browser extension only (`assistant/`). The Urimai website, the conversation brain, the handoff endpoints and the practice portal are out of scope here. This document states only what the extension needs from them.

## 1. What we are building, in one paragraph

After the user agrees to fill an application in Urimai's website, Urimai hands over a one-time code. The extension picks the code up on the application site, takes the confirmed details and the form's steps, and then talks the user through the form. It says which box is next, shows the value to type in large text with a Copy button, explains unfamiliar questions, and waits for "next", "repeat", "what is this?", "I don't have it", "go back", "stop" or "done". It highlights the box it is talking about. It never types into, clicks on, reads the value of, or submits any field.

## 2. Hard rules for the extension

These come from `CLAUDE.md` and `docs/architecture.md`. Each one has a check in section 10.

1. **No filling, no clicking on the form, no submitting.** The extension may scroll to a field and draw an outline around it. Nothing else changes on the page.
2. **Never read what the user typed.** No code reads `input.value`, `textarea.value`, `select.value`, or form data, and no listener is attached to input events. The extension knows only the labels and structure of the page.
3. **Only approved sites.** Content scripts and host permissions cover only the origins listed in the form definition. No `<all_urls>`.
4. **Login, OTP, captcha, Aadhaar, passwords and Submit belong to the user.** The assistant says "this one is yours" and waits. It never speaks a value for those fields and never asks for them.
5. **No eligibility, no guarantees, no "approved".** The extension has no scheme knowledge. It only guides through the form.
6. **Memory only.** The confirmed details live in `chrome.storage.session`, which is cleared when the browser closes. Nothing is written to `chrome.storage.local` or to the page. Saving progress is a separate block and needs consent.
7. **Say everything out loud and on screen.** Every spoken line also appears as text in the panel, so the user can read it and the deaf or hard-of-hearing user is not left out.

## 3. Where the extension fits

```
Urimai website ──(one-time code in #urimai=CODE)──▶ application site (approved origin)
                                                         │
                         content script (reads code once, removes it from the URL)
                                                         │ message
                         service worker ──GET /api/handoff/{code}──▶ Urimai backend
                              │   (consumes the code, returns payload)
                              │
                              ├── stores payload in chrome.storage.session, keyed by tab
                              ├── proxies voice: POST /api/voice/stt, POST /api/voice/tts
                              └── proxies intent: POST /api/guide/intent (closed set, fallback only)

Content script ──▶ shadow-DOM panel (text, buttons, mic)
               ──▶ page sync (fingerprint, locate field, outline it)
               ──▶ guide engine (pure state machine, no DOM)
```

The extension is a shell around the guide engine. The engine holds all the conversation logic and has no DOM or browser calls, so it can be tested in plain Node.

## 4. Data the extension receives (proposed contract)

The backend sends this payload when the code is consumed. The shape should be agreed with the backend owner and kept in one shared file, `assistant/src/contracts/`, that mirrors `backend/app/contracts/`.

```ts
type Lang = 'ta' | 'hi' | 'te' | 'en';
type Localised = Partial<Record<Lang, string>>;   // English is required

interface HandoffPayload {
  version: 1;
  expiresAt: string;                 // ISO time; the code itself expires in ~10 min
  language: Lang;
  scheme: { id: string; name: Localised };
  details: Record<string, string | number | boolean>; // confirmed details only
  lines: Record<string, Localised>;  // the assistant's fixed lines, from backend/app/content/lines
  form: FormDefinition;
}

interface FormDefinition {
  id: string;
  allowedOrigins: string[];          // e.g. "https://www.tnesevai.tn.gov.in"
  demo: boolean;                     // true for the practice portal, shows a banner
  steps: FormStep[];                 // in order
}

interface FormStep {
  id: string;
  pageLabels: string[];              // fingerprint: labels we expect on this page
  title: Localised;
  fields: FormField[];
}

interface FormField {
  id: string;
  label: Localised;                  // what the page calls it, per language
  question: Localised;               // what the assistant asks
  explain: Localised;                // plain explanation of unfamiliar terms
  valueFrom: string | null;          // e.g. "details.husbandDeathDate"; null = user decides
  sensitivity: 'none' | 'user_only'; // user_only: login, OTP, captcha, Aadhaar, password, Submit
  locator: {
    labelText: string[];             // matched against <label>, aria-label, placeholder
    name?: string;                   // the field's name attribute, if stable
  };
}
```

`valueFrom` is a pointer into `details`, not a copy of it. The panel shows the value the engine resolves from the payload, so a field can be checked against the confirmed details at any time.

## 5. The guide engine (the core)

The engine is a pure TypeScript module: `(state, event) → (state, actions)`. Events are user commands, page changes and timers. Actions are lines to speak and show, highlight requests and "ask the user" prompts.

**States**

| State | Meaning | Leaves when |
|---|---|---|
| `waiting_for_page` | Payload loaded, the page has not been matched yet | The page fingerprint matches step 1, or the user says "start here" |
| `on_field` | Asking about the field at the cursor | Command received (`next`, `back`, `repeat`, `explain`, `skip`, `stop`, `done`) |
| `user_only_field` | Field is sensitive; assistant gives no value and waits | User says "done with this" or "next" |
| `page_mismatch` | The page does not match the stored step | The page matches a step again, or the user asks to continue with spoken steps |
| `finished` | User said done or the form is complete | Never; the user can restart by voice |
| `stopped` | User said stop, or the timers ended the session | "Continue" from the bubble |

**Rules the engine enforces**

- The cursor only moves forward on `next`, or backward on `back`. It never jumps on its own.
- If the user has moved to another page, the engine does not change steps silently. It says: "This looks like page 3 of 5. Shall we start from here?" and waits.
- `repeat` repeats the current line. `explain` reads the field's `explain` text. `skip` marks the field "not available yet" and records it as pending, so the summary at the end lists it.
- The engine never confirms that a value was typed correctly, because it cannot read the page. It relies on the user's word, and says so in the summary: "You told me you filled these in."
- Unclear speech does not change state. The engine asks again.
- Each command is handled once. Duplicate speech results inside a short window are dropped.

**Commands and multilingual wording**

Commands are matched first by keyword lists in `assistant/src/guide/commands.ts`, one list per language. The lists are reviewed by a native speaker before the demo. Keywords are only a starting point; the backend intent call (section 7) is the fallback.

| Command | Tamil | Hindi | Telugu | English |
|---|---|---|---|---|
| next | அடுத்து | अगला | తరువాత | next |
| repeat | மீண்டும் | दोबारा | మళ్ళీ | repeat |
| what is this | இது என்ன | यह क्या है | ఇది ఏమిటి | what is this |
| back | பின் | वापस | వెనక్కి | back |
| I don't have it | என்னிடம் இல்லை | मेरे पास नहीं है | నా దగ్గర లేదు | I don't have it |
| stop | நிறுத்து | रुको | ఆపు | stop |
| done | முடிந்தது | हो गया | అయిపోయింది | done |

## 6. Working with the page

**Fingerprint.** On every page change (a `MutationObserver` with a 300 ms throttle), the content script collects the visible text of labels, headings and button texts, then checks how many of `step.pageLabels` are present. A match needs at least 70% of them, with a minimum of 2. This is a sanity check, not a security check.

**Locating a field.** For the current field, the locator looks for:
1. A `<label>` whose text matches one of `labelText` (case and spacing ignored), and the input it points to.
2. An element with `aria-label` or `placeholder` that matches.
3. An input whose `name` equals `locator.name`, if given.

If nothing matches, the assistant says "I cannot see this box on the page. Please scroll down, or say repeat" and does not guess. It never picks a box by position.

**Highlighting.** A fixed-position outline drawn in the shadow DOM, positioned from `getBoundingClientRect()` and updated on scroll and resize. The page's own styles are not changed. The element is scrolled into view with `scrollIntoView({ block: 'center' })`, which moves the page but changes no value.

**Page mismatch.** If the page does not match, the engine switches to `page_mismatch`. The assistant says the site may have changed and reads the remaining steps as a short spoken list, with the field names in the user's language. It still never fills or clicks anything.

## 7. Voice and the backend

**Speech.** The microphone is push-to-talk by default. A tap on the mic starts recording, and the recording stops when the user stops speaking or taps again (up to about 30 seconds). The audio goes to `POST /api/voice/stt`, which returns text. The reply goes to `POST /api/voice/tts` and plays back. Typed input is always available as a fallback, and speech failure never loses the current field.

**Intent (fallback only).** If no keyword matches, the utterance is sent to `POST /api/guide/intent` with the list of allowed commands and the current field's label, and nothing else. The backend returns one command or `unknown`. The extension never sends page content, values or the full form to this endpoint.

**Explanations.** "What is this?" is answered from the field's `explain` text only. The guide does not answer open questions. For anything else it says, "I am not sure about that. Please ask at the office, or say repeat." This keeps it from inventing rules.

**Network and key failures.** If the backend is unreachable, the panel says so, keeps the cursor, and continues with typed input and the on-screen text. If `SARVAM_API_KEY` is not set on the server, the voice calls return "voice not set up", and the panel shows that message. The extension must still work with typed input and the outlines when voice is off.

**Mic permission.** Microphone access from a content script uses the site's own permission, which would ask the government site for microphone access. We want the request to come from the extension. The plan is to capture audio from an offscreen document after a one-time grant on an extension setup page. This is one of the spikes in section 11.

## 8. Handoff and session

1. The Urimai website opens the application site with `#urimai=CODE` added to the address.
2. The content script on an approved origin reads the fragment once, then removes it with `history.replaceState`, so the code is not left in the address bar or in history.
3. The content script sends the code to the service worker. The worker calls `GET /api/handoff/{code}`. The backend returns the payload and marks the code used, so it works only once.
4. The payload is stored in `chrome.storage.session` under the tab's id. If the tab reloads, the engine restores from there.
5. The session ends when the user says "done" or "stop" and confirms, when the browser closes, after 10 minutes of silence (the assistant asks "Are you still there?" first), or after the hard limit of about 60 minutes.

Known limit: the page's own scripts can read the fragment in the instant before it is removed. The code is single-use and expires in about 10 minutes, so the risk is small. The practice portal is Urimai's own page, and real sites would need the same check.

**If the extension is not installed,** the Urimai website shows the same steps as text, with the Copy buttons, and says "Install the Urimai helper to be guided on the form." The website must not show "You're on the form" if the helper has not answered.

## 9. Extension structure

```
assistant/
├─ extension/
│   ├─ manifest.json          MV3; approved content_scripts matches; no <all_urls>
│   └─ icons/
├─ src/
│   ├─ contracts/             HandoffPayload, FormDefinition (mirrors backend)
│   ├─ guide/                 engine.ts, commands.ts, lines.ts   (pure; no DOM, no chrome.*)
│   ├─ page/                  fingerprint.ts, locator.ts, outline.ts, sync.ts  (DOM)
│   ├─ panel/                 shadow-DOM UI: text, big buttons, mic, Copy   (Preact)
│   ├─ voice/                 capture.ts, speech.ts, fake.ts
│   ├─ background/            service-worker.ts, handoff.ts, backend.ts, session.ts
│   └─ content.ts             entry on approved pages; reads the fragment, mounts the panel
├─ tests/                     engine, commands, fingerprint, locator (with fixtures), worker
├─ fixtures/                  saved HTML of a practice-portal form page, one per step
├─ package.json
└─ vite.config.ts             multi-entry build into extension/dist
```

**Build.** Vite builds the content script, the service worker and the offscreen page into `extension/dist`. The team loads that folder with "Load unpacked". This build is separate from `docker compose`, so the Docker image and the no-key start are not affected.

**Tests.** `assistant/` will be the first place with a frontend test runner. We propose Vitest, which is a new dev dependency. Playwright (already installed in the container) runs the end-to-end check: load the unpacked extension in Chromium, open a fixture page, and check that the outline appears and no input value changes.

**Panel.** Shadow DOM, so the site's CSS cannot break it and it cannot break the site's CSS. Text is at least 20 px, buttons are at least 56 px, and contrast is at least 7:1. It works at 360 px width. The panel can collapse to a bubble that shows only the mic.

## 10. How we check it

| Rule | Check |
|---|---|
| No value reads | A test greps `assistant/src` for `.value`, `FormData`, `input` listeners and fails if any are found, except in the allowed `panel/` input box |
| No DOM writes to the form | The Playwright test compares the form's serialised HTML before and after a full guided walk, and it must be equal |
| Approved origins only | The manifest is checked in a test: no `<all_urls>`, every `matches` entry is in the form's `allowedOrigins` |
| User-only fields | Engine test: a `user_only` field never produces a value line |
| Fragment removed | Test: after load, the address has no `#urimai=` |
| One-time code | Backend contract test (with a fake backend): second consume is refused |
| Page mismatch | Fixture test: a changed page moves to `page_mismatch` and makes no change to any step |
| Language | Each command keyword list has entries for all four languages, and every spoken line has an English value |

## 11. Spikes before the build (about half a day)

1. **Load and read**: unpacked extension on the practice-portal fixture; read the fragment; remove it; fetch a payload from a fake backend.
2. **Outline**: draw an outline in shadow DOM over a labelled input and keep it in place on scroll.
3. **Microphone**: record from an offscreen document after a one-time grant on a setup page, in Chrome. If that fails, fall back to a content-script prompt on the portal's own origin and note it as a limit.
4. **Fingerprint on a real page**: save one real page of the state's site (where allowed) and check that the label matching still works. If we cannot save a real page, we say so and use the practice portal only.

## 12. Build order

Each step ends with tests passing. The steps are ordered so the engine is done first, because it has the most logic and needs no browser.

1. **Contracts and fixtures.** Types, one practice-portal form in fixtures, a fake backend.
2. **Guide engine and commands.** All states and rules in section 5, with tests for each rule. No DOM.
3. **Page layer.** Fingerprint, locator, outline, mutation sync. Tested against saved HTML fixtures.
4. **Panel and typed mode.** Full guided walk using typed input only. This is the first demo.
5. **Handoff and session.** Fragment, code consume, tab-keyed storage, restore on reload, timers.
6. **Voice.** Push-to-talk, `stt`/`tts` proxies, intent fallback, offline handling.
7. **Recovery.** Page mismatch, unclear speech, network loss, silence, stop.
8. **Packaging and end-to-end.** Build, Playwright walk, a short install note for the team.

## 13. Time and scope

The submission is due **30 Nov 2026, 11:59 pm**, and today is 28 Nov. That is about two days. `docs/architecture.md` marks the desktop extension as "after the hackathon", and its demo uses the assistant as a script on the practice page.

**Recommendation.** Build steps 1 to 4 first, as one assistant core that runs in two places: as a panel on the practice portal for the demo, and as the extension's content script. The extension packaging, the real-site allowlist and the offscreen microphone (steps 5 to 8 in parts) follow, and we drop them first if time runs short. The demo can be shown on the practice portal without the extension installed, because the assistant is the same code.

## 14. Decisions I made, and the ones to confirm

Decided here (change these if you disagree):

- Panel is an in-page bottom panel in shadow DOM, not Chrome's side panel. A side panel is harder to find for elderly users and does not open from a page event without a click.
- Voice is push-to-talk, with tap-to-record as the fallback.
- The guide is scripted. An AI model is used only for intent matching, never for eligibility or open answers.
- No `chrome.storage.local`. Progress saving stays with the website block and needs consent.
- Preact for the panel, to keep the bundle small. React would also work.

To confirm with the team:

1. Vitest as the first frontend test framework. `CLAUDE.md` says there is no frontend test framework today.
2. The handoff payload shape in section 4, with the backend owner.
3. The list of approved application origins. The practice portal is first. The real portal (tnesevai) needs a check of its terms for assisted use, and that check is already listed in `docs/architecture.md`.
4. Native-speaker review of the command keywords (section 5) and the lines.
5. Whether the extension must be in the demo video, or the practice page is enough.
