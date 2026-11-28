import pytest

from app.main import CONTENT_DIR
from app.scheme_library.loader import load_schemes

# The made-up widow from the design's demo story.
DEMO_FACTS = dict(
    lives_in_tn="yes", age=58, widowed="yes", husband_death_when="within_1_year", husband_age_at_death=54,
    death_cause="natural", husband_main_earner="yes", husband_work="construction", husband_board_registered="yes",
    insurance_deduction="unknown", own_income="none", property_value="under_50000",
    adult_relative_at_home="no", bpl_card="yes",
)


@pytest.fixture
def schemes():
    return load_schemes(CONTENT_DIR)


@pytest.fixture
def demo():
    return dict(DEMO_FACTS)
