import datetime as dt

import pytest

from app.contracts.handoff import FieldInfo
from app.understand.ai import understand_with_ai
from app.understand.rules import parse_date, understand
from app.voice.base import VoiceError


def field(kind, options=(), aliases=None):
    return FieldInfo(key="f", kind=kind, label="Label", options=list(options), aliases=aliases)


@pytest.mark.parametrize("said", ["yes", "Yes.", "ok", "ஆமாம்", "ஆம்", "சரி", "aamaa", "sari", "correct", "that's right"])
def test_yes(said):
    assert understand(field("text"), "confirm", said).intent == "yes"


@pytest.mark.parametrize("said", ["no", "No!", "இல்லை", "இல்ல", "illa", "wrong", "தப்பு"])
def test_no(said):
    assert understand(field("text"), "confirm", said).intent == "no"


@pytest.mark.parametrize("said", ["done", "முடிந்தது", "முடிஞ்சது", "ஆச்சு", "aachu", "ok"])
def test_done(said):
    assert understand(field("text"), "done", said).intent == "done"


@pytest.mark.parametrize("said, intent", [("repeat", "repeat"), ("மீண்டும்", "repeat"), ("stop", "stop"),
                                          ("நிறுத்து", "stop"), ("go back", "back"), ("what is this", "help"),
                                          ("இது என்ன", "help"), ("skip", "skip")])
def test_commands_while_asking(said, intent):
    assert understand(field("text"), "value", said).intent == intent


def test_no_with_correction_carries_the_new_value():
    result = understand(field("mobile"), "confirm", "No, it is 98765 43210")
    assert (result.intent, result.value) == ("no", "9876543210")


def test_a_new_value_instead_of_yes_is_a_correction():
    assert understand(field("pincode"), "confirm", "625002").model_dump(include={"intent", "value"}) == \
        {"intent": "no", "value": "625002"}


def test_door_number_starting_with_no_is_a_value():
    assert understand(field("text"), "value", "No 12").value == "No 12"


@pytest.mark.parametrize("said, value", [
    ("9876543210", "9876543210"), ("98765 43210", "9876543210"), ("+91 98765 43210", "9876543210"),
    ("09876543210", "9876543210"), ("nine eight seven six five four three two one zero", "9876543210"),
    ("nine eight double four triple five one two three", "9844555123"),
    ("ஒன்பது எட்டு ஏழு ஆறு ஐந்து நான்கு மூன்று இரண்டு ஒன்று பூஜ்ஜியம்", "9876543210"),
    ("௯௮௭௬௫௪௩௨௧௦", "9876543210"), ("my number is 9876543210", "9876543210"),
    # Not checked here: the website says whether a number is valid.
    ("12345", "12345"), ("1234567890", "1234567890")])
def test_mobile(said, value):
    assert understand(field("mobile"), "value", said).value == value


def test_words_that_are_not_numbers_are_not_understood():
    assert understand(field("mobile"), "value", "my husband knows it").problem == "not_understood"


@pytest.mark.parametrize("said, value", [("625001", "625001"), ("six two five zero zero one", "625001"),
                                         ("625 001", "625001"), ("62500", "62500"), ("025001", "025001")])
def test_pincode(said, value):
    assert understand(field("pincode"), "value", said).value == value


@pytest.mark.parametrize("said", ["14/03/1968", "14-3-1968", "14.03.68", "1968-03-14", "14 March 1968",
                                  "March 14, 1968", "14th of March 1968", "fourteenth march nineteen sixty eight",
                                  "14 மார்ச் 1968", "௧௪ மார்ச் ௧௯௬௮"])
def test_dates(said):
    assert understand(field("date"), "value", said).value == "1968-03-14"


def test_dates_are_not_range_checked():
    assert understand(field("date"), "value", "14/03/2090").value == "2090-03-14"


@pytest.mark.parametrize("said", ["31/02/1968", "14 Smarch 1968"])
def test_dates_that_cannot_be_read(said):
    result = understand(field("date"), "value", said)
    assert result.intent == "unclear" and result.problem == "bad_date"


def test_two_digit_year_is_in_the_past():
    assert parse_date("1/1/30", today=dt.date(2026, 11, 28)) == dt.date(1930, 1, 1)
    assert parse_date("1/1/20", today=dt.date(2026, 11, 28)) == dt.date(2020, 1, 1)


def test_email():
    assert understand(field("email"), "value", "selvi at gmail dot com").value == "selvi@gmail.com"


OPTIONS = ["Madurai East", "Madurai North", "Melur", "Usilampatti"]


@pytest.mark.parametrize("said, value", [("madurai east", "Madurai East"), ("I live in Melur", "Melur"),
                                         ("usilampati", "Usilampatti"), ("Madurai North taluk", "Madurai North")])
def test_choice(said, value):
    assert understand(field("choice", OPTIONS), "value", said).value == value


def test_ambiguous_choice_is_not_guessed():
    result = understand(field("choice", OPTIONS), "value", "Madurai")
    assert result.intent == "unclear" and result.problem in ("ambiguous", "not_in_list")


def test_choice_aliases_in_tamil():
    gender = field("choice", ["Female", "Male"], {"Female": ["பெண்"], "Male": ["ஆண்"]})
    assert understand(gender, "value", "பெண்").value == "Female"


def test_spaced_letters_match_short_options():
    assert understand(field("choice", ["BC", "MBC", "SC"]), "value", "M B C").value == "MBC"


def test_yes_and_no_can_be_options():
    assert understand(field("choice", ["Yes", "No"]), "value", "no").value == "No"


def test_spelt_latin_name():
    assert understand(field("name_latin"), "value", "S E L V I").value == "selvi"
    assert understand(field("name_latin"), "value", "செல்வி").value == "செல்வி"  # the widget transliterates it


class FakeAI:
    def __init__(self, reply):
        self.reply, self.prompts = reply, []

    def chat_json(self, system, user, schema):
        self.prompts.append(user)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def test_ai_value_is_checked_by_the_rules():
    assert understand_with_ai(FakeAI({"intent": "value", "value": "58"}), field("digits"), "value", "ஐம்பத்தெட்டு").value == "58"
    bad = understand_with_ai(FakeAI({"intent": "value", "value": "call me later"}), field("mobile"), "value", "...")
    assert bad.intent == "unclear" and bad.problem == "not_understood"


def test_ai_choice_must_be_an_option():
    result = understand_with_ai(FakeAI({"intent": "value", "value": "Madurai West"}), field("choice", OPTIONS),
                                "value", "மதுரை மேற்கு")
    assert result.intent == "unclear"


def test_ai_failure_or_junk_is_unclear():
    assert understand_with_ai(FakeAI(VoiceError("provider")), field("text"), "value", "x").intent == "unclear"
    assert understand_with_ai(FakeAI({"intent": "launch"}), field("text"), "value", "x").intent == "unclear"


def test_ai_prompt_has_only_the_reply_and_field():
    ai = FakeAI({"intent": "yes", "value": None})
    understand_with_ai(ai, field("choice", ["A"]), "confirm", "ஆமா ஆமா")
    assert set(__import__("json").loads(ai.prompts[0])) == {"field", "question_type", "reply"}


def test_option_codes_and_aliases_match_longer_option_text():
    options = ["BC – Backward Class", "MBC – Most Backward Class", "SC – Scheduled Caste"]
    aliases = {"MBC": ["எம் பி சி", "most backward"], "BC": ["backward class"]}
    assert understand(field("choice", options, aliases), "value", "M B C").value == "MBC – Most Backward Class"
    assert understand(field("choice", options, aliases), "value", "bc").value == "BC – Backward Class"
    assert understand(field("choice", options, aliases), "value", "எம் பி சி").value == "MBC – Most Backward Class"
