# Use cases and relevant benefits

Collected on 28 Nov 2026 for the demo build. **Nothing here is verified against a government order.** Treat every scheme as *not yet verified* in the app. A match below means "may be relevant", never "eligible" or "approved". The stories are made up.

**More research** (location, questions to ask, death benefits, e-Sevai documents): [benefits-research.md](benefits-research.md).

**Current decisions are in the [design](superpowers/specs/2026-11-28-data-and-search-design.md).** These notes are earlier research: where they differ (for example on "destitute" and on which source wins a conflict), the design applies.

**Primary demo story: UC1, the widow.** UC2 is the suggested short second story (not yet decided).

## How reliable is each fact?

| Mark | Meaning |
|---|---|
| **[S]** | State page, from the team's saved copy ([sources/cra-social-security-schemes.ta.md](sources/cra-social-security-schemes.ta.md)). The live address returned "404 Not Found" on 28 Nov 2026. |
| **[N]** | National government document, Nov 2025 ([N1](#sources)) |
| **[D]** | District government website. Pages vary in age and sometimes disagree. |
| **[U]** | Unconfirmed: unofficial sites or search summaries only. **Do not show as fact in the app.** |

Where sources disagree, the tables use [S] for state pensions and [N] for national rules. See [Open conflicts](#open-conflicts).

---

## UC1. Widow (primary)

> "I am 58, my husband passed away, is there any help?"

Assumes she lives in Tamil Nadu, which Urimai must ask.

| Benefit | What she could get | Result from this sentence alone | Still to ask |
|---|---|---|---|
| [Destitute Widow Pension](#a-destitute-widow-pension) | ₹1,200 a month [S] | Needs more information | Income, property value, adult son or relatives at home |
| [National Widow Pension](#b-national-widow-pension-ignwps) | ₹1,200 a month in total: ₹300 central + ₹900 state [S] | Needs more information; age fits | Below poverty line, plus the destitute questions |
| [National Family Benefit](#c-national-family-benefit-nfbs) | ₹20,000 once, for the family [N] | Needs more information | Was he the main earner? His age at death? Below poverty line? **When did he die?** |
| [National Old Age Pension](#d-national-old-age-pension-ignoaps) | ₹1,200 a month [S] | Appears not eligible now (needs age 60) | Nothing |
| [Welfare board death benefits](benefits-research.md#tamil-nadu-welfare-boards) | Depends on board and cause of death | Needs more information | His work, board registration, cause of death, claim deadline |
| [Bank-linked insurance](benefits-research.md#insurance-through-a-bank-account) | ₹2,00,000 per scheme if covered | Needs more information | Was he enrolled and covered? |
| [Widows' welfare board](benefits-research.md#widows-deserted-destitute-and-unmarried-women) | Membership and support | May be relevant | Current registration process and benefits |
| [Magalir Urimai Thogai](#j-kalaignar-magalir-urimai-thogai) | ₹1,000 a month [U] | Do not assess yet | Rules unconfirmed, including whether a pensioner can get it |
| [Health insurance](#k-chief-ministers-health-insurance-cmchis) | Hospital cover [U] | Do not assess yet | Income limit unconfirmed |

**If a pension is approved**, [pensioner extras](#pensioner-extras) may apply. We have not confirmed whether she can receive more than one of these benefits. **Do not add the amounts together.**

**Questions the demo should ask** (full list in [benefits-research.md](benefits-research.md#what-to-ask)): Tamil Nadu, district, village or city? What work did he do, and was he registered? Any income? Value of house or land? Is there a son, grandson or other relative aged 18 or over living with you, and how old is your son? Do you have a below-poverty-line card or number? Was your husband the main earner, how old was he, and when did he die?

**Watch out:** the Tamil example in [prompt.md](prompt.md) says he died five years ago. Unofficial sites give a deadline of one or two years for the family benefit [U]. Confirm this before the demo suggests it.

---

## UC2. Young man with a disability (suggested second story)

> "I'm 28. I lost my leg in an accident and don't have a job. My certificate says 60% disability."

| Benefit | What he could get | Result | Still to ask |
|---|---|---|---|
| [State Disability Pension](#e-state-disability-pension) | ₹1,500 a month [S] | Needs more information; age and disability percentage fit | Any private or self-employment income |
| [National Disability Pension](#f-national-disability-pension-igndps) | ₹1,500 a month [S] | Appears not eligible: page requires 80% | One district page says 60% [D] |
| [Artificial limb and mobility aids](#disability-support) | Device [D] | May be relevant | District office rules |
| [National aids and appliances (ADIP)](benefits-research.md#disability-national-aids-and-appliances-uc2-q) | Subsidy for aids or an artificial limb [U] | Do not assess yet | Family income, current limits |
| [Bus fare concession](#disability-support) | 75% off government buses [D] | May be relevant | Disability ID card |
| [Disability ID card (UDID)](#disability-support) | Identity card [D] | May be relevant | Does he already have one? |
| [Health insurance](#k-chief-ministers-health-insurance-cmchis) | Up to ₹5 lakh, no income limit for families of people with disabilities [D] | Needs confirmation | Current cover and enrolment |

---

## UC3. Older farm labourer

> "I'm 63. I worked on other people's farms, but I can't work now. I have no land and nobody to support me."

| Benefit | What they could get | Result | Still to ask |
|---|---|---|---|
| [Farmers' Protection Old Age Pension](#g-chief-ministers-farmers-protection-old-age-pension) | ₹1,200 a month [S] | Needs more information; age and landlessness fit | Property value, scheme membership card [D] |
| [National Old Age Pension](#d-national-old-age-pension-ignoaps) | ₹1,200 a month [S] | Needs more information; age fits | Below poverty line |
| Annapurna food grain | 10 kg a month [N] | Only for people eligible for the national old age pension who are **not** receiving it | Pension status |

---

## UC4. Woman whose husband left

> "My husband left six years ago. I'm 35, with two children, and struggling to manage."

| Benefit | What she could get | Result | Still to ask |
|---|---|---|---|
| [Destitute or Deserted Women Pension](#h-destitute-or-deserted-women-pension) | ₹1,200 a month [S] | Needs more information; age and years fit | Property, income, relatives, proof of desertion |
| [Widows' welfare board](benefits-research.md#widows-deserted-destitute-and-unmarried-women) | Membership and support | May be relevant | Current process |
| [Child sponsorship](benefits-research.md#widows-deserted-destitute-and-unmarried-women) | ₹4,000 a month per child [U] | Do not assess yet | Income rules, ages, process |
| Free sewing machine | Machine [D] | Needs more information | Age 20–40, income up to ₹72,000 and tailoring knowledge or certificate; limits differ by page |
| [Magalir Urimai Thogai](#j-kalaignar-magalir-urimai-thogai) | ₹1,000 a month [U] | Do not assess yet | Rules unconfirmed |

Child benefits are only partly researched.

---

## UC5. Older unmarried woman

> "I'm 52 and never married. My parents have died, and I have no regular support."

| Benefit | What she could get | Result | Still to ask |
|---|---|---|---|
| [Unmarried Women Pension](#i-unmarried-women-pension) | ₹1,200 a month [S] | Needs more information; age and marital status fit | Property, any income, relatives |
| [Widows' welfare board](benefits-research.md#widows-deserted-destitute-and-unmarried-women) (open to unmarried women) | Membership and support | May be relevant | Current process |
| [Magalir Urimai Thogai](#j-kalaignar-magalir-urimai-thogai) | ₹1,000 a month [U] | Do not assess yet | Rules unconfirmed |

---

## UC6. Daughter asking for her family

> "My father died at 45. He was the only one earning, and I'm asking for help for my mother."

| Benefit | What the family could get | Result | Still to ask |
|---|---|---|---|
| [National Family Benefit](#c-national-family-benefit-nfbs) | ₹20,000 once [N] | Needs more information; his age and earner role fit | Below poverty line, when he died, who should apply |
| [Destitute Widow Pension](#a-destitute-widow-pension) (mother) | ₹1,200 a month [S] | Needs more information | Mother's age, income, property, relatives |
| [National Widow Pension](#b-national-widow-pension-ignwps) (mother) | ₹1,200 a month [S] | Needs more information | Mother's age (40 or older), below poverty line |

Keep the daughter's details separate from her mother's.

---

## Scheme details

**"Destitute"** is a condition of most pensions. The state page does not define it [S]. Two district pages [D2, D3] give this wording near their destitute condition:

> "Without any income or source of income owning fixed assets valuing less than Rs.50000/- who have no relative of 18 years of age and over of the following category son, son's son and other related persons who normally live together"

Another district page [D1] uses ₹1,00,000 and the extract we checked had no relative condition. **We have no official, current definition.** Until we do, "destitute" is not confirmed by what the user says.

### A. Destitute Widow Pension
- **Rules [S]:** destitute widow; 18 or older; immovable property not above ₹1,00,000.
- **Other district wording [D]:** "up to her son attaining the age of 18 years" [D2, D3]; age below 40 [D4]. See conflicts.
- **Documents [D]:** photo, ration or smart card, Aadhaar, voter ID, bank passbook, husband's death certificate, widow certificate [D4]. Another district also lists nativity certificate and age proof [D5].

### B. National Widow Pension (IGNWPS)
- **Rules:** widow aged 40–79 in a family below the poverty line [N]. The state page also requires "destitute" and gives only the lower age of 40 [S]. At 80 or older, the central share is ₹500 [N].
- **Documents [D]:** as for A, plus the below-poverty-line number [D4].

### C. National Family Benefit (NFBS)
- **Benefit and rules [N]:** ₹20,000 to a household below the poverty line after the death of its main earner, who was 18–59.
- **Not confirmed [U]:** application deadline (sites say one or two years), documents (commonly death certificate, poverty-line proof, applicant ID, the earner's age proof, bank details) and the Tamil Nadu application process. A district page lists a "Family Distress Relief Scheme" of ₹20,000; we have not confirmed it is the same scheme.

### D. National Old Age Pension (IGNOAPS)
- **Rules:** 60 or older and below the poverty line [N]; the state page also requires "destitute" [S].
- **Total [S]:** ₹1,200 a month (60–79: ₹200 central + ₹1,000 state; 80 or older: ₹500 + ₹700).
- **Documents [D]:** photo, ration or smart card, Aadhaar, voter ID, bank passbook, below-poverty-line number [D4].

### E. State Disability Pension
- **Rules [S]:** 18 or older; disability 40% or more; unemployed; annual income not above ₹3 lakh for those in private work or self-employment. The unemployment and income conditions need clarification.
- **District wording [D]:** excludes permanent government employees, and private salaried or self-employed people earning above ₹3 lakh a year [D1].
- **Documents [D]:** photo, ration or smart card, Aadhaar, voter ID, bank passbook, UDID card, disability passbook [D4].

### F. National Disability Pension (IGNDPS)
- **Rules:** 18–79, severe or multiple disabilities, below the poverty line [N]; 80% or more, and 18 or older [S]. At 80 or older, the central share is ₹500 [N].
- **Total [S]:** ₹1,500 a month (₹300 central + ₹1,200 state).

### G. Chief Minister's Farmers' Protection Old Age Pension
- **Rules [S]:** destitute; 60 or older; landless farm labourer; immovable property not above ₹1,00,000.
- **District additions [D]:** unable to earn and enrolled in the scheme [D1, D2].
- **Documents [D]:** photo, ration or smart card, Aadhaar, voter ID, bank passbook, scheme card [D4].

### H. Destitute or Deserted Women Pension
- **Rules [S]:** destitute; 30 or older; legally divorced, deserted for at least 5 years, or legally separated with a court certificate; immovable property not above ₹1,00,000.
- **Documents [D]:** photo, ration or smart card, Aadhaar, voter ID, bank passbook, deserted woman certificate or divorce certificate [D4].

### I. Unmarried Women Pension
- **Rules [S]:** destitute, unmarried woman; 50 or older; immovable property not above ₹1,00,000. District pages add no income from other sources [D1, D2].
- **Documents [D]:** photo, ration or smart card, Aadhaar, voter ID, bank passbook, unmarried woman certificate [D4].

### J. Kalaignar Magalir Urimai Thogai
- **All [U]:** ₹1,000 a month to women heads of households. Search summaries report an annual household income limit of ₹2.5 lakh and other exclusions. They also suggest other women in some pensioners' households can qualify, but not clearly the pensioner herself.
- The official site, `kmut.tn.gov.in`, could not be opened by our tool (expired certificate).

### K. Chief Minister's Health Insurance (CMCHIS)
- **General rules [U]:** sources give annual income limits of ₹72,000 or ₹1,20,000. Cover is often reported as ₹5 lakh per family per year.
- **Disability [D]:** families of people with disabilities, no income limit [D6, D7]; up to ₹5 lakh [D7].

### Disability support
- **UDID card [D]:** apply at swavlambancard.gov.in; disability certificate, Aadhaar and photo [D7]. Another district asks for more documents [D6].
- **Devices [D]:** artificial and modular limbs, calipers, crutches, wheelchairs and more, through the District Differently Abled Welfare Office [D6, D7].
- **Bus [D]:** 75% concession on government buses with the disability ID card [D6, D7].
- **Maintenance allowance (not matched for UC2) [D]:** for listed conditions, or severe disability of 75% or more. District pages say ₹1,500; a 2022–23 policy note found by search says ₹2,000.

### Pensioner extras
From the state page [S]: a saree (women) or dhoti (men) at Pongal and Deepavali, and free rice. It lists 4 kg a month for those who don't eat at an Anganwadi centre, 2 kg for those who do, and 5 kg under the National Food Security Act. Confirm how these combine.

### How to apply for the pensions
- Online at <https://www.tnesevai.tn.gov.in>. Revenue officials check applications, and the Special Tahsildar (Social Security Schemes) orders payment [S].
- The state page says applications are decided within 30 days [S].
- The official e-Sevai service codes, charges and document lists are in [benefits-research.md](benefits-research.md#what-e-sevai-lists). Prefer them over the district document lists above.
- **We found no official downloadable application form or list of form fields.** Any form in our app must be labelled as our own, not the official one.
- Aadhaar and bank passbooks appear in document lists. Urimai may name them in a checklist but must not ask for their numbers.

## Open conflicts

| Topic | Disagreement | Affects | Until resolved |
|---|---|---|---|
| Meaning of "destitute" | No definition on the state page; district wording differs | All destitute pensions | "Needs more information" |
| Adult relatives at home | Some district pages exclude them [D2, D3]; state page is silent | UC1, UC3–UC6 | Ask, and flag for official check |
| Widow's son turns 18 | Some district pages limit the widow pension [D2, D3] | **UC1**, UC6 | Ask son's age; do not decide |
| Widow pension upper age | One district page says below 40 [D4]; state page gives no upper age | **UC1** | Do not show UC1 as matching this pension |
| Property limit | ₹1,00,000 [S, D1] or ₹50,000 [D2, D3, D4] | Most pensions | Show both; ask for official check |
| Pension amount | ₹1,000 on several district pages; ₹1,200 or ₹1,500 on state page, which mentions 2023 increases | All pensions | Use [S], show "not yet verified" |
| National disability level | 80% [S] or 60% on one district page [D8] | UC2 | Use 80%, mention the conflict |

## Check before the demo (in this order)

1. Ask a Taluk office or e-Sevai centre, or find the current government order, for: the meaning of "destitute", the adult-relative and son conditions, the widow pension upper age and the property limit.
2. Family benefit: deadline, documents and Tamil Nadu process.
3. Get the official destitute widow application form, or its field list.
4. Whether widow pensions, family benefit and Magalir Urimai Thogai can be combined.

## Sources

Opened and read on 28 Nov 2026 unless noted.

- **[S]** <https://cra.tn.gov.in/eleg_schemes.php>: team's copy dated 27 Nov 2026; live page not available on 28 Nov
- **[N1]** [National Social Assistance Programme, PIB, Nov 2025](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc2025117686801.pdf)
- **[D1]** [Ariyalur](https://ariyalur.nic.in/departments/social-security-scheme/) (updated 2022)
- **[D2]** [Pudukkottai](https://pudukkottai.nic.in/social-security-schemes/) (updated 2026)
- **[D3]** [Kanniyakumari](https://kanniyakumari.nic.in/social-security-schemes/) (updated 2023)
- **[D4]** [Chennai pension eligibility](https://chennai.nic.in/oap-eligibility/) (updated 2021)
- **[D5]** [Tirunelveli application procedure](https://tirunelveli.nic.in/application-submission-procedure/) (updated 2020)
- **[D6]** [Madurai disability welfare](https://madurai.nic.in/differently-abled-welfare/) (updated 2022)
- **[D7]** [Viluppuram disability schemes](https://viluppuram.nic.in/differently-abled-welfare-schemes/) (updated 2024)
- **[D8]** [Karur](https://karur.nic.in/departments/social-welfare-and-women-empowerment-department/social-security-schemes/) (updated 2026)
- Sewing machine: [Tiruvarur](https://tiruvarur.nic.in/departments/social/) (updated 2026) and [Chennai social welfare](https://chennai.nic.in/departments/social-welfare-sw/) (updated 2021)
- **[U]** search summaries, including [Outlook Money on the family benefit](https://www.outlookmoney.com/news/parivarik-labh-yojana-all-about-national-family-benefit-scheme-that-supports-bpl-families), [kmut.tn.gov.in FAQ](https://kmut.tn.gov.in/faq.html) (search only) and [CMCHIS eligibility](https://www.cmchistn.com/eligibility) (page text did not load)
