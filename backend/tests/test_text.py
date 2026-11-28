from app.knowledge_search.text import normalise


def test_normalise_fixes_the_common_tamil_variant_and_spaces():
    assert normalise("அவா்  க\n") == "அவர் க"


def test_normalise_is_stable():
    once = normalise("  Widow\tpension  ")
    assert once == "Widow pension" and normalise(once) == once
