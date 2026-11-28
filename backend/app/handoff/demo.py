"""Sample confirmed answers for trying the widget without going through the journey. Made up; demo forms only."""
from app.contracts.facts import Facts

SAMPLE_FACTS = Facts(
    lives_in_tn="yes", district="madurai", area="village", age=58, widowed="yes", husband_death_when="within_1_year",
    husband_age_at_death=54, death_cause="natural", husband_main_earner="yes", husband_work="construction",
    husband_board_registered="yes", insurance_deduction="unknown", own_income="none", property_value="under_50000",
    adult_relative_at_home="no", bpl_card="yes")
