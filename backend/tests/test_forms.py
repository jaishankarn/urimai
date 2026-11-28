import copy

import pytest
import yaml
from pydantic import ValidationError

from app.contracts.forms import FormMap, is_sensitive
from app.forms.loader import load_forms, load_widget_lines
from app.main import CONTENT_DIR

FORM = CONTENT_DIR / "forms" / "demo-destitute-widow-pension.yaml"


@pytest.fixture
def raw():
    return yaml.safe_load(FORM.read_text(encoding="utf-8"))


def test_all_form_maps_load_against_real_schemes(schemes):
    registry = load_forms(CONTENT_DIR, {s.id for s in schemes})
    assert "demo-destitute-widow-pension" in registry.forms
    assert registry.for_site("urimai-practice")[0].scheme_id == "destitute-widow-pension"


def test_unknown_scheme_is_rejected(tmp_path, raw):
    (tmp_path / "forms").mkdir()
    (tmp_path / "lines").mkdir()
    for name in ("widget.en.yaml", "widget.ta.yaml"):
        (tmp_path / "lines" / name).write_text((CONTENT_DIR / "lines" / name).read_text(encoding="utf-8"))
    (tmp_path / "forms" / f"{raw['id']}.yaml").write_text(yaml.safe_dump(raw, allow_unicode=True))
    with pytest.raises(ValueError, match="unknown scheme"):
        load_forms(tmp_path, {"some-other-scheme"})


@pytest.mark.parametrize("text, sensitive", [
    ("Aadhaar Number", True), ("aadhar no", True), ("UID", True), ("Enter OTP", True), ("One-time password", True),
    ("Captcha", True), ("Security code", True), ("Password", True), ("PIN", True), ("ATM pin", True),
    ("CVV", True), ("Card number", True), ("Debit card number", True), ("ATM card", True), ("Ration card number", False), ("Ration card no", False), ("Bank account number", True), ("IFSC", True), ("ஆதார் எண்", True),
    ("கடவுச்சொல்", True), ("Pin code", False), ("PIN Code", False), ("Pincode", False), ("Applicant name", False),
    ("Village", False), ("Mobile number", False), ("Guid", False)])
def test_sensitive_detector(text, sensitive):
    assert is_sensitive(text) is sensitive


def test_sensitive_fields_must_be_user_mode(raw):
    form = copy.deepcopy(raw)
    aadhaar = next(f for f in form["fields"] if f["key"] == "aadhaar")
    aadhaar.update(mode="fill", kind="digits", source="ask", label={"en": "A", "ta": "A"}, ask={"en": "A", "ta": "A"})
    aadhaar.pop("say")
    with pytest.raises(ValidationError, match="sensitive"):
        FormMap.model_validate(form)


def test_every_sensitive_looking_field_in_maps_is_users(raw):
    for field in FormMap.model_validate(raw).fields:
        if is_sensitive(field.key, field.find.selector or "", *field.find.labels):
            assert field.mode == "user", field.key


@pytest.mark.parametrize("change, message", [
    (lambda f: f["fields"].append(dict(f["fields"][0])), "duplicate"),
    (lambda f: f["fields"].__setitem__(5, {**f["fields"][5], "source": "facts.shoe_size"}), "unknown fact"),
    (lambda f: f["fields"].pop(), "exactly one submit"),
    (lambda f: f["site"].update(origins=["http://example.com"]), "origin"),
    (lambda f: f["fields"][0].update(find={}), "selector or label"),
    (lambda f: f["fields"][1].update(source="field.husband_name"), "must come earlier"),
    (lambda f: f["fields"][0].update(page="/elsewhere"), "unknown page"),
])
def test_bad_maps_fail_fast(raw, change, message):
    form = copy.deepcopy(raw)
    change(form)
    with pytest.raises(ValidationError, match=message):
        FormMap.model_validate(form)


def test_widget_lines_match_between_languages():
    lines = load_widget_lines(CONTENT_DIR)
    assert set(lines["en"]) == set(lines["ta"])
    assert "{label}" in lines["ta"]["filled_check"]


def test_widget_lines_with_missing_placeholder_fail(tmp_path):
    (tmp_path / "lines").mkdir()
    en = yaml.safe_load((CONTENT_DIR / "lines" / "widget.en.yaml").read_text(encoding="utf-8"))
    ta = yaml.safe_load((CONTENT_DIR / "lines" / "widget.ta.yaml").read_text(encoding="utf-8"))
    ta["filled_check"] = "சரியா?"
    (tmp_path / "lines" / "widget.en.yaml").write_text(yaml.safe_dump(en, allow_unicode=True))
    (tmp_path / "lines" / "widget.ta.yaml").write_text(yaml.safe_dump(ta, allow_unicode=True))
    with pytest.raises(ValueError, match="placeholders"):
        load_widget_lines(tmp_path)
