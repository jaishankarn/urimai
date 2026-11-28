# Urimai: How It Works

**Your Voice. Your Rights. Your Benefits.**

Urimai is a voice-first website that helps people in India find the government benefits they may qualify for, prepare for them, and apply. The user talks in their own language (Tamil first). Urimai finds the right schemes and explains the documents needed. Then the **Urimai voice form widget**, embedded on the application website, **fills the real application form by voice** while the user confirms each detail. The user always logs in, handles OTP, captcha and Aadhaar, and presses Submit.

Detailed build plan for the widget: [voice-form-widget-plan.md](voice-form-widget-plan.md). What changed and why: [architecture-changes.md](architecture-changes.md). Data and search: [data and search design](superpowers/specs/2026-11-28-data-and-search-design.md).

---

## 1. What the user experiences

1. **Choose a language** and hear a greeting (Tamil, Hindi, Telugu or English).
2. **Tell their story** by speaking: "I am 58, my husband passed away, is there any help?" The words appear on screen.
3. **Confirm the details.** Urimai reads back age, marital status and place. The user corrects anything by voice. Nothing is assumed.
4. **See matching schemes.** Each is marked *may be eligible*, *needs more information* or *appears not eligible*, with a plain reason. Urimai never says "approved".
5. **Get ready.** Urimai explains the documents one at a time and where to get any that are missing.
6. **Apply.** Urimai asks: "Shall we fill the application now?" On yes, it opens the application page. The widget on that page greets the user by name.
7. **The widget fills, the user confirms.** It fills each field it already knows, highlights it and asks "சரியா?" (is this right?). It asks by voice for anything new and fills the answer. If the website rejects a value, it reads out the site's message and asks again. For login, OTP, captcha, Aadhaar, uploads (unless the user gave Urimai the document) and Submit, it says "this part is yours" and waits.
8. **Finish.** The user presses Submit and gets the department's acknowledgement. Urimai shows progress as *reported by you*.

Anyone on a page with the widget can also tap **"Fill by voice"** without having used Urimai first.

## 2. What Urimai is, and is not

- The widget **fills only values the user has confirmed**, and reads each one back.
- It **never** logs in, never reads or fills passwords, OTPs, captcha or Aadhaar numbers, and never presses Submit or any other button that sends the form.
- Urimai does **not** guarantee any benefit and never says "approved".
- Urimai does **not** ask for Aadhaar numbers, OTPs or bank details for finding benefits.
- Progress the user reports is kept separate from anything officially verified.
- The demo uses a **practice portal we built**, clearly marked "Demo – not a government site". There is no integration with any real portal until a department embeds the widget.

---

## 3. The building blocks

Each block is built and tested **on its own**, with pretend ("fake") versions of the others, then plugged together.

| # | Block | Its one job | Needs an API key? |
|---|---|---|---|
| 1 | **Scheme library** | Reviewed scheme rules, benefits, documents, sources, and the **form maps** the widget uses | No |
| 2 | **Eligibility checker** | Compares confirmed details with each scheme's rules; gives one of three answers | No |
| 3 | **Knowledge search** | Finds official text for a question | No |
| 4 | **Voice** | Turns speech into text and replies into speech | Yes |
| 5 | **Conversation brain** | Runs the journey: what to ask next, when to confirm, when to explain | Yes for the real AI |
| 6 | **Handoff** | Passes confirmed details to the widget with a one-time code | No |
| 7 | **Practice portal** | A demo application website with common government form patterns, marked Demo | No |
| 8 | **Voice form widget** | Embedded on an application page; fills the form by voice while the user confirms. Never logs in or submits | Uses the voice block |
| 9 | **Saved progress** | Remembers the journey with consent; delete button | No |
| 10 | **Website screens** | Home, Discover Benefits, My Journey, My Profile, the microphone | No |

Without any API key the site still opens, shows schemes, checks eligibility from typed or tapped answers, and the widget fills the practice portal using tap and typed replies. Anything needing a key shows a plain message such as "Sarvam key not set".

---

## 4. What we use

| Purpose | What we use | Notes |
|---|---|---|
| Listening | **Sarvam Saaras** | Tamil mixed with English words |
| Speaking | **Sarvam Bulbul** | Natural Tamil, Hindi, Telugu, English |
| Conversation AI | **Sarvam-105B** | Understands the user and writes replies. Never decides eligibility |
| Database | **PostgreSQL with pgvector** | Rules, official text and vectors; holds no user data. See the data and search design |
| Search | Keyword search, plus semantic search with **multilingual-e5-small** inside the app only if it passes its test | No key needed |
| Backend / website | **FastAPI** (Python), **React** | Started with one `docker compose` command |
| Voice form widget | **TypeScript**, no framework, built as one small script file | Runs inside any page; its own look is isolated so it never clashes with the site |
| Practice portal | FastAPI pages with the same older libraries many government sites use | jQuery, jQuery UI date picker, Select2 |

All outside services sit behind swappable plugs. **Wispr Flow** is used by the team to build. It is not part of the app. Playwright is used only for tests.

**Language handling.** The AI reads Tamil directly and turns it into language-neutral details (numbers and fixed labels). Replies are written in Tamil from those details. Where a form needs English letters (for example a name field that accepts only A–Z), the widget converts the name to English letters and confirms it with the user by voice.

---

## 5. How each block works

### Scheme library
Reviewed rule files per scheme (`backend/app/content/schemes/`): conditions, amounts, documents, how to apply (including the e-Sevai service code), sources, and who reviewed them. Unreviewed rules never produce "may be eligible".

**Form maps** (`backend/app/content/forms/`) tell the widget how a specific application form works: which site and pages it is on, each field's label or id, where its value comes from, how to ask for it in each language, and which steps are the user's own. A form map is data only. The widget has no code for any particular site.

### Eligibility checker
Plain rules, no AI. For each scheme: *may be eligible*, *needs more information* (and what is missing), or *appears not eligible* (and why). It only uses details the user has confirmed.

### Knowledge search
Selected official text, searchable by keyword and, if it passes its test, by meaning. It always shows the source and date, and never changes an eligibility result. Details are in the data and search design.

### Voice
The user taps the microphone and speaks (up to about 30 seconds). The words show immediately. If audio is unclear, Urimai asks the user to repeat without losing the conversation. If speech fails, the user can tap or type. Fixed lines (greetings, read-backs, consent, widget steps) are hand-written in all four languages and recorded once.

### Conversation brain
Moves through the stages: welcome, understand, confirm, discover, prepare, hand off. One question at a time. Its conversation **ends at the handoff**, and the widget takes over on the application page.

### Handoff
When the user agrees to apply, Urimai creates a **one-time code** holding the confirmed details for that form. The user is sent to the application page with `#urimai=CODE` added. The part after `#` is never sent to the site's server. The widget exchanges the code for a short-lived session and removes it from the address. A code works once, expires in about 10 minutes, and only works for the site the form belongs to. Nothing is stored after that.

### Practice portal
Our own demo application website for the Destitute Widow Pension, at `/portal/`. It uses patterns common on older government sites: two pages, a calendar date picker, district and taluk lists that reload the page, a searchable list, an address section in a frame, file uploads, a declaration, an image captcha and a receipt. It is marked "Demo – not a government site" and loads the widget with the same one line a department would add.

### Voice form widget
A small script a department adds to its form pages with one line:

```html
<script src="https://<urimai-host>/widget/v1/widget.js" data-site-key="<key>" defer></script>
```

- It shows a "Fill by voice" button. If the user arrived from Urimai, it opens straight away and greets them by name.
- It finds each field by its id or its visible label, fills it the way a person would (including calendars and searchable lists), highlights it, and asks the user to confirm.
- It reads the site's own validation messages and server errors, explains them, and asks again.
- It survives page reloads and multi-page forms, and re-checks earlier values after each reload.
- It skips anything sensitive or final: login, OTP, captcha, Aadhaar, passwords, bank details, uploads the user did not give Urimai, declarations, and every Submit or Next button. For each it says "this part is yours" and waits.
- It works on phones (as a panel at the bottom of the screen) and computers, with nothing to install.

### Saved progress
Proposed to stay in the user's browser, with consent and a delete button; not built yet. The widget keeps its own state only for the current browser tab and clears it when the form is finished or closed.

### Website screens
Large text, one big microphone, a live transcript, and four sections: Home, Discover Benefits, My Journey, My Profile. Results show a **"Fill the application with Urimai"** button where a form map exists for that scheme.

---

## 6. How the pieces fit together

```
User's browser: Urimai website
   conversation + microphone
          |
   Conversation brain ---> Eligibility checker --> Scheme library (rules)
     |     |                Knowledge search -----> official text
     |     +--> Voice --> Sarvam (listen, speak, think)
     v
   Handoff (one-time code, confirmed details only)
     |
     v   (new tab)
Application page (practice portal now; a department's site once it embeds the widget)
   + Voice form widget  <--- exchanges the code, reads the form map, uses Voice
          |
          v
   User presses Submit --> the department's own server, as today
```

The conversation brain is the only block that knows the whole conversation. The widget is separate: its only links are the handoff, the form map and the voice services.

---

## 7. Where the widget runs

| Where | How | Status |
|---|---|---|
| **Any page that embeds it (computers and phones)** | The site adds one script line | **Primary.** Practice portal now; departments next |
| Desktop sites that have not embedded it | Optional browser extension using the same widget code | Later, if needed. Not needed for the hackathon |
| Phone apps | A Urimai app with a built-in browser, or a voice keyboard | Later |

**What a department does:** adds the script line (or hosts the file itself after a security review), allows the microphone and our address in its site security settings, registers its site and forms, and checks the field map.

**How a widget session ends:** the form is finished, the user says "stop" or closes the panel, about 30 minutes pass with no reply, or the session expires (60 minutes). Its tab state is then cleared.

---

## 8. Folder structure

```
urimai/
├─ docs/                      this file, the widget plan, the data and search design, sources
├─ backend/
│   ├─ app/
│   │   ├─ main.py            the only place blocks are wired together
│   │   ├─ contracts/         shared data shapes (facts, scheme, result, form map, handoff)
│   │   ├─ content/           reviewable files: schemes/, forms/, lines/
│   │   ├─ scheme_library/    block 1
│   │   ├─ eligibility/       block 2
│   │   ├─ knowledge_search/  block 3
│   │   ├─ voice/             block 4
│   │   ├─ brain/             block 5
│   │   ├─ handoff/           block 6
│   │   ├─ portal/            block 7: practice portal pages (treated like a third-party site)
│   │   └─ api/               thin web routes, one file per block
│   ├─ scripts/
│   └─ tests/
├─ widget/                    block 8: voice form widget (own build and tests)
└─ frontend/                  block 10: the Urimai website
```

Blocks never import each other. Only `main.py` and the `api/` routes connect them. The widget talks to the backend only over its web routes.

---

## 9. Build order and scope for 30 Nov

The submission is due **30 Nov, 11:59 pm**.

- **Rules, widow screen, data and search:** as in the data and search design.
- **Voice form widget, handoff and practice portal:** as in [voice-form-widget-plan.md](voice-form-widget-plan.md), starting with typed and tapped replies, then voice.
- **Then:** voice for the main conversation, other languages, saved progress, pitch deck, 3-minute video, live link.

*Later:* desktop extension, phone apps, real department pilots, scheme data beyond the demo stories.

---

## 10. If something goes wrong

| If this fails | What happens |
|---|---|
| No API key | Site opens; voice and AI show "key not set"; tapped and typed answers, schemes, eligibility, the practice portal and the widget (tap and type) still work |
| Sarvam is slow, costly or down | Plugs let us switch provider; tapping and typing work meanwhile |
| Sarvam credits run out | A plain "voice is paused, you can still type" message |
| Search model not available | Keyword search is used, and the app says so |
| Database stopped | Screens and eligibility still work |
| The page does not match its form map | The widget says the page may have changed and switches to spoken step-by-step guidance without filling |
| A field cannot be found or filled | The widget asks the user to fill that one field and moves on |
| The site rejects a value | The widget reads the site's message and asks again |
| Network drops | The widget explains, keeps its progress in the tab, and continues when the connection returns |

---

## 11. Still to do

- Receive the Sarvam API key and test Tamil understanding and speech on about 20 sample sentences.
- Get the real field list of the e-Sevai Destitute Widow Pension form (REV-202); the practice portal is modelled on common patterns, not copied.
- Check every scheme fact against a government order; until then data stays marked *not yet verified*.
- Before any real pilot: a security review package for departments, the real portal's terms on assisted use, and a written no-objection from the department.
- Check whether the competition requires showing Wispr Flow in the demo video.
