# Widow journey: rules, screen, data and search

Status: approved on 2026-11-28, then revised the same day after a question-by-question review. The revision was confirmed on 2026-11-28. The teammate has agreed to the changes from `docs/architecture.md`.

## Intent

A judge with no keys can follow the widow's story: answer a few questions, confirm them, see which benefits may apply with reasons and sources, check documents, and look up official text. Eligibility comes from rules a person has checked. Round 2 closes on 30 Nov 2026 at 11:59 pm.

## Goals

- `docker compose up --build` shows the app on port 3000, with no `.env` file and no keys.
- A tap-and-type screen covers questions, confirmation, results and a document checklist, in Tamil and English.
- Eligibility comes from human-checked rules, each tied to a source.
- Keyword and semantic search work without keys over selected official documents.
- Rules, passages and vectors load from files in the repository.

## Not in this step

Sarvam, voice, understanding free speech, form filling, review and submission, saved progress and resume, the My Journey and My Profile sections, Hindi and Telugu screen text, the disability and other stories, text recognition and further data collection. The teammate is experimenting with voice form filling separately, so this work does not plan it.

## Would count as failure

- The app does not start, or the main screen waits on the database or model.
- A search passage changes an eligibility result.
- A rule nobody has reviewed produces "may be eligible".
- A missing or conflicting condition is hidden.
- Personal data is committed, stored or logged.

## Time limit

**Hard stop: Sunday 29 Nov, 12:00 noon IST.** Anything unfinished in this design is dropped, and the app ships as the last working stage. Voice, Sarvam, the video, the deck and submission use the time after that.

| Phase | Stage | Target (IST) | Works alone? |
|---|---|---|---|
| 0 | Align and set up | Sat 13:00 | |
| 1 | Rules and results | Sat 17:00 | Yes |
| 2 | Widow screen | Sat 23:00 | Yes: the first demo |
| 3 | Postgres and loader | Sun 08:30 | Yes |
| 4 | Keyword search and question box | Sun 10:00 | Yes |
| 5 | Semantic search | Sun 11:30 | Left out unless it passes its test |
| 6 | Final check | Sun 12:00 | |

Targets are aims, not tested estimates. Phases 3 to 5 carry the time risk. A phase is merged only when it works, so an unfinished one is left out. The final check happens even if we stop earlier.

**Ownership:** this design (rules, screen, data, search) is ours. The teammate works on voice form filling separately and reviews the rules.

## Code layout

Follows the folder structure in `docs/architecture.md`, as the team agreed: `backend/app/contracts/` (shared data shapes), `content/` (reviewable files), `scheme_library/`, `eligibility/`, `knowledge_search/`, `api/`, and `backend/scripts/`. Blocks do not import each other. Only `main.py` and the `api/` routes connect them.

## Approaches

| Option | Trade-off |
|---|---|
| SQLite, vectors compared in Python | One container; no database server for later |
| **PostgreSQL with pgvector (chosen)** | One database for rules, text and vectors; a second container and startup ordering |
| Separate vector database | Another service with no benefit at this size |
| **Embedding model inside the app (chosen)** | No key; bigger image and more memory |
| Separate model container | A third service |
| Embedding service | Needs a key, so judges get no semantic search |

## Rules

### Records

One reviewed file per scheme in `backend/app/content/schemes/<slug>/scheme.yaml`. Eight benefits in nine files, because bank insurance is two schemes. The drivers' board was added after the code review, so that a driver's family is not told only that other boards do not apply:

1. Destitute Widow Pension
2. National widow pension (IGNWPS)
3. National family benefit (NFBS)
4. National old age pension (IGNOAPS)
5. Construction workers' board death assistance
6. Manual workers' board death assistance
7. Drivers' and automobile workshop workers' board death assistance
8. Bank insurance: PMJJBY and PMSBY

Each record holds: id; English and Tamil names; `aliases` including Tamil typed in English letters; benefit amount, frequency and wording; `conditions` (fact, comparison, value, `kind`, source id, exact quote); `documents`; `apply` (where, e-Sevai code, charge); `sources` (link, title, type, source date, date checked); `conflicts`; `reviewed_by` and `reviewed_on`; and `government_order_verified` (false for all today).

A benefit enters only with a source whose text we have read. Where a document list, deadline or application route was not found, the record says so and the screen says "Not confirmed. Ask the office."

### Condition kinds

| Kind | Meaning |
|---|---|
| `checkable` | The user's confirmed answer can decide it |
| `official_check` | An office must confirm it: "destitute", and any condition or deadline we could not find (such as welfare board renewal or the family benefit claim deadline). Each is named on screen |
| `disputed` | Sources disagree and no stronger source settles it |

**Either-or conditions.** A condition can offer alternative groups. Needed because the ₹5,00,000 construction worksite death benefit includes unregistered workers: the construction condition is "registered, **or** died by accident at work". Benefit amounts can also depend on facts, such as cause of death.

**When sources disagree:** a reviewer picks the stronger source. Order: government order, current state department publication, e-Sevai, district page. For the widow pension, follow the 2024-25 Social Welfare citizen charter (18 or older, property up to ₹1,00,000, no son condition listed). The condition is then `checkable`, and the older district rules (below 40, ₹50,000, son and relative conditions) are listed in `conflicts` and **shown as things to check**.

### Outcomes

| Situation | Outcome |
|---|---|
| The rule is not reviewed | `needs_more_information`, labelled "not yet reviewed". Never another outcome |
| A `checkable` condition is not met | `appears_ineligible` |
| A `checkable` fact is unknown, or any condition is `disputed` | `needs_more_information` |
| Otherwise | `potentially_eligible`, listing every `official_check` item, including deadlines |

"Destitute" is `official_check`: the result says "Officials still need to confirm that you count as destitute". Answers about income and relatives are shown as things to check. No wording promises eligibility or approval. Amounts are never added together.

### Review

I draft each rule with its exact quote and link. The teammate compares them and records initials, date and a checksum of the rule. If conditions, amounts or checks change afterwards, the checksum no longer matches and the rule counts as unreviewed. An unreviewed rule's result shows no per-condition verdicts, amounts, application route or documents; its name, pending checks, conflicts and sources are still shown. Every benefit that follows a death requires that the husband has passed away. Seeing no insurance deduction counts as unknown, because earlier premiums differed. A review means "matches the quoted source", not "verified against a government order".

### API

`GET /api/content/{lang}` returns the screen text and questions for `en` or `ta`.

`POST /api/eligibility` takes confirmed facts and returns, for each scheme, the outcome, a result per condition (`met`, `not_met`, `unknown`, `needs_check`), conflicts, documents, how to apply and sources. A plain function reads the rule files, so it works without the database. The loader also copies rules into Postgres. Facts are not stored or logged.

## Screen

Mobile-first, building on the current React screen. No key needed.

1. **Language:** Tamil or English. Hindi and Telugu buttons are marked "coming soon". Text and questions live in one file per language, in `backend/app/content/lines/`.
2. **Questions:** one at a time, large buttons or typed numbers. Every question allows **"I don't know"**. Questions that no longer matter are skipped.
   Order: lives in Tamil Nadu; district; village or town/city; her age; widowed; when he died; his age; natural or accidental death, and whether at work; main earner; his work; board registration; insurance deduction seen in his passbook; her regular income; property value range; adult son or other adult relatives at home; below-poverty-line card.
3. **Confirm:** all answers listed, each editable. Nothing is evaluated until she confirms.
4. **Results:** grouped by the three outcomes, each with reasons, items still to check, conflicting sources, source link and date.
5. **Documents:** for a chosen scheme, one document at a time: "I have it" or "I don't have it", with how to get it only where a source says. Choices are not saved.
6. **Ask a question:** see [Search](#search).

District and village or town/city are used to show where to apply. **They do not change pension results.** No Aadhaar, OTP or bank account numbers are asked. Answers stay in the page's memory and are lost on reload; the screen says so.

**Documents for the widow pension:** the charter lists three; e-Sevai, the application channel, lists nine including a widow certificate. Show the e-Sevai list as the checklist, and say the charter lists fewer.

## Demo story

Made-up facts, also used as the main eligibility test (with reviewed rules):

> Widow, 58, Tamil Nadu. Her husband was a registered construction worker and the main earner. He died naturally this year at 54. She has a below-poverty-line card, no regular income, property under ₹50,000 and no adult son or other adult relative at home. She doesn't know whether he had bank insurance.

| Benefit | Expected result |
|---|---|
| Destitute Widow Pension | May be eligible; "destitute" and listed conflicts to check |
| National widow pension | May be eligible; same kind of checks |
| National family benefit | May be eligible; claim deadline and process to check |
| Construction board death assistance | May be eligible; registration validity and claim deadline to check |
| PMJJBY life insurance | Needs more information: was he enrolled and covered? |
| National old age pension | Appears ineligible: under 60 |
| Manual workers' board | Appears ineligible: he was a construction worker |
| Drivers' board | Appears ineligible: he was a construction worker |
| PMSBY accident insurance | Appears ineligible: natural death |

If a rule source turns out to say something different, the source wins and this table changes.

## Data and search

### Files and what is public

| Path | Contents |
|---|---|
| `backend/app/content/schemes/<slug>/scheme.yaml` | Rule files |
| `backend/app/content/search/sources.yaml` | Documents selected for search, with reason and reviewer |
| `backend/app/content/search/passages.jsonl` | Passage text and source details |
| `backend/app/content/search/vectors.npy` | One vector per passage, same order |
| `backend/app/content/search/manifest.json` | Model name, revision, file checksum, vector size, counts, data checksums |

**Committed:** rules; the search files, after a person checks the selected text for personal data; and the research documents (`docs/use-cases.md`, `docs/benefits-research.md`, `docs/search-and-database.md`, `docs/sources/district-pages.md`) with this design and its plan. The research documents get the same personal-data check. Some link to the local collection, which will not open on GitHub.

**Not committed:** `data/knowledge/` and `data/raw/`, added to `.gitignore` and `.dockerignore`. They can contain names and office contacts.

### Preparing passages

- Only `ok` documents from official government or official aggregator sources that are listed in `sources.json`, for the widow story. Never unofficial, scanned or garbled ones.
- Split by the model's token count: at most 450 including the prefix, about 50 overlapping.
- Remove exact duplicates (after normalising spaces and Unicode), keeping every source link. Near-duplicates are not deleted; the build writes a local review list marking those whose numbers differ.
- The search copy of text, and each query, replace the variant `ா்` with `ர்`. Displayed text is unchanged.

### Model

- `intfloat/multilingual-e5-small` (MIT), revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`, 384 numbers per vector, run with ONNX Runtime and its tokenizer, without PyTorch. Average token outputs, then normalise.
- Prefix passages `passage: ` and questions `query: `.
- Try `onnx/model_qint8_avx512_vnni.onnx` (about 118 MB) first. It is tuned for some Intel/AMD processors; if it fails on arm64 or amd64, or finds clearly worse results than `onnx/model.onnx` (about 470 MB), use the full file.
- The Docker build downloads it and checks its checksum. It is not committed.
- Create seed vectors inside the app image with the same model file. If the manifest does not match the app's model, semantic search stays off.
- If the download fails after retries, the build continues without the model and the app uses keyword search and says so.

### Database

| Table | Holds |
|---|---|
| `scheme` | Rule record as JSON |
| `document` | Link, title, source type, jurisdiction, source date, language |
| `passage` | Text, search text, `vector(384)`, unique content hash |
| `passage_source` | Which documents contain each passage |
| `meta` | Loaded data version |

On startup the app compares data versions and, if different, replaces these tables in one transaction. All hold only repository data. Postgres startup scripts are not relied on, because they run only for an empty database. Vector comparison is exact.

### Search

`POST /api/search` with `{"query": "...", "limit": 5}`, so questions do not appear in access-log addresses. Reject empty queries and over 500 characters. Do not store or log queries.

- Combine vector and keyword rankings by position (reciprocal rank fusion).
- Keyword search starts with the `simple` setting, prefix matching and scheme aliases. The built-in Tamil setting missed one word form in a test.
- Results give passage text, title, link, source type, jurisdiction and source date (or "date not shown"), and the response says `hybrid` or `keyword`.
- It returns passages and does not write answers.

**Question box:** on screen, labelled: "These are passages from official documents. They are not an answer or advice. Some may be old or in English. Your result above comes from the checked rules." If search is unavailable, it says so.

### Model test (keep or drop)

About 20 questions with the passage each should find, **written before tuning**. The user writes Tamil, English and mixed-language ones and checks the Tamil screen text. I draft Hindi and Telugu ones, labelled as not checked by a speaker.

**Keep the model only if** hybrid search puts the right passage in the top 3 for **at least 3 more questions** than keyword search with aliases, **and** the app builds and searches on amd64. Otherwise ship keyword search and say so. This is a rough signal from a small test.

### Compose and startup

- `db`: `pgvector/pgvector:0.8.7-pg17`, a data volume, no published port, health check `pg_isready -h 127.0.0.1`.
- `app`: starts after `db` is healthy, serves the main screen at once, loads data and the model in the background and retries the database.
- Password `${POSTGRES_PASSWORD:-urimai_local}`: a local default, not a secret. A public deployment sets its own before the database is first created. Add it to `.env.example`.
- `GET /api/health` adds `database`, `semantic_search` and `data_version`, no secrets, and returns 200 while loading.
- Judges need only Docker with Compose, and internet for the first download and build.
- No user data goes in the database. Saving progress, when designed, is proposed to stay in the browser.

## How we check it

1. **Rules:** tests for every outcome, the demo story, an unreviewed rule, an unknown fact, a disputed condition, and property values of ₹75,000 and above ₹1,00,000.
2. **Screen:** the demo story end to end at phone width in Tamil and English; "I don't know"; editing an answer changes the result.
3. **Fresh start:** clean clone, no `.env`, empty volume; port 3000 shows the app.
4. **Restart:** no duplicate rows. **Data change:** loads on next start.
5. **Failures:** with `db` stopped after startup, screen and eligibility work. A build without the model starts in keyword mode.
6. **amd64:** build, run and search.
7. **Model test** as above.
8. **Cost:** record image size, memory, build and start time. Docker here has about 8 GB; judges' limits are unknown.

## Differences from `docs/architecture.md` (agreed by the teammate; that file does not show them yet)

SQLite → PostgreSQL with pgvector; one container → two; multilingual-e5-large → e5-small; written English passages → selected official text; server-saved journeys with a 4-digit code → not built here. This design replaces `docs/search-and-database.md`.

## Left to the builder

Python Postgres libraries, code layout, indexes, batch sizes, near-duplicate threshold, visual styling, and exact wording of reasons.
