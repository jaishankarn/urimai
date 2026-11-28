import json

import pytest

from app.brain.extract import extract
from app.contracts.content import Option, Question

STORY = "I am 58 and live in Tamil Nadu. My husband was a construction worker and died of illness this year."


def says(*facts):
    """A fake chat model that replies with these (key, value, quote) triples."""
    return lambda system, user: json.dumps({"facts": [dict(zip(("key", "value", "quote"), f)) for f in facts]})


def question(id, type="choice", *values):
    return Question(id=id, type=type, text="?", options=[Option(value=v, label=v) for v in values] or None)


def test_keeps_facts_the_person_said():
    found = extract(says(("age", 58, "I am 58"), ("widowed", "yes", "My husband was a construction worker and died"),
                         ("husband_work", "construction", "construction worker")), STORY, None)
    assert found.facts == {"age": 58, "widowed": "yes", "husband_work": "construction"} and not found.dont_know


def test_a_fact_without_its_words_in_the_transcript_is_dropped():
    assert extract(says(("widowed", "yes", "I am a widow")), STORY, None).facts == {}
    assert extract(says(("age", 58, "")), STORY, None).facts == {}


@pytest.mark.parametrize("key, value", [("husband_main_earner", "yes"), ("death_at_work", "no"), ("bpl_card", "yes"),
                                        ("property_value", "under_50000"), ("husband_board_registered", "yes")])
def test_a_story_cannot_fill_what_must_be_asked(key, value):
    assert extract(says((key, value, "construction worker")), STORY, None).facts == {}


@pytest.mark.parametrize("fact", [("age", 580, "58"), ("age", "fifty", "58"), ("aadhaar", "1", "58"), ("widowed", True, "58")])
def test_bad_values_and_unknown_keys_are_dropped(fact):
    assert extract(says(fact), STORY, None).facts == {}


def test_a_reply_fills_only_the_question_asked():
    chat = says(("husband_age_at_death", 54, "54"), ("age", 54, "54"))
    found = extract(chat, "he was 54", question("husband_age_at_death", "number"))
    assert found.facts == {"husband_age_at_death": 54}


def test_the_value_must_be_one_of_the_question_options():
    found = extract(says(("husband_work", "driver", "drove")), "he drove", question("husband_work", "choice", "construction", "unknown"))
    assert found.facts == {}


def test_dont_know_for_a_choice_and_for_a_number():
    choice = extract(says(("bpl_card", "unknown", "no idea")), "no idea", question("bpl_card", "choice", "yes", "no", "unknown"))
    assert choice.facts == {"bpl_card": "unknown"} and not choice.dont_know
    number = extract(says(("age", "unknown", "no idea")), "no idea", question("age", "number"))
    assert number.facts == {} and number.dont_know


@pytest.mark.parametrize("reply", ["not json", "[]", '{"facts": "x"}', '{"facts": [5]}', "", '{"facts": [{"key": ["a"]}]}'])
def test_a_broken_reply_changes_nothing(reply):
    assert extract(lambda s, u: reply, STORY, None).facts == {}


def test_the_asked_options_are_given_to_the_model():
    seen = {}
    def chat(system, user):
        seen["user"] = user
        return '{"facts": []}'
    extract(chat, "x", question("property_value", "choice", "under_50000", "unknown"))
    assert "under_50000" in seen["user"] and "property_value" in seen["user"]


@pytest.mark.parametrize("said, quote", [("I don't know", "no"), ("yesterday I lost it", "yes"), ("ஆமாம்", "ஆமா"),
                                         ("I know the officer", "no")])
def test_a_quote_inside_another_word_does_not_count(said, quote):
    assert extract(says(("bpl_card", "yes", quote)), said, question("bpl_card", "choice", "yes", "no", "unknown")).facts == {}


@pytest.mark.parametrize("said, quote", [("Yes, I have it.", "yes"), ("ஆமாம், அட்டை இருக்கிறது.", "ஆமாம்"),
                                         ("Tamil Nadu-ல இருக்கேன்", "Tamil Nadu-ல"), ("no card", "No card.")])
def test_whole_words_still_count_whatever_the_punctuation(said, quote):
    found = extract(says(("bpl_card", "yes", quote)), said, question("bpl_card", "choice", "yes", "no", "unknown"))
    assert found.facts == {"bpl_card": "yes"}
