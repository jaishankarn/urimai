"""Pick up to three suggestions in a fixed order and put them into words.

Every spoken sentence is a saved line, filled only with text from the reviewed rules. No AI writes anything here,
and no benefit is called the best.
"""
from pydantic import BaseModel

from app.contracts.result import Result
from app.contracts.scheme import Text

# The agreed order: widow pensions together, then a welfare board death benefit, then the family benefit.
GROUPS = [
    ("widow-pensions", ["destitute-widow-pension", "national-widow-pension"]),
    ("board-death", ["construction-board-death", "drivers-board-death", "manual-board-death"]),
    ("family-benefit", ["national-family-benefit"]),
]
AFTER_A_DEATH = {"board-death", "family-benefit"}
SHOWN, SPOKEN_REASONS = 3, 3


class Suggestion(BaseModel):
    key: str
    scheme_ids: list[str]
    title: str
    amounts: list[str]
    reasons: list[str]
    check: str
    note: str | None = None
    detail: str = ""  # spoken only when the person asks to hear more


class Other(BaseModel):
    id: str
    name: Text


class Suggestions(BaseModel):
    suggestions: list[Suggestion]
    others: list[Other]
    speech: list[str]


def _one(key: str, found: list[Result], ui: dict[str, str], lang: str) -> Suggestion:
    pair = len(found) > 1
    name = lambda r: getattr(r.name, lang)
    title = ui["group_widow_pensions"] + " (" + ", ".join(map(name, found)) + ")" if pair else name(found[0])
    amounts = [(f"{name(r)}: " if pair else "") + getattr(a, lang) for r in found for a in r.amounts]
    reasons = list(dict.fromkeys(getattr(c.text, lang) for r in found for c in r.conditions
                                 if c.status == "met" and c.id != "lives_in_tn"))
    check = getattr(found[0].checks[0].text, lang) if found[0].checks else ""
    detail = [title + "."]
    if reasons:
        detail.append(ui["say_why"].format(reasons="; ".join(reasons[:SPOKEN_REASONS])))
    if check:
        detail.append(ui["say_check"].format(check=check))
    return Suggestion(key=key, scheme_ids=[r.scheme_id for r in found], title=title, amounts=amounts, reasons=reasons,
                      check=check, note=ui["group_widow_both_note"] if pair and key == "widow-pensions" else None,
                      detail=" ".join(detail)[:1200])


def suggest(results: list[Result], ui: dict[str, str], lang: str) -> Suggestions:
    possible = {r.scheme_id: r for r in results if r.outcome == "potentially_eligible"}
    groups = [(key, [possible[i] for i in ids if i in possible]) for key, ids in GROUPS]
    grouped = {i for _, ids in GROUPS for i in ids}
    groups += [(i, [r]) for i, r in possible.items() if i not in grouped]
    groups = [(key, found) for key, found in groups if found]

    shown = [_one(key, found, ui, lang) for key, found in groups[:SHOWN]]
    others = [Other(id=r.scheme_id, name=r.name) for _, found in groups[SHOWN:] for r in found]

    if not shown:
        pending = [getattr(r.name, lang) for r in results if r.outcome == "needs_more_information"][:SHOWN]
        speech = [ui["say_intro_none"] + " " + ". ".join(pending) + "."] if pending else [ui["say_nothing"]]
        return Suggestions(suggestions=[], others=[], speech=speech + [ui["say_end"]])

    # The summary stays short enough to listen to; reasons and checks are on screen and in each "detail".
    speech = [ui["say_intro"]]
    for number, item in enumerate(shown, 1):
        # The two widow pensions are named in their amounts, so their long title is not repeated.
        parts = [ui["say_item"].format(n=number, name=ui["group_widow_pensions"] if item.note else item.title)]
        if item.amounts:
            parts.append(ui["say_amount"].format(amount="; ".join(item.amounts)))
        if item.note:
            parts.append(item.note)
        speech.append(" ".join(parts)[:1200])
    if others:
        speech.append(ui["say_more"].format(count=len(others)))
    if any(item.key in AFTER_A_DEATH for item in shown):
        speech.append(ui["say_deadline_tip"])
    return Suggestions(suggestions=shown, others=others, speech=speech + [ui["say_checks_remain"]])
