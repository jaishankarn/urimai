# Architecture changes

What changed in Urimai's design, when, and why. The current design is in [architecture.md](architecture.md).

## 28 Nov 2026: applications are filled by an embeddable voice widget

**Decision.** The application step is handled by the **Urimai voice form widget**: a small script a department adds to its form pages with one line. It fills the real form by voice, field by field, while the user confirms each value. The user logs in, handles OTP, captcha, Aadhaar and uploads (unless they gave Urimai the document), and presses Submit.

**Replaces.** The "guidance assistant", which only told the user what to type and filled nothing. The hackathon brief asks for spoken answers to become form fields, and guidance alone left the user typing by hand.

**Why the widget**
- It works on phones and computers with nothing to install, because it runs inside the page.
- The user does every official step, which makes it the most approvable model. Major AI browser products follow the same "agent fills, user confirms and submits" rule.
- Running inside the page lets it use the site's own components, such as its calendar.
- One widget, plus a data-only form map per form, can serve any department. It can also be offered as a separate product.

**Tested on 28 Nov** (typed replies standing in for voice, local replica sites):
- A replica of the real CPGRAMS registration page, with the same field ids, rules and libraries.
- An old PHP-style two-page pension form.

All fields filled and the servers received the right values. The run covered dropdowns that load from the server, a calendar date picker, lists that reload the page, a frame, the site's own validation errors, a server-side error, user corrections, an attached document, and steps left to the user.

## Changes that follow from it

| Area | Before | Now |
|---|---|---|
| Application step | Guidance only; the user types | Widget fills confirmed values; the user does login, OTP, captcha, Aadhaar, uploads and Submit |
| How the agent reaches the form | Earlier idea: Playwright browser on our server, streamed to the user | **Dropped.** It would hold the citizen's session on our server. Playwright is used only for tests |
| Delivery | Page script for the demo; extension and phone app as main carriers | **Embedded widget is the main route** on all devices. Extension and phone apps are optional, later |
| Handoff | One-time code read by the assistant | One-time code (single use, about 10 minutes, tied to one site) exchanged for a short widget session; the code is removed from the address bar |
| Form knowledge | Form definition inside the assistant | **Form maps** in `backend/app/content/forms/`: data only, no per-site code |
| Practice portal | Simple demo form | Demo pension form using common older government patterns, loading the widget with the same one line a department would add |
| Applicant details | Not defined | Kept out of eligibility `Facts`, which hold no identity data. Name, address and phone are asked by the widget on the form, or passed in the handoff with consent, and never stored |
| Sensitive fields | "User's part" by convention | Enforced in widget code: never reads or fills passwords, OTP, captcha, Aadhaar, bank details; never clicks buttons that send the form |
| Folders | `assistant/` | `widget/` (own build and tests) and `backend/app/portal/` |
| Department's part | Not defined | Add one script line, allow the microphone and our address in site security settings, register site and forms, check the field map |

## Recorded elsewhere

The data and search design (28 Nov) changed SQLite to PostgreSQL with pgvector, one container to two, the large embedding model to `multilingual-e5-small`, written passages to selected official text, and server-saved journeys to "not built yet; proposed to stay in the browser". [architecture.md](architecture.md) now reflects those decisions.
