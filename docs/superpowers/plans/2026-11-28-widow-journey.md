# Widow Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A judge with no keys follows the widow's story from questions to reasons, sources and documents, and can look up official text.

**Architecture:** Rules are reviewed YAML files; a pure function evaluates them; React renders the screen from content the API serves. PostgreSQL with pgvector then holds search passages, searched by keyword and, if it passes a test, by a local embedding model inside the app container.

**Tech Stack:** Existing FastAPI 0.165.0, React 19.3.1, Vite 8.4.0, Python 3.11, Node 24. New: PyYAML 6.0.4, psycopg[binary] 3.3.9, `pgvector/pgvector:0.8.7-pg17`, onnxruntime 1.32.0, tokenizers 0.23.3, numpy 2.4.6 (all resolve for Python 3.11 on x86_64 and aarch64).

**Spec:** `docs/superpowers/specs/2026-11-28-data-and-search-design.md`

## Global Constraints

- **Hard stop: Sun 29 Nov 12:00 IST.** Unfinished phases are left out. Task 6 runs even if you stop early.
- `docker compose up --build` shows the app on port 3000 with no `.env` and no keys. The main screen never waits on the database or model.
- Rules decide eligibility. Search never changes a result. Outcomes are exactly `potentially_eligible`, `needs_more_information`, `appears_ineligible`.
- An unreviewed rule always gives `needs_more_information`.
- No wording promises eligibility or approval. Amounts are never added together. No Aadhaar, OTP or bank account numbers are asked.
- Facts and search queries are sent in POST bodies, never stored or logged.
- Blocks (`scheme_library`, `eligibility`, `knowledge_search`) import `contracts` only, never each other.
- Pin exact versions. No new frontend test framework: screen changes are checked by build and browser.
- `data/knowledge/` and `data/raw/` are never committed or copied into the image.
- Out of scope: voice, Sarvam, free-speech understanding, form filling and handoff (teammate), saved progress.
- One branch per phase from the latest `main`, named `feat/phase-N-<short>`. Commit locally at each commit step. **Ask before pushing or merging.** End commit messages with the attribution line given in the session.

## Review Focus

1. A fact that is absent, `null` or `"unknown"` is treated as unknown, never as "no" (Task 1 test).
2. Age edges: widow 17/18 and 59/60; husband 55/56 and 59/60 (Task 1 test).
3. A hidden or stale answer cannot satisfy a rule: `death_at_work: yes` with `death_cause: natural` must not unlock the worksite route (Task 1 test; Task 2 browser check).
4. Editing a reviewed rule silently keeps it "reviewed": it must become unreviewed (Task 1 test).
5. Database stopped or model missing: screen and eligibility still work; search says what it can do (Tasks 3, 4 and 5).

## Before Task 1 (Phase 0: align and set up)

- [ ] Local `main` matches `origin/main`. The planning PR is merged or its branch is the base.
- [ ] Tell the teammate: Task 1 creates `contracts/facts.py` (the confirmed details) and scheme ids. Voice form filling should reuse those names. Shared files they might also edit: `backend/app/main.py`, `frontend/src/App.tsx`, `docker-compose.yml`, `.env.example`.
- [ ] `cd backend && .venv/bin/pytest` passes (6 tests).

## File Structure

| Path | Responsibility |
|---|---|
| `backend/app/contracts/{facts,scheme,result}.py` | Shared data shapes |
| `backend/app/content/schemes/<slug>/scheme.yaml` | One rule per scheme |
| `backend/app/content/lines/{en,ta}.yaml` | Screen text and questions |
| `backend/app/content/search/` | `sources.yaml`, `passages.jsonl`, `vectors.npy`, `manifest.json` |
| `backend/app/scheme_library/loader.py` | Reads and validates rules |
| `backend/app/eligibility/engine.py` | Pure evaluation |
| `backend/app/knowledge_search/{text,store,search,embedder,embed}.py` | Normalise, load, rank, vectors |
| `backend/app/api/{content,eligibility,search}.py` | Thin routes |
| `backend/scripts/{review_checksum,build_knowledge,eval_search}.py` | Developer tools |
| `frontend/src/{api.ts,App.tsx,journey/*.tsx}` | Screen |

---

### Task 1: Rules and results (Phase 1, aim Sat 17:00)

**Files:** Create `contracts/`, `scheme_library/loader.py`, `eligibility/engine.py`, `api/eligibility.py`, eight `scheme.yaml` files, `scripts/review_checksum.py`; tests `tests/{contracts,scheme_library,eligibility,api}/`. Modify `app/main.py`, `requirements.txt` (add `PyYAML==6.0.4`). Each new Python folder gets an `__init__.py`.

**Interfaces (Produces):**
- `contracts.facts.Facts`: pydantic model, `extra="forbid"`, every field optional, default `None`:

| Field | Values |
|---|---|
| `lives_in_tn`, `widowed`, `death_at_work`, `husband_main_earner`, `husband_board_registered`, `adult_relative_at_home`, `bpl_card` | `yes`, `no`, `unknown` |
| `district` | one of the 38 district slugs (list them; same slugs as the `*.nic.in` names), or `unknown` |
| `area` | `village`, `town_city`, `unknown` |
| `age`, `husband_age_at_death` | int 0–120 |
| `husband_death_when` | `within_1_year`, `1_to_2_years`, `over_2_years`, `unknown` |
| `death_cause` | `natural`, `accident`, `unknown` |
| `husband_work` | `construction`, `driver`, `other_manual`, `farm_labour`, `farming`, `salaried`, `government`, `other`, `unknown` |
| `insurance_deduction` | `life` (₹436), `accident` (₹20), `both`, `none`, `unknown` |
| `own_income` | `none`, `some`, `unknown` |
| `property_value` | `under_50000`, `50000_to_100000`, `over_100000`, `unknown` |

An unknown number is sent by leaving the field out.

- `contracts.scheme.Scheme` (pydantic, `extra="forbid"`): `id`, `name: Text`, `aliases: list[str]`, `conditions: list[Condition]`, `checks: list[Note]`, `conflicts: list[Note]`, `amounts: list[Amount]`, `documents: Documents`, `apply: Apply`, `sources: list[Source]`, `review: Review | None`, `government_order_verified: bool`.
  - `Text {en: str, ta: str}`. `Clause {fact: str, op: "eq"|"in"|"min"|"max", value, unknown_values: list[str] = []}`.
  - `Condition {id, text: Text, kind: "checkable"|"disputed", any_of: list[list[Clause]], source: str}`: OR of AND groups.
  - `Note {id, text: Text, source: str | None}`. `Amount {text: Text, source: str, when: list[Clause] = []}`.
  - `Documents {confirmed: bool, note: Text | None, items: list[{id, text: Text, how: Text | None}]}`. `Apply {text: Text, service_code: str | None, charge_rupees: int | None, source: str | None}`.
  - `Source {id, title, url, type, source_date: str | None, checked_on, local_file: str | None, quote}`. `Review {by, on, checksum}`.
  - Every `source` reference must name an id in `sources`; every `Clause.fact` must be a `Facts` field. Validate both.
  - Methods: `checksum() -> str` (SHA-256 of the canonical JSON of `conditions`, `checks`, `amounts`); property `reviewed -> bool` (`review` exists and its checksum equals `checksum()`).
- `contracts.result.Result {scheme_id, name: Text, outcome, reviewed: bool, amounts: list[Text], conditions: list[{id, text: Text, status: "met"|"not_met"|"unknown"|"needs_check", source}], checks: list[Note], conflicts: list[Note], documents: Documents, apply: Apply, sources: list[Source]}` (`local_file` excluded from output).
- `scheme_library.loader.load_schemes(content_dir: Path) -> list[Scheme]`: uses `yaml.safe_load`, sorted by a fixed id order, raises on any invalid file.
- `eligibility.engine.evaluate(schemes: list[Scheme], facts: Facts) -> list[Result]`
- `POST /api/eligibility` body `Facts` → `{"results": [Result]}`
- `create_app(static_dir: Path = STATIC_DIR, content_dir: Path = CONTENT_DIR) -> FastAPI`, `CONTENT_DIR = app/content`.

**Evaluation rules:** clause → `unknown` if the fact is `None`, `"unknown"` or in `unknown_values`; else `met`/`not_met` (`min` and `max` are inclusive). A group is `not_met` if any clause is, else `unknown` if any is, else `met`. A condition is `met` if any group is, else `unknown` if any group is, else `not_met`. A `disputed` condition reports `needs_check`. Outcome, in order: not reviewed → `needs_more_information` with `conditions: []` (checks and conflicts are still returned); any `not_met` → `appears_ineligible`; any `unknown` or `needs_check` → `needs_more_information`; else `potentially_eligible`. An amount is shown unless one of its `when` clauses is `not_met`.

**Rule content.** In YAML, quote `"yes"` and `"no"`: unquoted they become booleans. Copy each `quote` word for word from the `local_file` named (folder `data/knowledge/`). Tamil text is drafted by you and checked by the user in Task 2. `review: null` and `government_order_verified: false` in every file.

Sources (id = `local_file` → URL is in its front matter):
- `charter` = `official/social-welfare-and-women-empowerment-citizen-charter-2024-25-c2e3371c.md`
- `nsap` = `official/pib-document-nsap-2025-7ae459f2.md`
- `esevai` = `official/e-sevai-service-list-6f5ff859.md`
- `labour` = `official/labour-and-skill-development-policy-note-2025-26-630e5dae.md`
- `pmjjby` = `official/pib-factsheet-pmjjby-2025-634f7c3a.md`
- `pmsby` = `official/pib-factsheet-pmsby-2025-b19cf5fa.md`; `pmsby_post` = the India Post PMSBY file in `official/` (source of the 18–70 age rule)
- `chennai` = `districts/oap-eligibility-adb7ea2f.md`; `pudukkottai` = `districts/social-security-schemes-3864f581.md`

`T` = clause `lives_in_tn eq "yes"`.

| id | Conditions (all `checkable`) | Amounts | Checks (offices confirm) |
|---|---|---|---|
| `destitute-widow-pension` (`charter`) | T; `widowed eq yes`; `age min 18`; `property_value in [under_50000, 50000_to_100000]` | ₹1,200 a month | destitute; her income and relatives |
| `national-widow-pension` (`charter`, `nsap`) | T; `widowed eq yes`; `age min 40`; `bpl_card eq yes` | ₹1,200 a month in total | destitute; below-poverty-line listing; treatment from age 80 |
| `national-family-benefit` (`nsap`) | `bpl_card eq yes`; `husband_main_earner eq yes`; `husband_age_at_death min 18` and `max 59` | ₹20,000 once | claim deadline (not confirmed; ask now); documents; where to apply in Tamil Nadu |
| `national-old-age-pension` (`charter`) | T; `age min 60`; `bpl_card eq yes` | ₹1,200 a month in total | destitute |
| `construction-board-death` (`labour`) | T; `husband_work eq construction`; any of [`husband_board_registered eq yes`] or [`death_cause eq accident`, `death_at_work eq yes`] | natural ₹50,000 (`when death_cause eq natural`); accident ₹2,00,000 (`when death_cause eq accident`); worksite ₹5,00,000 incl. unregistered (`when` accident and at work); funeral ₹5,000 | registration valid at death; claim deadline; documents; who is the nominee; how worksite amounts relate to the others |
| `manual-board-death` (`labour`) | T; `husband_work eq other_manual` with `unknown_values: [farm_labour, other]`; `husband_board_registered eq yes` | natural ₹30,000; accident ₹1,25,000; funeral ₹5,000 | same, without the nominee-worksite item |
| `pmjjby` (`pmjjby`) | `insurance_deduction in [life, both]`; `husband_age_at_death min 18` and `max 55` | ₹2,00,000 | cover active at death; waiting period; claim deadline; nominee |
| `pmsby` (`pmsby`, `pmsby_post`) | `death_cause eq accident`; `insurance_deduction in [accident, both]`; `husband_age_at_death min 18` and `max 70` | ₹2,00,000 | cover active at death; claim deadline; nominee |

Conflicts to record, each with its source: destitute widow pension: `chennai` says below age 40 and property ₹50,000; `pudukkottai` says property ₹50,000, "up to her son attaining the age of 18 years", and excludes people with certain adult relatives. National widow pension: `nsap` gives ages 40–79 and a different central share from 80; district pages add a property limit.

Documents and applying:
- Destitute widow pension: the nine items on the `esevai` line "Destitute Widow Pension Scheme (DWPS)"; `note`: the charter lists only three. Widow certificate `how`: e-Sevai "Widow Certificate", charge ₹60. Apply: e-Sevai `REV-202`, ₹10.
- Old age pension: the `esevai` IGNOAPS line; `REV-201`, ₹10.
- National widow pension: the charter's three items; apply as the charter's section states; no code.
- Construction and manual: `confirmed: false`; apply: the `esevai` claim services for each board, charge ₹60, no code.
- Family benefit, PMJJBY, PMSBY: `confirmed: false`, apply text "Not confirmed. Ask the office."

`aliases` for the destitute widow pension must include `விதவை உதவித்தொகை`, `vithavai pension`, `widow pension`; give two or more per scheme.

- [ ] **Step 1: Write the failing engine tests** in `tests/eligibility/test_engine.py`

```python
DEMO = dict(lives_in_tn="yes", age=58, widowed="yes", husband_death_when="within_1_year", husband_age_at_death=54,
            death_cause="natural", husband_main_earner="yes", husband_work="construction", husband_board_registered="yes",
            insurance_deduction="unknown", own_income="none", property_value="under_50000",
            adult_relative_at_home="no", bpl_card="yes")
EXPECTED = {
    "destitute-widow-pension": "potentially_eligible", "national-widow-pension": "potentially_eligible",
    "national-family-benefit": "potentially_eligible", "construction-board-death": "potentially_eligible",
    "pmjjby": "needs_more_information", "national-old-age-pension": "appears_ineligible",
    "manual-board-death": "appears_ineligible", "pmsby": "appears_ineligible",
}
def reviewed(schemes):
    return [s.model_copy(update={"review": Review(by="test", on="2026-11-28", checksum=s.checksum())}) for s in schemes]
def outcomes(schemes, **changes):
    facts = Facts(**{**DEMO, **changes})
    return {r.scheme_id: r.outcome for r in evaluate(schemes, facts)}

def test_demo_story(schemes):
    assert outcomes(reviewed(schemes)) == EXPECTED

def test_unreviewed_rules_never_give_another_outcome(schemes):
    results = evaluate([s.model_copy(update={"review": None}) for s in schemes], Facts(**DEMO))
    assert {r.outcome for r in results} == {"needs_more_information"}
    assert all(r.conditions == [] and not r.reviewed for r in results)

def test_editing_a_reviewed_rule_makes_it_unreviewed(schemes):
    rule = reviewed(schemes)[0]
    assert rule.reviewed
    rule.conditions[0].any_of[0][0].value = "no"
    assert not rule.reviewed

@pytest.mark.parametrize("value", [None, "unknown"])
def test_unknown_is_never_no(schemes, value):
    assert outcomes(reviewed(schemes), bpl_card=value)["national-widow-pension"] == "needs_more_information"

@pytest.mark.parametrize("field, value, scheme, expected", [
    ("age", 17, "destitute-widow-pension", "appears_ineligible"),
    ("age", 18, "destitute-widow-pension", "potentially_eligible"),
    ("age", 59, "national-old-age-pension", "appears_ineligible"),
    ("age", 60, "national-old-age-pension", "potentially_eligible"),
    ("husband_age_at_death", 59, "national-family-benefit", "potentially_eligible"),
    ("husband_age_at_death", 60, "national-family-benefit", "appears_ineligible"),
    ("husband_age_at_death", 56, "pmjjby", "appears_ineligible"),
    ("property_value", "50000_to_100000", "destitute-widow-pension", "potentially_eligible"),
    ("property_value", "over_100000", "destitute-widow-pension", "appears_ineligible"),
    ("husband_work", "farm_labour", "manual-board-death", "needs_more_information"),
])
def test_edges(schemes, field, value, scheme, expected):
    assert outcomes(reviewed(schemes), **{field: value})[scheme] == expected

def test_worksite_route_needs_an_accident(schemes):
    r = reviewed(schemes)
    base = dict(husband_board_registered="no")
    assert outcomes(r, **base, death_cause="natural", death_at_work="yes")["construction-board-death"] == "appears_ineligible"
    assert outcomes(r, **base, death_cause="accident", death_at_work="yes")["construction-board-death"] == "potentially_eligible"

def test_disputed_condition_needs_information(schemes):
    r = reviewed(schemes)
    r[0].conditions[0].kind = "disputed"
    r[0].review.checksum = r[0].checksum()
    assert {x.scheme_id: x.outcome for x in evaluate(r, Facts(**DEMO))}[r[0].id] == "needs_more_information"

def test_destitute_is_a_check_not_a_condition(schemes):
    result = next(x for x in evaluate(reviewed(schemes), Facts(**DEMO)) if x.scheme_id == "destitute-widow-pension")
    assert any("destitute" in c.text.en.lower() for c in result.checks) and result.conflicts
```

`schemes` is a fixture in `tests/conftest.py` returning `load_schemes(CONTENT_DIR)`.

- [ ] **Step 2: Write the failing library and API tests**
  - `test_loads_eight_rules`: ids equal the eight in the table.
  - `test_every_quote_is_in_its_source`: for each source with `local_file`, after collapsing whitespace the `quote` is a substring of the file; skip if `data/knowledge` is absent.
  - `test_bad_reference_is_rejected`: a rule whose condition names a missing source or unknown fact raises.
  - API: `POST /api/eligibility` with `DEMO` returns eight results and, with the committed unreviewed files, only `needs_more_information`; an extra field `aadhaar` returns 422; `{}` returns 200.
- [ ] **Step 3:** Run `cd backend && .venv/bin/pytest`. Expected: new tests fail on missing modules.
- [ ] **Step 4:** Implement contracts, loader, engine, route, and `scripts/review_checksum.py <slug>` (prints the checksum). Load rules once in `create_app`; an invalid rule stops startup. Register routes before the static mount.
- [ ] **Step 5:** Write the eight YAML files. Run `.venv/bin/pytest`. Expected: all pass, including the quote test with no skips on this machine.
- [ ] **Step 6: Commit** `feat: add reviewed-rule format, eligibility engine and widow rules`.
- [ ] **Step 7: Send rules for review** as each is ready, pension and family rules first. For each, the teammate compares conditions, amounts and checks with the linked source, then fills `review: {by: <initials>, on: <date>, checksum: <from the script>}`. Never fill this in yourself.

**Done when:** tests pass and the first rules are with the reviewer.

---

### Task 2: Widow screen (Phase 2, aim Sat 23:00)

**Files:** Create `contracts/content.py`, `api/content.py`, `content/lines/{en,ta}.yaml`, `frontend/src/api.ts`, `frontend/src/journey/{Language,Questions,Confirm,Results,Documents}.tsx`; test `tests/api/test_content.py`. Modify `frontend/src/App.tsx`, `main.py`.

**Interfaces:** Consumes `Facts`, `Result`, `POST /api/eligibility`. Produces `GET /api/content/{lang}` (`en`, `ta`; otherwise 404) → `{ui: {key: str}, questions: [{id, type: "choice"|"number"|"select", text, options?: [{value, label}], min?, max?, show_if?: {fact: [values]}}]}`.

**Questions, in order, with `show_if`:** `lives_in_tn`; `district`, `area` (`lives_in_tn` yes or unknown); `age`; `widowed`; `husband_death_when`, `husband_age_at_death`, `death_cause` (`widowed` yes); `death_at_work` (`death_cause` accident); `husband_main_earner`, `husband_work` (`widowed` yes); `husband_board_registered` (`husband_work` in construction, other_manual, farm_labour, other, unknown); `insurance_deduction` (`widowed` yes); `own_income`, `property_value`, `adult_relative_at_home`, `bpl_card`.

A question is visible when every `show_if` fact has a visible answer in its list. **Only answers to visible questions are sent.** Every question has "I don't know"; for numbers it is a button that leaves the field out.

- [ ] **Step 1: Failing test** `tests/api/test_content.py`: `en` and `ta` have the same `ui` keys, question ids in the same order and the same option values; question ids equal the `Facts` fields; every option value is accepted by `Facts`; every `show_if` refers to an earlier question; `/api/content/hi` is 404.
- [ ] **Step 2:** Run it (fails), implement the route and both YAML files, run it (passes).
- [ ] **Step 3: Screen.** State in `App`: language, step (`language | questions | confirm | results | documents`), answers. Nothing in browser storage.
  - Language: Tamil and English work; Hindi and Telugu disabled, "coming soon". Keep the health notices from the starter ("Sarvam key not set", "Cannot reach the Urimai server"). Say that answers are lost on reload.
  - Questions: one at a time, Back button, targets at least 48px, `lang` set on the container.
  - Confirm: visible answers with an edit button each. Evaluate only on the confirm button.
  - Results: three groups in the order may be eligible, needs more information, appears not eligible. Each card: name, outcome words, amounts (when not appears-ineligible), per-condition reasons, checks, conflicts, source title, link and date, where to apply (naming the chosen district) with code and charge or "Not confirmed. Ask the office.", and "not yet reviewed" when `reviewed` is false. Always show that nothing here guarantees eligibility or approval.
  - Documents (offered when not appears-ineligible): one at a time, "I have it" / "I don't have it"; show `how` only when present; end with the list still needed; show the `note`. `confirmed: false` shows "Not confirmed. Ask the office."
  - A failed evaluate request keeps the answers and offers "Try again".
- [ ] **Step 4:** `cd frontend && npm run build`. Expected: no type errors.
- [ ] **Step 5: Browser check** at 360px against `docker compose up --build`:
  - The demo story in English and in Tamil reaches results; no horizontal scroll; no console errors except the favicon.
  - With unreviewed rules every card says "not yet reviewed" and "needs more information".
  - After choosing accident + at work, edit cause to natural: the confirm list no longer shows "at work", and the request body (network panel) has no `death_at_work`.
  - "I don't know" on the poverty-line card moves the national widow pension out of "may be eligible" (reviewed copies in a local, uncommitted edit; revert afterwards).
- [ ] **Step 6:** Ask the user to check the Tamil text in `ta.yaml` and the rules' Tamil.
- [ ] **Step 7: Commit** `feat: add widow journey screen`. **Ask to push and merge: this is the first complete demo.**

---

### Task 3: Postgres and loader (Phase 3, aim Sun 08:30)

**Files:** Create `knowledge_search/{text.py,store.py,schema.sql}`; tests `tests/knowledge_search/{test_text.py,test_store.py}`, fixture `tests/fixtures/seed/passages.jsonl` (3 passages). Modify `docker-compose.yml`, `.env.example`, `requirements.txt` (`psycopg[binary]==3.3.9`), `main.py`, `tests/test_main.py` (health shape).

**Interfaces (Produces):**
- `text.normalise(s: str) -> str`: NFC, replace `ா்` (U+0BBE U+0BCD) with `ர்` (U+0BB0 U+0BCD), collapse whitespace.
- `store.data_version(search_dir: Path, schemes: list[dict]) -> str` (SHA-256 over the search files and rules)
- `store.load(conn, search_dir: Path, schemes: list[dict]) -> bool` (False if already current)
- `passages.jsonl` line: `{"id": int, "text": str, "documents": [{"url", "title", "source_type", "jurisdiction", "source_date", "language"}]}`. `vectors.npy` is optional until Task 5; the column is nullable. A missing `passages.jsonl` means zero passages.
- `GET /api/health` → `{"status": "ok", "sarvam_configured": bool, "database": bool, "semantic_search": bool, "data_version": str | null}`

Tables: `scheme(id text primary key, record jsonb)`, `document(id serial primary key, url text unique, title, source_type, jurisdiction, source_date, language)`, `passage(id int primary key, text, search_text, embedding vector(384), content_hash text unique)`, `passage_source(passage_id, document_id)`, `meta(key text primary key, value text)`; `create extension if not exists vector`.

**Compose:** `db` with image `pgvector/pgvector:0.8.7-pg17`, volume `pgdata:/var/lib/postgresql/data`, `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-urimai_local}`, `POSTGRES_USER` and `POSTGRES_DB` `urimai`, healthcheck `pg_isready -h 127.0.0.1 -U urimai` every 3s, 20 retries, no `ports`. `app` gets `depends_on: db: condition: service_healthy` and `DATABASE_URL` built from the same password. No `env_file`. Add `POSTGRES_PASSWORD=` with a comment to `.env.example`: leave empty for the local default; use letters and digits only.

- [ ] **Step 1: Failing tests.** `test_text.py`: `normalise("அவா்  க\n") == "அவர் க"`. `test_store.py` (skipped unless `TEST_DATABASE_URL` is set): first `load` returns True and loads 3 passages and 8 schemes; second returns False with the same counts; changing a fixture line and loading again returns True with no duplicates. `test_main.py`: without `DATABASE_URL`, health has `database: false`, `semantic_search: false`, `data_version: null`.
- [ ] **Step 2:** Run a throwaway database: `docker run -d --rm --name urimai-testdb -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 pgvector/pgvector:0.8.7-pg17`. Run tests with `TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/postgres`. Expected: fail on missing modules.
- [ ] **Step 3:** Implement. `load` replaces the five tables' contents in one transaction. In `main.py`, a background thread started in the app lifespan connects and loads, retrying every 3s; no `DATABASE_URL` means no thread. Requests never wait on it. `/api/health` always returns 200.
- [ ] **Step 4:** Tests pass. Then `docker stop urimai-testdb`.
- [ ] **Step 5: Docker checks.** Own project name, removing only that project's volume: `docker compose -p urimai-check down -v && docker compose -p urimai-check up --build -d`. Health shows `database: true`. `docker compose -p urimai-check restart app`: counts unchanged. `docker compose -p urimai-check stop db`: the screen loads and `POST /api/eligibility` returns 200; health shows `database: false`. Finish with `down -v`. If port 3000 is busy, ask the user; do not stop their processes.
- [ ] **Step 6: Commit** `feat: add Postgres service and data loader`.

---

### Task 4: Keyword search and question box (Phase 4, aim Sun 10:00)

**Files:** Create `content/search/{sources.yaml,passages.jsonl,manifest.json}`, `scripts/{build_knowledge.py,eval_search.py}`, `knowledge_search/search.py`, `api/search.py`, `frontend/src/journey/Ask.tsx`, `tests/search_eval/questions.yaml`; tests `tests/knowledge_search/test_search.py`, `tests/scripts/test_build.py`, `tests/api/test_search.py`. Add `tokenizers==0.23.3` to `requirements.txt`.

**Interfaces (Produces):**
- `build_knowledge.chunk(text: str, count_tokens: Callable[[str], int], limit=450, overlap=50) -> list[str]`: every chunk, with the `passage: ` prefix, is at most `limit` tokens.
- `build_knowledge.dedupe(items: list[dict]) -> list[dict]`: identical `normalise`d text becomes one item holding all its documents.
- `sources.yaml`: `[{path, reason, checked_for_personal_data_by}]`; paths relative to `data/knowledge/`. The build refuses an entry that is not `extraction_quality: ok`, is `unofficial`, or has an empty checker.
- `search.keyword_query(query: str, aliases: dict[str, list[str]]) -> str`: tokens from `re.findall(r"[^\s!-/:-@\[-`{-~।]+", normalise(query))` (keeps Tamil marks), each `token:*`, joined with ` | `; if an alias occurs in the query, add that scheme's name tokens; empty if no tokens.
- `search.search(conn, query: str, limit: int, aliases, embed: Callable[[str], list[float]] | None) -> {"mode": "keyword"|"hybrid", "results": [{"text", "title", "url", "source_type", "jurisdiction", "source_date"}]}`: uses the `simple` configuration. `embed` stays `None` in this task.
- `POST /api/search {"query": str, "limit": int = 5 (1–10)}`: blank or over 500 characters → 422; no database → 503.

- [ ] **Step 1: Failing tests:** `chunk` respects the limit with a fake token counter and overlaps; `dedupe` keeps both URLs; the build rejects an `unofficial` entry; `keyword_query("a' | !b (x)", {})` contains no characters from the input other than letters and digits besides `:*` and ` | `; a Tamil word stays one token; API 422 for `""` and 501 characters, 503 without a database; with the test database, searching `widow` finds the fixture passage and an unmatched word returns `[]`.
- [ ] **Step 2:** Run (fail), implement, run (pass).
- [ ] **Step 3: Select documents** for the eight rules in `sources.yaml`, starting from the rule sources (use only `ok` ones) plus the Tamil pension pages. **The user or teammate checks each for personal data** and is named in the file.
- [ ] **Step 4:** Download `tokenizer.json` (URL and checksum in Task 5) to a scratch folder, run `build_knowledge.py`, and scan `passages.jsonl` for 10-digit mobile numbers and e-mail addresses. Expected: only office contacts; remove any private person's.
- [ ] **Step 5: Test questions, before any tuning.** `questions.yaml`: `{id, lang, question, expect_url, expect_text, written_by, checked_by_speaker}`. About 20: the user writes Tamil, English and mixed ones; you draft Hindi and Telugu with `checked_by_speaker: false`. `expect_text` must exist in a passage from `expect_url`. `eval_search.py` prints per-language and total top-3 hits for `keyword` and, when available, `hybrid`.
- [ ] **Step 6: Question box.** On the results screen and the language screen. Label text exactly: "These are passages from official documents. They are not an answer or advice. Some may be old or in English. Your result above comes from the checked rules." (omit the last sentence where there is no result). Each result shows title, link, source type, jurisdiction and source date or "date not shown". 503 or network failure shows "Search is not available right now".
- [ ] **Step 7:** Build, run Docker, check at 360px that a question shows passages and results above are unchanged. Run `eval_search.py` and record the keyword score in the commit message.
- [ ] **Step 8: Commit** `feat: add keyword search over selected official text`.

---

### Task 5: Semantic search (Phase 5, aim Sun 11:30)

**Files:** Create `knowledge_search/{embedder.py,embed.py}`, `scripts/fetch_model.py`, `content/search/vectors.npy`; test `tests/knowledge_search/test_embedder.py`. Modify `Dockerfile`, `requirements.txt` (`onnxruntime==1.32.0`, `numpy==2.4.6`), `search.py`, `main.py`, `manifest.json`.

**Pinned model:** `https://huggingface.co/intfloat/multilingual-e5-small/resolve/614241f622f53c4eeff9890bdc4f31cfecc418b3/<file>`

| File | SHA-256 |
|---|---|
| `tokenizer.json` | `0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39` |
| `onnx/model_qint8_avx512_vnni.onnx` (try first, about 118 MB) | `dd476dd0c2514e9b9be83aeb3853fac0763e0bdf4a71645407587d77c48a2d88` |
| `onnx/model.onnx` (fallback, about 470 MB) | `ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665` |

**Interfaces:** `embedder.Embedder.load(model_dir: Path) -> Embedder | None` (None if files are absent or fail to load); `encode(texts: list[str], prefix: Literal["query: ", "passage: "]) -> np.ndarray` of shape `(n, 384)`, float32, unit length; truncate at 512 tokens; feed only the inputs the ONNX session declares; mean-pool with the attention mask. `python -m app.knowledge_search.embed <search_dir>` writes `vectors.npy` and records model file and checksum in `manifest.json`. It also writes `near_duplicates.tsv` beside them (pairs with similarity 0.97 or higher, marking pairs whose numbers differ). Move that file to the scratch folder for review; do not commit it, and delete nothing automatically. `search` with `embed` takes the top 20 of each ranking and combines them by reciprocal rank fusion, `1 / (60 + rank)`.

**Dockerfile:** a `model` stage runs `fetch_model.py /model` (3 attempts, checksum verified). On final failure it exits 0 leaving `/model` empty, so the build continues. Copy `/model` into the final image.

- [ ] **Step 1: Failing tests:** `load` of an empty folder returns None; with `None`, search reports `keyword`; a manifest naming a different model checksum keeps `semantic_search: false`; if `MODEL_DIR` is set, vectors have shape `(n, 384)`, unit length, and "widow pension" is closer to "விதவை ஓய்வூதியம்" than to "bus ticket fare".
- [ ] **Step 2:** Run (fail), implement, run (pass). Load the model in the same background thread as the data.
- [ ] **Step 3:** Create vectors inside the image: `docker compose build app && docker compose run --rm --no-deps --user "$(id -u)" -v "$PWD/backend/app/content/search:/out" app python -m app.knowledge_search.embed /out`. Rebuild.
- [ ] **Step 4:** Run `eval_search.py` against the running app. **Keep only if** hybrid top-3 hits ≥ keyword hits + 3. If the compressed file fails or looks clearly worse than the full file, repeat with the full file.
- [ ] **Step 5:** `docker build --platform linux/amd64 -t urimai-amd64 .`, run it with a test database, and run one search. Expected: `mode: hybrid`.
- [ ] **Step 6:** Check a build with a bad model URL (temporary edit) still starts in keyword mode. Revert.
- [ ] **Step 7:** Record image size, `docker stats` memory, build time and start time.
- [ ] **Step 8:** If the keep rule or amd64 fails: do not merge this branch, and tell the user the numbers. Otherwise **commit** `feat: add local semantic search`.

---

### Task 6: Final check (Phase 6, aim Sun 12:00)

- [ ] On the last working version: update `README.md` and `CLAUDE.md` (commands, services, code layout, data rules, what is unreviewed). Do not edit `docs/architecture.md`; tell the teammate where it differs.
- [ ] Run all backend tests and `npm run build`.
- [ ] Clone into an empty folder in the scratchpad, no `.env`: `docker compose -p urimai-final build --no-cache && docker compose -p urimai-final up -d`. Check the demo story at 360px and desktop width, health, and one search if included. `down -v` for that project only.
- [ ] `git ls-files data` prints nothing. Scan the commit for private mobile numbers, e-mail addresses and local paths.
- [ ] Count original code lines (the entry needs about 300 or more).
- [ ] List unreviewed rules and anything left out.
- [ ] **Ask before pushing, opening the PR and merging.** After merging, repeat the clean-clone check from GitHub.
