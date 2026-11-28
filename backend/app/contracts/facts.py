"""The details a person confirms. Field names are shared with the screen and form filling."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

YesNo = Literal["yes", "no", "unknown"]
District = Literal[
    "ariyalur", "chengalpattu", "chennai", "coimbatore", "cuddalore", "dharmapuri", "dindigul", "erode",
    "kallakurichi", "kancheepuram", "kanniyakumari", "karur", "krishnagiri", "madurai", "mayiladuthurai",
    "nagapattinam", "namakkal", "nilgiris", "perambalur", "pudukkottai", "ramanathapuram", "ranipet", "salem",
    "sivaganga", "tenkasi", "thanjavur", "theni", "thoothukudi", "tiruchirappalli", "tirunelveli", "tirupathur",
    "tiruppur", "tiruvallur", "tiruvannamalai", "tiruvarur", "vellore", "viluppuram", "virudhunagar", "unknown"]


class Facts(BaseModel):
    """Every field is optional: a missing value means unknown, never "no". No identity or account numbers."""
    model_config = ConfigDict(extra="forbid")

    lives_in_tn: YesNo | None = None
    district: District | None = None
    area: Literal["village", "town_city", "unknown"] | None = None
    age: int | None = Field(None, ge=0, le=120)
    widowed: YesNo | None = None
    husband_death_when: Literal["within_1_year", "1_to_2_years", "over_2_years", "unknown"] | None = None
    husband_age_at_death: int | None = Field(None, ge=0, le=120)
    death_cause: Literal["natural", "accident", "unknown"] | None = None
    death_at_work: YesNo | None = None
    husband_main_earner: YesNo | None = None
    husband_work: Literal["construction", "driver", "other_manual", "farm_labour", "farming", "salaried",
                          "government", "other", "unknown"] | None = None
    husband_board_registered: YesNo | None = None
    # Whether a yearly insurance deduction was seen: life (Rs 436) or accident (Rs 20).
    insurance_deduction: Literal["life", "accident", "both", "none", "unknown"] | None = None
    own_income: Literal["none", "some", "unknown"] | None = None
    property_value: Literal["under_50000", "50000_to_100000", "over_100000", "unknown"] | None = None
    adult_relative_at_home: YesNo | None = None
    bpl_card: YesNo | None = None
