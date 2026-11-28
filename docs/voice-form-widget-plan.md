# Voice Form Widget: Implementation Plan

Status: agreed 28 Nov 2026. Design summary: [architecture.md](architecture.md). Why: [architecture-changes.md](architecture-changes.md).

This plan covers everything needed to build the **Urimai voice form widget**, the **handoff** from the Urimai website, and the **practice portal** used for the demo. It lists the work, contracts, edge cases, tests and build order. A working prototype of the core techniques was tested on 28 Nov; key code from it is in [section 13](#13-reference-code-from-the-prototype).

---

## 0. Implementation status (28 Nov 2026)

Steps 1–6 are built; step 7 (voice) is built against the Sarvam API as documented on 28 Nov and is **not yet tried with a real key**.

| Check | Status |
|---|---|
| Backend tests (form maps, handoff, sessions, origins, quotas, understanding rules, Sarvam adapter with a mock, portal) | pass |
| Widget unit tests (labels, locating, frames, sensitive detector, filling, site-error detection) | pass |
| End-to-end, 6 scenarios (`widget/tests/e2e/run.mjs`): portal in English by tapping and typing (desktop and phone), portal in Tamil by voice (Chromium's fake microphone and a stand-in for Sarvam), portal with no handoff, the website's results button opening the portal, and a site whose checks the widget does not know | pass; each also checks that the widget sent no form, clicked no button and never sent an Aadhaar number |
| `docker compose up --build` | not run here (Docker Hub rate limit in the build sandbox) |
| Sarvam with a real key (28 Nov): chat, transliteration, Tamil speech out, and that speech heard back (spoken Tamil numbers come back as digits) | pass, each call 0.5–2.7 s. A real person's voice through the browser microphone is still to try |
| Local test model (`AI_PROVIDER=local`, Qwen2.5 1.5B) | runs; much weaker (read "ஐம்பத்தெட்டு" as 18), so confirmation read-backs matter |

**No validation of our own.** Reply understanding converts what was said into what to type (number words to digits, a spoken date to a date, a spoken choice to the list's option, a Tamil name to English letters when a box needs them). It never rejects a value for length, format or range; the website does that, and the widget passes the website's message on. The one exception is a box's own `maxlength`, which the browser does not enforce when a value is set by a script, so the widget reads it from the page and says so.

**Site checks are not known in advance.** A form map lists fields, never a site's validation rules. After filling a value, and while waiting for the person to press a button, the widget watches for whatever the site says: a message beside the field (common class names, or `aria-invalid` with `aria-describedby`), the browser's own checks (`pattern`, `type`, `min`/`max`, and the `invalid` event when the browser refuses to send), `alert()` pop-ups, and error summaries or alert boxes, including ones that appear late from a timer or the site's server. Then:
- a message beside a field the widget filled: it reads the message out and asks for that value again;
- a message beside a box the form map does not know: it highlights the box and asks the person to fix it themselves;
- a message for the whole page that names no field: it reads it out and asks which detail to change (or "I will fix it myself");
- required boxes the form map does not know: before a Next or Submit button, the person is asked to fill them.

**Where the build differs from this plan**
- Reply understanding (yes/no/done/commands, spoken digits, dates, option matching) lives in one place, the backend (`backend/app/understand/rules.py`), and works without a key. The widget keeps only a tiny offline fallback for yes/no/done.
- Form map additions: `page` (the page a field is on), `reloads` (choosing reloads the page), `frame` (selector of the same-site frame), `aliases` (spoken words for an option, any language), `finish_page`, and the source `field.<key>` (English-letters name derived from the confirmed Tamil name).
- `GET /api/demo/handoff?form_id=…&lang=…` opens a demo form with the made-up sample widow's answers, for demos without going through the journey.
- The website shows "Fill the application with Urimai" for any result that is not "appears not eligible", even for unreviewed rules (none is reviewed yet), with a line saying the practice portal sends nothing to any department. **Decide before the demo** whether that is acceptable.
- Saying the same value again at "is this right?" counts as yes. A correction given with "no" ("no, it is 98…") is used directly.
- The panel moves to the other side when it covers the highlighted field, and adds scroll room at the end of the page.
- End-to-end tests are a Node script using the pre-installed Playwright (`widget/tests/e2e/run.mjs`), not `@playwright/test`. A test site with unknown checks (`widget/tests/e2e/fixture_site.py`) stands in for the CPGRAMS-style fixture; the React fixture is not built yet.
- "Ration card number" is not treated as a payment card by the sensitive-field detector.

---

## 1. Goal and success criteria

**Demo story.** The widow from the main journey sees "may be eligible" for the Destitute Widow Pension and taps **"Fill the application with Urimai"**. The practice portal opens in a new tab. The widget greets her by name and fills every field it is allowed to fill, by voice or by tapping, confirming each one. She types her Aadhaar number and the captcha, uploads her documents, ticks the declaration and presses Submit. The portal shows a demo acknowledgement.

**Done means all of these hold:**

1. `docker compose up --build` serves the website, the practice portal at `/portal/` and the widget at `/widget/v1/widget.js` on port 3000, with no keys and no `.env`.
2. With **no key**, the whole story works by tapping and typing, and the widget says voice is not set up.
3. With a **Sarvam key**, the user can speak every reply in Tamil or English and hears the widget's questions.
4. The widget works on a desktop browser and on a phone browser (Android Chrome at minimum).
5. The automated end-to-end tests in [section 11](#11-testing) pass, including every "never" rule in [section 2](#2-rules-enforced-in-code-and-tests).
6. The widget file has no runtime dependencies, uses no `eval`, and is under about 60 KB minified.

---

## 2. Rules enforced in code and tests

These are product rules, not preferences. Each has a test.

| # | Rule |
|---|---|
| R1 | Never read or write the value of a **sensitive field**: passwords, OTP, captcha, Aadhaar/UID, bank account, IFSC, card details, PIN (see the detector in 7.10). |
| R2 | Never click a submit, "next", "save", "verify" or other button that sends the form. Never call `form.submit()` or `form.requestSubmit()`. A site's own reaction to a field change (for example a dropdown that reloads the page) is allowed, because a person choosing that option causes the same. |
| R3 | Fill only values the user has confirmed in this session, or confirmed in Urimai and carried by the handoff. Read each value back after filling and get a yes. |
| R4 | Declarations and consent boxes are always the user's to tick. |
| R5 | Uploads are the user's, unless the user gave Urimai that document and says yes to attaching it (later milestone). |
| R6 | Run only on sites and pages registered for the site key. |
| R7 | Keep state only in the tab (`sessionStorage`), clear it on finish, stop or timeout. The server keeps handoff data only until it is used or expires. Never log personal values. |
| R8 | Never send page text to the AI. The AI sees only the user's words, plus the field's label, type and options from our own form map. |

---

## 3. Pieces to build

| Piece | Location | Purpose |
|---|---|---|
| Form map contract | `backend/app/contracts/forms.py` | Shape of a form map (fields, how to find them, sources, modes) |
| Handoff and widget contracts | `backend/app/contracts/handoff.py` | Handoff request, widget session, plan sent to the widget |
| Form maps | `backend/app/content/forms/<form_id>.yaml` | One file per supported form. Data only |
| Widget lines | `backend/app/content/lines/widget.en.yaml`, `widget.ta.yaml` | Hand-written widget messages, reviewed like other content |
| Form registry | `backend/app/forms/` (loader) | Loads and validates form maps at startup |
| Handoff store | `backend/app/handoff/` | One-time codes and widget sessions, in memory with expiry |
| Routes | `backend/app/api/forms.py`, `backend/app/api/widget.py` | Form list, handoff, widget session, voice, understanding, transliteration |
| Practice portal | `backend/app/portal/` | Demo pension application site at `/portal/` |
| Widget | `widget/` | TypeScript source, build, unit tests, end-to-end tests and fixtures |
| Website button | `frontend/src/journey/Results.tsx`, `frontend/src/api.ts` | "Fill the application with Urimai", handoff call, new tab |
| Build and serve | `Dockerfile`, `backend/app/main.py` | Build the widget, serve `/widget/v1/widget.js` and `/portal/` |

---

## 4. End-to-end flow

1. **Results screen.** For each result, the website calls `GET /api/forms?scheme_id=<id>`. If a form exists and the result is not `appears_ineligible`, it shows **"Fill the application with Urimai"**.
2. **User taps it.** The website opens a blank tab *immediately* (in the click handler, so pop-up blockers allow it), then calls `POST /api/handoff` with `form_id`, `lang` and the confirmed `facts`, and points the tab at the returned `url` (`<start_url>#urimai=<code>`).
3. **Widget boots** on the application page: it reads its `data-site-key`, finds `#urimai=<code>`, removes it from the address bar, and calls `POST /api/widget/session` with the site key and code. The server checks the code (unused, unexpired, same site key), checks the request's `Origin` against the form's registered origins, marks the code used, and returns the **plan**: the form map with known values filled in, the widget lines in the user's language, a session token and which voice features are available.
4. **Widget runs the page:** greet, then for each field on the page (fill fields first, then the user's own steps, then the button): find it, act, verify, confirm. See section 7.
5. **Replies** come from the microphone (`POST /api/widget/listen`), the quick-reply buttons or the text box. Free-form replies go through `POST /api/widget/understand` when a key is set, and through built-in rules otherwise.
6. **Page changes** (dropdown reloads, next page, server errors): the widget restores its state from the tab, re-checks earlier fields and continues.
7. **End:** after the user presses Submit and the acknowledgement page loads, the widget says it is done, shows any reference number visible on the page, clears its tab state and calls `POST /api/widget/end`.

Without a `#urimai=` code, the widget shows a **"Fill by voice"** button. Tapping it starts a session with no carried values, and the widget asks for everything.

---

## 5. Contracts

Follow the existing style: Pydantic models with `extra="forbid"`, and `Text` = `{en, ta}`. Hindi and Telugu are added to `Text` later across the app.

### 5.1 Form map (`content/forms/<form_id>.yaml`)

```yaml
id: demo-destitute-widow-pension
scheme_id: destitute-widow-pension          # must exist in content/schemes
service_code: REV-202
title: { en: Destitute Widow Pension application, ta: ஆதரவற்ற விதவை ஓய்வூதிய விண்ணப்பம் }
site:
  key: urimai-practice                      # the data-site-key on the page
  origins: [self]                           # "self" = same origin as the Urimai server; real sites list exact origins
  start_url: /portal/pension/apply
  pages: [/portal/pension/apply, /portal/pension/documents, /portal/pension/done]
fingerprint:                                # labels that must be on the first page; fewer than min_match = page changed
  labels: [applicant name, date of birth, district]
  min_match: 2
fields:
  - key: name_en
    find: { labels: ["applicant name (in english"] }      # or { selector: "#Name" }
    mode: fill
    kind: name_latin                         # needs A–Z: transliterate the Tamil name and confirm spelling
    format: upper
    source: ask                               # ask | facts.<field> | carried.<key>
    label: { en: Name in English capitals, ta: பெயர் (ஆங்கிலப் பெரிய எழுத்துகளில்) }
    ask: { en: What is your name?, ta: உங்கள் பெயர் என்ன? }
  - key: marital
    find: { labels: [marital status] }
    mode: fill
    kind: choice
    source: facts.widowed
    map: { "yes": Widow }                    # fact value -> option text; anything unmapped is asked
    label: { en: Marital status, ta: திருமண நிலை }
  - key: age
    find: { labels: [age] }
    mode: check                               # the site calculates it; compare with facts.age
    source: facts.age
    label: { en: Age, ta: வயது }
  - key: aadhaar
    find: { labels: [aadhaar number] }
    mode: user
    say: { en: Type your Aadhaar number yourself. I will not see or store it., ta: "ஆதார் எண்ணை நீங்களே தட்டச்சு செய்யுங்கள். நான் அதைப் பார்க்கவோ சேமிக்கவோ மாட்டேன்." }
  - key: save_next
    find: { selector: "button[name=save_next]" }
    mode: next
    say: { en: This page is done. Press Save & Next yourself., ta: "இந்தப் பக்கம் முடிந்தது. “Save & Next” பொத்தானை நீங்களே அழுத்துங்கள்." }
```

**Field properties**

| Property | Meaning |
|---|---|
| `key` | Unique within the form |
| `find.selector` / `find.labels` | Exact CSS selector (preferred when the department gives ids) or label hints in any language. At least one is required |
| `mode` | `fill` (widget fills, user confirms), `check` (site fills, widget verifies), `attach` (attach a document the user gave Urimai), `user` (the user's own step), `next` / `submit` (a button only the user presses) |
| `kind` | `text`, `name_native`, `name_latin`, `digits`, `mobile`, `pincode`, `email`, `date`, `choice`, `address`. Drives how spoken replies are normalised and checked |
| `format` | `upper`, `lower`, or a date format such as `dd/mm/yyyy` |
| `source` | `ask` (widget asks), `facts.<name>` (from the confirmed eligibility facts), `carried.<key>` (applicant details carried in the handoff with consent; later) |
| `map` | Converts a fact value to the form's option (for example `madurai` → `Madurai`) |
| `optional` | The user may say "skip" |
| `label`, `ask`, `say`, `help` | Hand-written `Text`. `help` explains an unfamiliar question when the user asks "what is this?" |

**Validation at startup (fail fast):** `scheme_id` exists; keys unique; every field has `find`; `facts.<name>` is a real `Facts` field; `mode: user` for any field whose hints or selector match the sensitive detector; exactly one `submit` field; `origins` are `self` or full `https://` origins.

### 5.2 Handoff

```python
class HandoffRequest(Strict):
    form_id: str
    lang: Literal["en", "ta"]
    facts: Facts                        # the confirmed answers; identity details are not part of Facts

class HandoffResponse(Strict):
    url: str                            # start_url + "#urimai=" + code
```

The server keeps `{code: (form_id, lang, facts, expires_at)}` for 10 minutes. Codes are `secrets.token_urlsafe(16)`.

### 5.3 Widget session and plan

```python
class SessionRequest(Strict):
    site_key: str
    code: str | None = None             # None = started from the page's own "Fill by voice" button
    lang: Literal["en", "ta"] | None = None

class PlanField(Strict):
    key: str; find: Find; mode: Mode; kind: Kind | None; format: str | None
    value: str | None                   # resolved from facts; never for user/next/submit fields
    options_hint: dict[str, str] | None
    label: Text | None; ask: Text | None; say: Text | None; help: Text | None; optional: bool

class Plan(Strict):
    form_id: str; title: Text; lang: Literal["en", "ta"]
    fingerprint: Fingerprint
    fields: list[PlanField]
    lines: dict[str, str]               # widget lines in lang
    token: str; expires_at: str         # session token for the voice routes, 60 minutes
    voice: VoiceAvailability            # {listen: bool, speak: bool, understand: bool, transliterate: bool}
```

### 5.4 Widget tab state (`sessionStorage["urimai-widget:<site_key>"]`)

```ts
type State = {
  v: 1                                  // schema version; discard on mismatch
  plan: Plan
  done: Record<string, true>            // field keys finished
  values: Record<string, string>        // confirmed values for fill fields only (never sensitive)
  pending: string | null                // field whose change may reload the page
  nav: string | null                    // button the user was asked to press
  log: Message[]                        // transcript to restore after reloads (last ~100)
  startedAt: number; lastActivity: number
}
```

---

## 6. Backend work

### 6.1 Form registry
- `backend/app/forms/loader.py`: read every `content/forms/*.yaml`, validate with the contract, cross-check `scheme_id` against the loaded schemes, and build lookups by `form_id`, `scheme_id` and `site.key`.
- Read once at startup, like `content.router`, so a broken file stops the app before anyone sees it.

### 6.2 Handoff and session store
- `backend/app/handoff/store.py`: an in-memory store with a lock. It holds codes (10 minutes, single use) and sessions (60 minutes, plus a 30-minute idle timeout). Expired entries are purged on every access.
- Nothing is written to the database or logs. A server restart loses codes and sessions, and the widget then says the link expired and offers "Fill by voice" without carried values.

### 6.3 Routes

Register all of these **before** the static mount at `/`.

| Route | Called by | Notes |
|---|---|---|
| `GET /api/forms?scheme_id=` | Website | `[{form_id, title, start_url}]` |
| `POST /api/handoff` | Website | Body as 5.2. Same origin only |
| `POST /api/widget/session` | Widget | Checks `Origin` against `site.origins` (`self` = the server's own origin). Code: unused, unexpired, same site key. Returns the plan |
| `POST /api/widget/listen` | Widget | Multipart audio (up to about 30 s) and `Authorization: Bearer <token>`. Returns `{text}`. Without a key: `503 {"error":"key_not_set"}` |
| `POST /api/widget/speak` | Widget | `{text, lang}` and token. Returns audio. Fixed lines are cached by text hash |
| `POST /api/widget/understand` | Widget | `{field: {key, kind, label, options}, expecting: "confirm" \| "value" \| "done", utterance, lang}` and token. Returns `{intent, value?}`. Rules first, AI only if needed (6.5) |
| `POST /api/widget/transliterate` | Widget | `{text, to: "latin"}` and token. Returns `{text}` |
| `POST /api/widget/end` | Widget | Ends the session |
| `/widget/v1/widget.js` | Pages | Static file. `Cache-Control: public, max-age=300` during the hackathon |
| `/portal/...` | Browser | Practice portal |

**Cross-origin requests:** only for routes under `/api/widget/`, and only for registered origins. Answer `OPTIONS` preflights for `Content-Type` and `Authorization`, and reflect the exact origin, never `*`. The practice portal is same-origin, so it needs none of this. The tests serve a fixture page from a second port to exercise the cross-origin path.

**Cost control:** each session token allows at most about 60 listen, 120 speak and 60 understand calls. A simple per-IP limit applies to `/api/widget/session`. These protect the Sarvam credits.

### 6.4 Voice for the widget
Reuse the voice block (`backend/app/voice/`) when it exists: Saaras for listening in `codemix` mode, Bulbul for speaking. If it does not exist yet, build the widget routes against the same adapter interfaces with fakes, so the voice block can be dropped in. Check which audio formats Saaras accepts and convert in the backend if the browser's recording format is not accepted.

### 6.5 Understanding replies
1. **Rules first, no key needed.** Recognise these in Tamil, English and Tamil typed in English letters:
   - yes / no;
   - done;
   - repeat;
   - skip;
   - stop;
   - go back;
   - "what is this?";
   - option names by fuzzy match.

   Examples: ஆமாம், ஆம், சரி, aamaa, sari, yes, ok / இல்லை, illa, no / முடிந்தது, முடிஞ்சது, ஆச்சு, done / மீண்டும், repeat.
2. **Normalise values by `kind`:**
   - `digits`, `mobile` and `pincode` keep digits only;
   - `email` turns "at" into @ and "dot" or புள்ளி into a full stop, and removes spaces;
   - `name_latin` uses transliteration;
   - `date` accepts dd/mm/yyyy, "14 March 1968" and similar;
   - `choice` goes to the option match.
3. **AI fallback** (key set) for anything the rules cannot parse: Tamil number words ("ஐம்பத்தெட்டு"), spoken dates, "change the age to 59". The prompt contains only the utterance, the field's label, kind and options, and the expected intent. It returns JSON, which is validated before use. Page text is never included (R8).
4. Every normalised value is **read back and confirmed** before it counts (R3).

### 6.6 Practice portal (`backend/app/portal/`)
A FastAPI router at `/portal/` with Jinja2 templates. Vendored, minified jQuery 3.7.1, jQuery UI 1.13.2 and Select2 4.0.13 go under `portal/static/vendor/`, with their licences and a note of the versions. Each page carries a red **"DEMO – not a government site"** banner and the one widget line. It uses common older-government patterns so the widget is tested on them:

- **Page 1, applicant:**
  - name in English capitals (uppercased as typed), name in Tamil, husband's name;
  - gender radio buttons;
  - date of birth as a **read-only jQuery UI calendar**, with Age filled by the page;
  - marital status list and a searchable **Select2** community list;
  - mobile number that blocks non-digit keys and checks on leaving the box;
  - Aadhaar number box;
  - **District → Taluk → Village** lists that each **reload the page**;
  - door number, street and pincode inside a **same-site frame**;
  - Save & Next button.
- **Server checks on Save & Next:**
  - English-capitals name;
  - age 18 and over, and matching the date of birth;
  - mobile number, 12-digit Aadhaar, pincode and village.

  Errors re-show the page with an error summary and messages beside the fields. Values are kept, except Aadhaar.
- **Page 2, documents:**
  - two file uploads with type and size checks;
  - a declaration checkbox;
  - an image captcha with a refresh link;
  - the Submit button.
- **Page 3:** acknowledgement with a demo reference number such as `DEMO/2026/004821`.
- **State:** page-1 data is held in memory per browser cookie, for the demo only. Nothing goes to the database.

The real e-Sevai REV-202 field list is not public. The portal is modelled on common patterns and must not imitate the real e-Sevai look or name.

### 6.7 Dependencies and configuration
- Add `Jinja2` and `python-multipart` (needed for the portal's uploads and the widget's audio) to `backend/requirements.txt`, pinned to current releases.
- No new environment variables are required. If one is added later, it needs entries in both `docker-compose.yml` (empty default) and `.env.example`.

---

## 7. Widget work

### 7.1 Package and build
- `widget/package.json`: TypeScript, Vite in library mode, producing one **IIFE** file `widget.js`. Target `es2018` for older phones. No runtime dependencies.
- Dev dependencies: Vitest (unit tests) and `@playwright/test` (end-to-end).
- Scripts:
  - `npm run build` outputs `dist/widget.js`;
  - `npm test` runs unit tests;
  - `npm run e2e` runs the end-to-end tests, always with `--trace off` unless debugging.
- A build flag `__URIMAI_TEST__` exposes `window.__urimaiTest` (state and simulated replies) only in test builds.

### 7.2 Modules

```
widget/src/
├─ main.ts            entry: read script tag, wait for window load (frames), boot
├─ config.ts          API origin (from the script's own src), site key, version
├─ api.ts             session, listen, speak, understand, transliterate, end (token handling, retries, offline detection)
├─ state.ts           sessionStorage load/save, schema version, timeouts, clear
├─ dom/
│   ├─ documents.ts   main document + same-origin frames
│   ├─ labels.ts      label text for a control (label[for], wrapping label, aria-label, placeholder, name, table row cell, .form-group label)
│   ├─ locate.ts      selector or label-hint match with scoring and word boundaries; fingerprint check
│   ├─ sensitive.ts   sensitive-field detector and guarded value access (R1)
│   ├─ act.ts         fill text, choose option, radio, date, attach file; realm-safe setters and events
│   ├─ widgets/       handlers per library: jquery-ui-datepicker.ts, select2.ts, native-date.ts (add more as forms need)
│   └─ verify.ts      read back, site error detection (jQuery Validate, nearby error text, HTML validity), page error summary
├─ flow/
│   ├─ runner.ts      per-page ordering, field loop, page-load recovery, finish
│   └─ field.ts       one field: act → verify → confirm → retry
├─ talk/
│   ├─ turns.ts       listen()/hear() turn-taking, phases (confirm, value, user, nav)
│   ├─ intents.ts     rule-based intents and normalisers (6.5 step 1–2)
│   ├─ mic.ts         push-to-talk recording (MediaRecorder), 30 s cap, silence handling
│   └─ speaker.ts     play TTS; stop on barge-in; mute toggle
└─ ui/
    ├─ panel.ts       shadow-DOM panel, launcher, minimise/dock, phone bottom sheet
    ├─ transcript.ts  messages, tags (filled, your part, checked), warnings
    ├─ controls.ts    mic button, quick replies (yes/no/done/repeat + options for choice fields), text box
    └─ highlight.ts   outline colours: amber = now, green = done, blue = your part; scroll into view (also inside frames)
```

### 7.3 Boot
1. Wait for `window` `load`, so frames are ready.
2. If `#urimai=<code>`: remove it with `history.replaceState`, start a new session with the code, and save state.
3. Else, if tab state exists for this site key and is not expired: restore the transcript and run page-load recovery (7.7).
4. Else: show the "Fill by voice" launcher only.
5. If the session request fails (expired or used code, network): explain, and offer "Fill by voice" without carried values.
6. If the page fingerprint matches fewer than `min_match` labels, switch to **guidance mode**: speak each step, highlight where possible, and fill nothing.

### 7.4 Finding fields
- A `selector` wins. Otherwise score every `input` (not hidden), `select` and `textarea` in the page and same-origin frames by the **longest label hint** found in its label text.
- Latin hints match on **word boundaries** ("age" must not match "village"). Other scripts match as substrings.
- A control's label text joins:
  - `label[for=id]` and any wrapping `<label>`;
  - `aria-label`, `placeholder` and `name`;
  - the **first table cell in the same row that does not contain the control**, which is common on old forms;
  - the `.form-group` label.
- **Select2**: the real `<select>` has class `select2-hidden-accessible`. Act on it, and highlight the next sibling (`.select2-container`).
- **Radio groups**: locate any member, then act on the group by `name`.
- Cross-origin frames cannot be reached. Treat their fields as the user's part and say so.

### 7.5 Filling fields

| Control | How | Then |
|---|---|---|
| Text / textarea | Focus, set the value with the **native setter of the control's own window**, fire `input` and `change`, then blur, so the site's own `oninput`, `onblur` and jQuery Validate run | Check `maxlength`; read back |
| Uppercase / format | Apply the `format` before filling; the site's own transforms still run | Read back the final value |
| `<select>` | Match option text or value (exact, then contains), with the form map's `map` and `display` first. **Wait up to 5 s** for options that load later. Save `pending` **before** firing `change`, in case the page reloads | Read back the selected text |
| Select2 / searchable list | Same as `<select>`; the native `change` updates Select2's display | Highlight the container |
| Radio | Click the matching radio (by value or label text) | Check `checked` |
| jQuery UI calendar (read-only input with class `hasDatepicker`) | Open it with the page's own jQuery (`datepicker('show')`), set the year and month lists, click the day, so the site's `onSelect` runs (for example to fill Age) | Read back; then any `check` field verifies the computed value |
| `<input type=date>` | Set `yyyy-mm-dd`, fire `input` and `change` | Read back |
| Three separate day/month/year lists | Treat as three `choice` fields in the form map | |
| File, `attach` mode (later) | After a yes, build a `File` in the control's window, put it in a `DataTransfer`, assign `input.files`, fire `change` | Read the site's own message (for example "✓ file.pdf (1 KB)") |
| File, `user` mode | Highlight, ask the user to upload, wait for "done" | Check a file is attached (count only) |
| Checkbox | Declarations are `user`. Other checkboxes: click and confirm | Check `checked` |

### 7.6 Verifying
- **Read back** what the page now shows (selected option text, checked radio label, file name, field value) and ask "is this right?". Never read back sensitive fields.
- **Site errors after filling**, in order:
  - if jQuery Validate is active on the form, call `$(el).valid()` and read `[data-valmsg-for=name]`;
  - otherwise compare error text near the control (`.err`, `.error`, `.field-validation-error`, `.invalid-feedback`, `.msg-bad`) **before and after** filling, so old server messages are not mistaken for new ones;
  - then the browser's own `validity`.

  On an error, say the site's message, ask again, and refill.
- **After a page load**, look for a page error summary (`.summary`, `.validation-summary-errors`, `.alert-danger`) and announce it.

### 7.7 Running a page
- **Order on each page:** `fill` / `check` / `attach` fields first, then `user` fields, then `next` / `submit`, each in form-map order. Doing the user's own fields last stops reloading lists from wiping what the user typed.
- **Per field:** highlight, act, verify, confirm (yes = done; no = ask for the value and repeat), with up to 5 attempts, then "please fill this one yourself".
- **Buttons:** highlight, say "press it yourself", set `nav`, and wait. The widget does nothing else until the page changes.
- **On every page load:**
  - if `nav` is set and that button is gone, mark it done;
  - for each finished field on this page:
    - if an error now shows beside it, mark it not done;
    - if it is a `fill` field whose value no longer matches the confirmed value, mark it not done and refill without asking again;
    - if it is a `user` field that is now empty (an emptiness check only, R1), mark it not done and ask the user to redo it.
- **Finish:** when every field is done, read a visible reference number (common patterns: "Acknowledgement No", "Reference", "Application No") and say it. Clear the tab state and end the session.

### 7.8 Conversation and voice
- **Phases:** `confirm` (yes/no), `value` (a value for a field), `user` (waiting for "done"), `nav` (waiting for a button press).
- **Replies:** microphone (push-to-talk; the button turns red while recording; tap again or 30 s to stop), quick replies (yes, no, done, repeat, plus the options for choice fields, so tapping works without voice), or the text box.
- **Commands anywhere:**
  - "repeat";
  - "stop";
  - "go back" (re-opens the previous field);
  - "change <field> to <value>";
  - "what is this?" (reads `help`);
  - "skip" (only for optional fields).
- **Speaking:** fixed lines come from the widget lines. Values are spoken dynamically. Names in English letters are spelled out letter by letter for confirmation.
- **Names in English letters:** take the name the user confirmed in Tamil, transliterate it, then confirm the spelling. Without a key, ask the user to type or spell it.
- **No key:** no microphone button. Quick replies and the text box only, and a notice "Voice is not set up. You can tap or type."
- **Silence:** after about 20 s with no reply, repeat the question once more simply. After about 30 minutes idle, pause and keep the state.
- **Language:** the plan's `lang` (from Urimai, or chosen on the launcher). A language switch mid-form re-renders lines and keeps progress.

### 7.9 Interface
- **Isolation:** everything in an open **shadow root** attached to one host element, so the site's styles and ours never clash. Use system and Noto fonts with Tamil coverage.
- **Desktop:** panel bottom-right, about 380 px wide, with a **minimise** button and a **dock left/right** toggle so it never hides the field being filled. Scroll the current field to about one third from the top, accounting for the panel.
- **Phone:** bottom sheet covering about half the screen. Scroll the current field to just below the top.
- **Accessibility:** large text, high contrast, 44 px touch targets, an `aria-live` region for new messages, keyboard focus order, and a reduced-motion setting.
- **Progress:** "Form 8 / 22" with a bar. Messages are tagged *filled*, *your part* or *checked*. Warnings get an amber border.

### 7.10 Safety enforcement (R1, R2)
- **Sensitive detector** (`dom/sensitive.ts`). A control is sensitive if any of these holds:
  - `type=password`;
  - `autocomplete` is one of `one-time-code`, `current-password`, `new-password`, or starts with `cc-`;
  - its name, id or label matches `aadhaar|aadhar|\buid\b|otp|one.?time|captcha|security code|password|passwd|\bpin\b(?!\s*code)|cvv|card number|account (no|number)|ifsc`, in any letter case, plus Tamil equivalents (கடவுச்சொல், ஆதார், OTP).

  The form map loader rejects maps that give such a field any mode other than `user`.
- **Guarded access:** all reads and writes of `.value`, `.checked` and `.files` go through `act.ts`. It refuses sensitive controls, except an emptiness check for `user` fields.
- **No form sending:** the widget never calls `click()` on `button`, `input[type=submit]`, `input[type=image]` or links, and never calls `form.submit()` or `requestSubmit()`. Allowed clicks are radio inputs and their labels, checkboxes that are not declarations, and calendar day cells inside the calendar's own container.
- No `eval`, no `new Function`, no code loaded at run time, no `postMessage` listeners.

### 7.11 State and privacy
- `sessionStorage` only. No `localStorage`, cookies or IndexedDB.
- Clear on finish, on "stop", on closing the panel and confirming, after 60 minutes, or after 30 minutes idle on the next load.
- Values in state are confirmed `fill` values only, never sensitive ones.
- Network calls carry the session token. Audio and text go to Urimai's server only.

---

## 8. Website changes
- `api.ts`: add `getForms(schemeId)` and `startHandoff(formId, lang, facts)`.
- `Results.tsx`: under "How to apply", show **"Fill the application with Urimai"** when a form exists and the outcome is not `appears_ineligible`. Explain in one line that the user logs in and submits themselves.
- Open the new tab **synchronously in the click handler**, then set its location after the handoff call. If the call fails, close the tab and show an error.
- Add the strings to `content/lines/en.yaml` and `ta.yaml`. The existing test that keeps English and Tamil keys in step covers them.

---

## 9. What a department does (the onboarding checklist)
1. Add the script line to each form page, with its site key. Or host `widget.js` itself after review, pinned with a Subresource Integrity hash.
2. Allow it in the site's security headers:
   - `script-src` includes the widget host (unless self-hosted);
   - `connect-src` includes the Urimai API host;
   - `Permissions-Policy` does not block `microphone` on those pages.
3. Register the site's exact origins and form pages, and confirm the form map (field ids are best; labels work).
4. Test on a staging copy with sample data. Sign the no-objection and data-handling note: the widget fills only confirmed values, never touches sensitive fields or submits, and stores nothing after the session.

---

## 10. Edge cases

**Must** = needed for the 30 Nov demo. **Later** = after the hackathon.

| Area | Case | Expected behaviour | When |
|---|---|---|---|
| Finding | Label in the next table cell, not in `<label>` | Found through the row's first other cell | Must |
| Finding | Only a placeholder, no label | Placeholder is part of the label text | Must |
| Finding | Two fields share a word ("Name", "Husband's Name") | Longest hint wins; form map uses specific hints or selectors | Must |
| Finding | "age" inside "village" | Word-boundary matching | Must |
| Finding | Labels are images, or the page is in another language | Form map uses selectors | Later |
| Finding | Field inside a same-site frame | Searched and filled using the frame's own window | Must |
| Finding | Field inside a frame from another site | Cannot be reached; treated as the user's part | Later |
| Finding | Page redesigned (fingerprint fails) | Guidance mode; no filling | Must |
| Text | `maxlength`, key-blocking scripts, auto-uppercase | Value set directly; site handlers still run; length checked | Must |
| Text | Input masks (for example `__/__/____`) | Type character by character via a mask handler | Later |
| Text | Field accepts only English letters, user gives a Tamil name | Transliterate, spell out, confirm | Must (with key) |
| Lists | Options load after a previous choice (AJAX) | Wait up to 5 s, then say "not in the list" and read the options | Must |
| Lists | Choosing reloads the page (postback) | Save `pending` first; resume after reload and confirm | Must |
| Lists | Spoken option differs from option text (district slug, Tamil vs English) | `map`, `display` and fuzzy matching; read options on failure | Must |
| Lists | Select2, Chosen or a custom dropdown made of `div`s | Select2 handled; others need a handler per library | Select2 Must; others Later |
| Dates | Read-only jQuery UI calendar with a computed age | Operate the calendar; verify age with a `check` field | Must |
| Dates | `type=date`, Bootstrap datepicker, three separate lists | Native handled; others by handler or as three list fields | Native Must; others Later |
| Dates | Spoken date ("பதினாலு மார்ச் அறுபத்தெட்டு") | AI normalises; read back as dd/mm/yyyy; confirm | Must (with key) |
| Radio/checkbox | Gender, yes/no radios | Click matching radio; confirm label | Must |
| Radio/checkbox | Declaration | Always the user's | Must |
| Files | User uploads | Wait for "done"; check a file is attached | Must |
| Files | Attach a document the user gave Urimai | Ask, attach, read the site's message | Later |
| Files | Site rejects type or size | Read the message; ask the user to choose another file | Later |
| Files | Reload clears chosen files | Uploads are done after list reloads (ordering) | Must |
| Validation | Client-side error (jQuery Validate, inline messages) | Say it, ask again | Must |
| Validation | Server error summary after Save & Next | Announce; un-finish fields with errors; redo them | Must |
| Validation | Wrong captcha | Server error; the user retypes | Must |
| Navigation | Multi-page form | Continue on the next page from tab state | Must |
| Navigation | Back button, refresh, opening the form in another tab | Restore from tab state; a new tab gets a new session | Later |
| Navigation | Session timeout on the site, user logged out | Explain; the user logs in again; continue | Later |
| Sensitive | Password, OTP, Aadhaar, captcha, bank details | Never read or filled; user's part (R1) | Must |
| Sensitive | Hidden sensitive field the form map forgot | Detector still blocks it | Must |
| Voice | No key | Tap and type only, with a notice | Must |
| Voice | Noise, unclear audio, silence | "Please say that again"; repeat once; tap fallback | Must |
| Voice | Mixed Tamil-English, Tamil number words | Codemix listening; AI normalising; confirmation | Must (with key) |
| Voice | User says "no" after a fill | Ask for the right value; refill | Must |
| Voice | "change the age to 59" mid-form | Jump to that field, refill, return | Later |
| Network | Request fails mid-form | Explain; keep state; retry when online | Must |
| Network | Server restarted, session lost | Ask to restart from Urimai or continue without carried values | Must |
| Interface | Panel covers the field | Minimise and dock; scroll offset | Must |
| Interface | Old site not built for phones | Bottom sheet; field scrolled above it | Must |
| Interface | Site CSS or scripts clash | Shadow DOM; no globals except `window.UrimaiWidget` | Must |
| Fonts | Old non-Unicode Tamil fonts on the site | Detect garbled label text; fall back to selectors | Later |
| Abuse | Another site uses our script or site key | Origin check on session; token required for voice; rate limits | Must |
| Abuse | Page text tries to instruct the AI | Page text never sent to the AI (R8) | Must |

---

## 11. Testing

### 11.1 Backend (pytest)
- **Form maps:**
  - all files load;
  - `scheme_id` exists;
  - sensitive-looking fields are `user`;
  - `facts.<name>` references exist;
  - English and Tamil widget lines have the same keys.
- **Handoff and sessions:**
  - a code works once;
  - an expired code fails;
  - a code for another site key fails;
  - a wrong `Origin` gets 403;
  - `self` works same-origin;
  - tokens expire;
  - rate limits apply;
  - no personal values appear in logs (capture log output in the test).
- **Routes:** `/api/forms` filters by scheme; widget routes return `key_not_set` without a key.
- **Portal:** pages render; postback keeps values; server checks reject bad values; acknowledgement after valid submit.

### 11.2 Widget unit tests (Vitest)
- `labels` and `locate`:
  - table-row labels;
  - placeholders;
  - word boundaries;
  - longest hint;
  - frames (jsdom with same-origin iframes).
- `intents`: Tamil, English and Tamil-in-English-letters yes/no/done/repeat; digits, email and date normalisers.
- `sensitive`: every pattern, including "pin code" **not** counted as a PIN.

### 11.3 End-to-end (Playwright, `widget/tests/e2e`)
- **Fixtures**, served on a second port to exercise cross-origin:
  1. the practice portal (from the backend);
  2. a static replica of a CPGRAMS-style registration page (jQuery Validate, Select2 lists loaded by AJAX, an OTP and password step), marked "REPLICA";
  3. a React form, to check that framework state registers filled values;
  4. small single-purpose pages: input mask, type=date, cross-origin frame, page with a sensitive field missing from the map.
- **Driver:** a test build exposes `window.__urimaiTest.state()` and `.hear(text)`. The test plays the user:
  - it answers in phases;
  - it gives a wrong mobile number once, a "no" with a correction once, and a short Aadhaar once;
  - it types the captcha (read from a test-only endpoint in the fixture server);
  - it uploads the photo, ticks the declaration and presses the buttons.
- **Assertions:**
  - the server received exactly the expected values;
  - the acknowledgement appears;
  - the widget never submitted or clicked a button: wrap `HTMLFormElement.prototype.submit`/`requestSubmit` and listen for `submit` events not preceded by a test click;
  - the widget never read a sensitive value: in the fixture, redefine the `value` getter on sensitive inputs to record any access during widget activity;
  - no page errors.
- **Phone:** run the main story in a Pixel-sized viewport; check that the current field is visible above the bottom sheet.

### 11.4 Manual checks
- Real speech in Tamil and English with the Sarvam key: names, numbers, dates, noise.
- Android Chrome on a low-end phone; a desktop browser; the Docker build from a clean checkout with no `.env`.

---

## 12. Build order

Each step ends with something that runs and is tested. Steps 1–7 are the **30 Nov demo**. Step 8 is done as time allows; its safety tests are required.

| Step | Work | Done when |
|---|---|---|
| 1 | **Contracts and form map:** `forms.py`, `handoff.py`, the practice form map, widget lines (en, ta), loader with validation | pytest passes for loading and validation |
| 2 | **Handoff and sessions:** store, `/api/forms`, `/api/handoff`, `/api/widget/session`, origin checks | pytest passes for single use, expiry, origin, site key |
| 3 | **Practice portal:** three pages, vendored libraries, postbacks, frame, server checks, acknowledgement, demo banner, widget line | A person can complete it by hand; portal tests pass |
| 4 | **Widget skeleton:** build, boot, state, shadow-DOM panel, launcher, transcript, quick replies, text box; text fields and confirmation | The widget fills and confirms the name fields on the portal by tapping |
| 5 | **Field handlers and verification:** lists (wait, postback), Select2, radio, jQuery UI calendar, frame, user steps, buttons, error reading, page-load recovery, ordering, sensitive detector | End-to-end test of the full portal story passes by tapping and typing |
| 6 | **Website and Docker:** results button, handoff call, new tab; Dockerfile builds the widget and serves `/widget/v1/widget.js`; README and CLAUDE.md commands | `docker compose up --build` from a clean checkout runs the whole story with no key |
| 7 | **Voice:** listen, speak, understand, transliterate routes on the voice block; microphone, speaker, no-key mode | With a key, the story works by speaking Tamil; without a key, nothing breaks |
| 8 | **Hardening:** the "never" tests, the CPGRAMS-style and React fixtures, phone viewport, minimise/dock, rate limits, the edge cases marked Must | All end-to-end tests pass |

**Dockerfile change** (outline):

```dockerfile
FROM node:24-slim AS widget
WORKDIR /widget
COPY widget/package.json widget/package-lock.json ./
RUN npm ci
COPY widget/ ./
RUN npm run build

# in the final Python stage, before USER nobody
COPY --from=widget /widget/dist/widget.js ./widget_dist/v1/widget.js
```

In `main.py`, mount `/widget` from `widget_dist/` (when present) and include the portal router, both **before** the static mount at `/`.

---

## 13. Reference code from the prototype

These pieces were tested on 28 Nov against the replica forms. Port them into the modules above.

**Set a value so the site and frameworks notice (works inside frames):**

```ts
const win = (el: Element) => el.ownerDocument.defaultView!
function setNative(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, v: string) {
  const W = win(el) as typeof window
  const P = el.tagName === 'TEXTAREA' ? W.HTMLTextAreaElement : el.tagName === 'SELECT' ? W.HTMLSelectElement : W.HTMLInputElement
  Object.getOwnPropertyDescriptor(P.prototype, 'value')!.set!.call(el, v)
}
const fire = (el: Element, ...types: string[]) =>
  types.forEach((t) => el.dispatchEvent(new (win(el) as typeof window).Event(t, { bubbles: true })))
function typeText(el: HTMLInputElement, v: string) {
  el.focus(); setNative(el, v); fire(el, 'input', 'change'); el.blur()   // runs the site's oninput/onblur checks
}
```

**Choose an option, waiting for lists that load later; survive a page reload:**

```ts
async function chooseOption(el: HTMLSelectElement, wants: string[], fieldKey: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const find = () => [...el.options].find((o) => o.value && wants.some((w) => norm(o.text) === norm(w) || norm(o.value) === norm(w)))
               ?? [...el.options].find((o) => o.value && wants.some((w) => norm(o.text).includes(norm(w))))
  let opt = find()
  for (let t = 0; !opt && t < 25; t++) { await sleep(200); opt = find() }
  if (!opt) return 'not in list'
  if (el.value === opt.value) return null
  state.pending = fieldKey; save()           // the page may reload right after the change event
  setNative(el, opt.value); fire(el, 'change') // jQuery and Select2 handlers also receive native events
  return null
}
```

**Operate a jQuery UI calendar so the site's own `onSelect` runs:**

```ts
async function pickDate(el: HTMLInputElement, dmy: string) {
  const $ = (win(el) as any).jQuery; const [d, m, y] = dmy.split('/').map(Number)
  $(el).datepicker('show'); await sleep(250)
  const dp = el.ownerDocument.getElementById('ui-datepicker-div')!
  const ys = dp.querySelector<HTMLSelectElement>('.ui-datepicker-year'); if (ys) { ys.value = String(y); fire(ys, 'change'); await sleep(200) }
  const ms = dp.querySelector<HTMLSelectElement>('.ui-datepicker-month'); if (ms) { ms.value = String(m - 1); fire(ms, 'change'); await sleep(200) }
  const day = [...dp.querySelectorAll<HTMLAnchorElement>('td[data-handler=selectDay] a')].find((a) => a.textContent!.trim() === String(d))
  if (!day) return 'day not available'
  day.click(); await sleep(250); return null
}
```

**Attach a file the user gave Urimai (later milestone):**

```ts
async function attachFile(el: HTMLInputElement, file: { name: string; type: string; url: string }) {
  const W = win(el) as typeof window
  const blob = await (await fetch(file.url)).blob()
  const dt = new W.DataTransfer(); dt.items.add(new W.File([blob], file.name, { type: file.type }))
  el.files = dt.files; fire(el, 'input', 'change')
}
```

**Detect the site's own error for this field (new messages only):**

```ts
function siteError(el: HTMLInputElement, before: string): string | null {
  const $ = (win(el) as any).jQuery
  try {
    if ($ && el.form && $(el.form).data('validator') && !$(el).valid())
      return el.ownerDocument.querySelector(`[data-valmsg-for="${CSS.escape(el.name)}"]`)?.textContent?.trim() || 'invalid'
  } catch {}
  const now = errorTextNear(el)             // .err, .error, .field-validation-error, .invalid-feedback, .msg-bad in the same cell/group
  if (now && now !== before) return now
  if (el.validity && !el.validity.valid && el.value) return el.validationMessage
  return null
}
```

**Page ordering and page-load recovery:**

```ts
const rank = (f: PlanField) => ({ user: 1, next: 2, submit: 2 } as Record<string, number>)[f.mode] ?? 0
const nextField = () => plan.fields.filter((f) => !state.done[f.key] && locate(f)).sort((a, b) => rank(a) - rank(b))[0]

function onPageLoad() {
  if (state.nav) { const f = byKey(state.nav); if (f && !locate(f)) state.done[f.key] = true; state.nav = null }
  for (const f of plan.fields) {
    const el = locate(f); if (!el || !state.done[f.key] || f.mode === 'next' || f.mode === 'submit') continue
    if (errorTextNear(el)) { delete state.done[f.key]; continue }
    if (f.mode === 'user' && isEmpty(el)) { delete state.done[f.key]; continue }     // emptiness only
    if (f.mode === 'fill' && !sameAsConfirmed(el, f, state.values[f.key])) delete state.done[f.key]
  }
  save()
}
```

---

## 14. Out of scope and open questions
- **Not in this plan:**
  - returning the reference number to the Urimai website automatically;
  - the desktop extension;
  - phone apps;
  - real department pilots;
  - Hindi and Telugu (they come with the app-wide language work);
  - attaching documents captured in Urimai (step 8 or later).
- **Open:**
  - the real REV-202 form fields;
  - which audio format Saaras accepts from browsers;
  - whether `Facts` should carry gender (the widget asks for it today);
  - how applicant identity details may be carried in the handoff with consent instead of being asked on the form (`source: carried.*`).
