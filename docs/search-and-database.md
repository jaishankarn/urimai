# Database and search: recommendation

28 Nov 2026. Status: **replaced** by [the data and search design](superpowers/specs/2026-11-28-data-and-search-design.md) (PostgreSQL with pgvector). Kept for its test results.

## Recommendation
**Use SQLite (one file). Decide eligibility with checked rules, not search. Start with keyword search. Add semantic search next only if our test questions show we need it, stored in the same app. Do not add a separate vector database.**

## Why search must not decide eligibility
In our test, the top keyword result for `destitute widow pension` was a [2021 Chennai page](https://chennai.nic.in/oap-eligibility/) saying applicants must be **below 40**. For our 58-year-old widow, an AI answering from that passage could wrongly say she does not qualify.

The [Social Welfare citizen charter 2024-25](https://cms.tn.gov.in/cms_migrated/document/docfiles/swwe_e_cc_2024_25.pdf) says: Rs.1,200 a month; destitute; 18 and above; widow; property not above Rs.1,00,000. Its entry shows no upper age and no condition about sons. Readable documents also state Rs.1,000 (for example myScheme), and an old one says Rs.200. **More documents mean more conflicts.**

## Two stores in one app

| Store | Contents | Used for |
|---|---|---|
| **1. Checked rules** | A few dozen schemes at most, starting with the demo ones. JSON files in git, reviewed by a person | Eligibility, amounts, documents, questions, form fields |
| **2. Search index** | Passages from readable official documents | Answering "what is / how do I", always showing source and date |

Each rule record keeps: conditions, source link, exact quote, source date, checked date, who checked it, and conflicting sources. If a condition is disputed, the answer is "needs more information".

For search: index only `ok`, non-`unofficial` documents; start with the demo topics; rank newer state department sources above old district pages; never let a passage change an eligibility result.

## What we measured
SQLite 3.54.0, all 2,075 readable official and aggregator documents, 9,423 passages of about 1,500 characters:

| Test | Result |
|---|---|
| Build time and size | 0.4 s, 28 MB |
| Query time | about 1 ms or less |
| Default tokenizer on Tamil | **Breaks words into fragments** |
| With `unicode61 categories 'L* N* Co M*'` | Tamil words stay whole |
| Exact Tamil phrase | 11 passages |
| Tamil prefix `விதவை*` | 161 passages (helps with word endings) |
| Tamil typed in English letters (`vithavai pension`) | 0 |
| `husband died any help` (all words required) | 0 |

This was a check that search runs, **not a measure of answer quality**. Also normalise the Tamil spelling variant where `ா்` is typed for `ர்`, in both documents and queries.

## Do we need semantic search?
**Probably, for open questions.** Of the roughly 700 topic-matched readable documents, about 500 are in English. A Tamil question will not keyword-match English text. Ways to close that gap, simplest first:

1. **Scheme aliases** in the rules store, in Tamil, Tamil in English letters and English. No model or key. Covers naming a scheme or situation we listed.
2. **AI rewrites the question** into search terms, when a key is set. No extra download, since the app will need an AI model anyway.
3. **Embeddings:** compute passage vectors once on our machines; compare in memory or with the `sqlite-vec` extension. The topic-matched set is about 4,800 passages, small enough to compare one by one. The catch: **each user question also needs a vector at run time**, from a paid or keyed service or a model inside the container.

Choose the embedding option only after testing about 20 real Tamil, mixed and English questions against steps 1 and 2.

## Why not other options
| Option | Why not now |
|---|---|
| Qdrant, Chroma or another vector server | Another service to run and break at startup; our volume is tiny |
| PostgreSQL with pgvector | Needs a database container; good later for many users writing at once |
| Large local model (the architecture proposes about 2.2 GB) | Slow build and download, high memory use, risk to the "must start" rule. Smaller models exist but are untested here |

## Saved journeys
Keep them in the browser, as proposed earlier. The knowledge database is read-only and holds no user data. `docs/architecture.md` proposes server-side saving with a 4-digit code; that is guessable and still needs a team decision.

## Plan until the deadline
1. Write checked rules for the widow story, then the disability story. **This is what the demo depends on.**
2. Build the SQLite keyword index at Docker build time from selected documents, with no key and no download of a model.
3. Add aliases; test the 20 questions.
4. Add embeddings only if time remains and the test calls for it.
