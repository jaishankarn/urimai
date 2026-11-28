# Filling Government Forms by Voice: Approaches and Final Decision

**Question:** how does a user fill a real government application form by voice, in Tamil, on a computer or a phone, in a way that is honest, safe and acceptable to the government?

**Decision:** an **embeddable Urimai voice widget**. A department adds one line of code to its form pages. The widget fills the form by voice while the user confirms each field. The user always logs in, handles OTP, captcha, Aadhaar and uploads, and presses Submit.

---

## 1. Ground rules every approach was judged against

- Urimai never logs in, never reads passwords, OTPs, captcha or Aadhaar numbers, and never presses Submit for the user.
- Only values the user has **confirmed** are filled, and each is read back.
- No claim of submission or approval without a real integration. Demo sites are clearly labelled.
- Must work for elderly and low-literacy users, most of whom use **phones**.
- Must be something a government department could agree to.

---

## 2. All approaches we considered

| # | Approach | How it works | Fills the live site by voice? | Desktop | Phone | Main problem | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Headless browser on our server, streamed to the user** | Playwright fills the form on our server; the user watches a live picture | Yes | ✅ | ✅ (just images) | Our server would hold the citizen's login session and submit for them. High approval and privacy risk; heavy (Chromium in the app) | ❌ Dropped |
| 2 | **Headless browser behind the scenes, narrated only** | Same as 1, but the user only hears "I've entered your name…" | Yes, invisibly | ✅ | ✅ | Same risks as 1, and the user cannot see what happens | ❌ Dropped |
| 3 | **Iframe of the government site inside Urimai** | Show the form inside our page and fill it by script | Only for sites we own | ✅ | ✅ | Real government sites refuse to be framed, and browsers block scripting another site's page | ❌ Only works for our own demo site |
| 4 | **Voice form inside Urimai only** | Urimai shows its own copy of the form and fills it by voice; the user then copies it to the real site | No, only our own form | ✅ | ✅ | Useless for the real application: the user still types everything on the real site | ❌ Not enough |
| 5 | **Voice guidance only** | Assistant tells the user what to type, box by box; the user types | No, the user types | ✅ (extension) | Android floating app (cannot see the screen) | Does not meet the brief: the user still fills by hand | ⚠️ Fallback only |
| 6 | **Desktop browser extension that fills fields** | User installs an extension; it fills any site's form by voice | Yes | ✅ Chrome, Edge, Firefox | ❌ Chrome on Android has no extensions | Desktop only; users must install it | ⚠️ Optional bridge, later |
| 7 | **Android floating bubble + Accessibility permission** (Wispr Flow style) | App floats over the browser and types into fields | Yes, on the user's command | – | Android only | Google Play restricts Accessibility apps (Jan 2026 policy: no autonomous actions, separate disclosure); heavy permission for elderly users | ⚠️ Roadmap, risky |
| 8 | **Urimai app with a built-in browser** | The app opens the portal inside itself and runs the same fill script | Yes | – | ✅ Android and iPhone | Needs a native app and checks that the real portal works inside it | ⚠️ Roadmap |
| 9 | **Android autofill service** | Chrome lets users pick a third-party autofill service; "Fill from Urimai" appears on fields | Yes, field by field | – | Android only | Unverified whether Chrome passes field labels; user must change a Chrome setting | ⚠️ Roadmap, to test |
| 10 | **Voice keyboard** (Wispr Flow's iPhone approach) | A custom keyboard types the spoken value into the tapped field | Yes, into the tapped field | – | ✅ Android and iPhone | Only knows the field the user tapped; install and enable a keyboard | ⚠️ Roadmap |
| 11 | **Desktop app typing into the focused field** | Like Wispr Flow on desktop | Yes | ✅ | – | Not needed if 6 or 12 exists | ❌ Not needed |
| 12 | **Bookmarklet** | A saved bookmark runs our fill script | Sometimes | ⚠️ | ⚠️ | Often blocked by site security; too hard for our users | ❌ Dropped |
| 13 | **Screenshot or photo read by AI** | User shares a picture of the form; Urimai says which box is which | No, guidance | ✅ | ✅ | Guidance only; Tamil accuracy unverified | ⚠️ Possible add-on |
| 14 | **Hand over to an operator (e-Sevai, CSC, NGO)** | Urimai prepares the details; a person submits | Yes, by a person | ✅ | ✅ | Depends on a human, which we want to avoid | ⚠️ Fallback channel |
| 15 | **Official integration (API)** | Urimai submits through an approved government connection | Not needed | ✅ | ✅ | Needs an agreement per scheme; takes years | ⚠️ Long term only |
| 16 | **Embeddable voice widget** | The department adds one script line; the widget runs inside the page and fills by voice | **Yes** | ✅ | ✅ | Needs each department's cooperation | ✅ **Chosen** |

---

## 3. What already exists

The filling technique itself is not new. What is missing is a version for this user group: voice in Indian languages, scheme knowledge, the user's details carried over, and government cooperation.

| Product | What it does | Why it does not solve our problem |
|---|---|---|
| Chrome autofill, password managers | Fill name, address, cards on any site | No voice, no understanding of a pension form, no guidance |
| [Simplify Copilot](https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc) and similar | Extension that autofills job applications on thousands of sites | Job seekers on desktop, English |
| [Gemini in Chrome auto browse](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/) | Agent fills forms in your Chrome and pauses for confirmation | [US only, paid, desktop only](https://support.google.com/chrome/answer/16821166) |
| [Claude in Chrome](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide) | Extension agent with per-site permission; asks before sensitive actions | General purpose, English-first, desktop |
| [Wispr Flow](https://docs.wisprflow.ai/articles/7669452251-accessibility-permission-on-android) | Voice dictation into any field (Android bubble with Accessibility, iPhone keyboard) | Dictation only; no forms knowledge or guidance |
| [Skyvern](https://github.com/Skyvern-AI/Skyvern) | Open-source server-side browser automation for forms | Built for businesses; same risks as approach 1 |
| [NIC Jigyasa](https://informaticsweb.nic.in/article/jigyasa), [Bhashini](https://cdnbbsr.s3waas.gov.in/s316026d60ff9b54410b3435b403afd226/uploads/2024/12/202412302014853321.pdf) | Government conversational layer that points to the right form; Bhashini lists voice form filling as a planned application | Do not fill forms yet, from what we found. Shows the government wants this |

**Why it is not common yet:** simple filling is easy, but reliable filling on many forms is hard (date pickers, reloading dropdowns, multi-page forms, sites that change); mistakes on official forms are costly; the hard part is having the user's correct details; access needs the site's cooperation or an installed extension; and the poorest users are not a lucrative market for big companies.

---

## 4. The chosen approach: embeddable voice widget

### How a user experiences it

1. The user talks to **Urimai** in Tamil, confirms their details, and Urimai finds a scheme they may qualify for.
2. Urimai asks: "Shall we fill the application now?" On yes, it opens the department's form page.
3. The **Urimai widget** on that page greets the user by name and fills each field it already knows, highlighting it and asking "சரியா?" (is this right?).
4. For anything new, it asks by voice and fills the answer. If the website rejects a value, the widget reads the site's error out and asks again.
5. For login, OTP, captcha, Aadhaar, uploads (unless the user gave Urimai the document) and Submit, it says "இது உங்கள் பகுதி" (this part is yours) and waits.
6. The user presses Submit and gets the department's acknowledgement.

Users who never used Urimai can tap the widget's "Fill by voice" button on the department's page and fill the form by talking.

### What the department does

1. **Adds one line** to its form pages:
   ```html
   <script src="https://widget.urimai.example/v1/widget.js" data-site-key="DEPARTMENT-KEY" defer></script>
   ```
   No change to its servers, forms, login or approval process. It can host the file on its own servers for security review.
2. **Approves** its domain and forms in the Urimai partner console.
3. **Checks the field map**, which is detected from the page's labels, or provides field ids.
4. **Accepts fixed rules:** the widget never logs in, never reads passwords, OTPs, captcha or Aadhaar, never presses Submit, fills only confirmed values, and keeps nothing after the session without consent.

### How information moves

```
Urimai app --(one-time code after # in the link)--> department page + widget
widget --(fetches confirmed details from Urimai, only for approved sites)--> fills, user confirms
user --(presses Submit)--> department's own server, as today
```

- The part after `#` is never sent to the department's server. The widget reads it and removes it from the address bar.
- A code works **once** and expires in about **10 minutes**.
- Requests from sites that are not approved are refused.

### Why this approach

- The user does the official steps, so it is the most approvable model. Major AI products use the same "agent fills, user confirms and submits" pattern.
- It works on **phones and computers** without installing anything, because it runs inside the page.
- Running inside the page lets it use the site's own components (for example its calendar), which an extension cannot do directly.
- The same widget is a **separate product** any department or form-heavy website can embed.

### Is an extension needed?

No. Where the department embeds the widget, nothing else is needed on any device. An extension is only an optional desktop bridge for sites that have not adopted the widget yet, and a sales tool ("here is your own live form, filled by voice"). Not needed for the hackathon.

---

## 5. What we tested (28 Nov 2026)

Voice was simulated with typed replies; the real widget sends speech to Sarvam. All sites were local test copies marked "REPLICA" or "DEMO". Nothing was sent to any government system.

### Test 1: browser extension fill engine

A minimal extension filled forms by matching visible labels, with no site-specific code.

| Form | Result |
|---|---|
| Public React practice form (demoqa) | All 6 fields filled, including a radio button. After a simulated user submit, the site showed every value, so the framework registered them |
| Government-style form with Tamil labels | All 6 fields filled in Tamil and English; password and captcha left empty; Submit never pressed |

### Test 2: first widget proof of concept

A practice "government" site on a separate address with one script line. Showed the handoff, voice confirmations, "your part" steps for upload and Submit, the phone layout, and the partner console mock-up. A reused code was rejected (410) and a request from an unapproved site was refused (403).

### Test 3: real-world form patterns

- **Form A, CPGRAMS replica.** Built from the real `pgportal.gov.in/Registration` page: same field ids, validation rules and messages, libraries (jQuery, jQuery Validate, Select2, Bootstrap) and dropdown logic, plus an OTP and password step.
- **Form B, old PHP-style pension form.** Common government patterns across two pages.

The widget was the same file for both. The only per-site input was the field map: real ids for A, labels only for B.

| Edge case | Form | Result |
|---|---|---|
| Name in English letters only (real CPGRAMS rule) | A | Filled "Lakshmi"; passed the site's check |
| Dropdowns loaded from the server (Country → State → District, Select2) | A | Waited for each list, then selected |
| Site rejects a value (9-digit mobile) | A, B | Read the site's error, asked again, second answer accepted |
| Spoken e-mail ("lakshmi58 at example dot com") | A | Became `lakshmi58@example.com` |
| OTP and password page after Submit | A | Left to the user; never read |
| Read-only calendar date picker | B | Operated the calendar (year, month, day); the site calculated Age 58 and the widget checked it |
| English capitals and Tamil name fields | B | "LAKSHMI" and "லட்சுமி" |
| Searchable dropdown | B | Selected "Backward Class (BC)" |
| District → Taluk dropdowns that reload the page | B | Kept progress through both reloads |
| Address fields inside an embedded frame | B | Found and filled |
| User corrects a value ("இல்லை") | B | Re-asked and refilled (625002 → 625001) |
| Server rejects the user's own field (11-digit Aadhaar) | B | Read the error after reload, asked the user to retype, never saw the number |
| Attach the document the user gave Urimai | B | Asked first, attached, site accepted it |
| Photo upload, declaration, captcha, Submit | B | Left to the user; checked they were done without reading content |
| Two-page form to acknowledgement | B | Completed |
| Phone screen | A | Bottom-sheet panel; current field stays visible |

**Outcome:** both forms reached the end with no browser errors, and the servers received every value correctly (14 fields on A, 18 on B).

### Not yet tested

- The live government site (not reachable from our build environment; needs a run from India with permission).
- Real speech in noisy conditions.
- Date picker and dropdown libraries other than jQuery UI and Select2.
- Old non-Unicode Tamil fonts, session timeouts, and sites with strict security rules.

---

## 6. Open items

- The widget panel covers part of wide desktop forms: add minimise or docking.
- Add handlers for other common date pickers and dropdown libraries as forms are onboarded.
- Tamil-to-English name conversion (Sarvam transliteration) with voice confirmation.
- Security review package for departments: self-hosted script option, data-flow description, no-storage guarantee.
- A pilot with one department and one form before claiming "works everywhere".
- The test code (widget, replicas, test driver) is not in the repository yet.
