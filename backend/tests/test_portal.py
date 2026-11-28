import datetime as dt

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

GOOD = dict(ApplicantName="SELVI MURUGAN", ApplicantNameTamil="செல்வி முருகன்", HusbandName="MURUGAN",
            Gender="Female", DateOfBirth="14/03/1968", MaritalStatus="Widow", Community="MBC",
            MobileNo="9876543210", AadhaarNo="123412341234", District="madurai", Taluk="Melur",
            Village="Melur Ward 2", DoorNo="12", Street="Gandhi Street", Pincode="625106")


def age(dob="14/03/1968"):
    d = dt.datetime.strptime(dob, "%d/%m/%Y").date()
    today = dt.date.today()
    return str(today.year - d.year - ((today.month, today.day) < (d.month, d.day)))


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path / "missing", portal_test_hooks=True))


def test_pages_render_with_banner_and_widget_line(client):
    for url in ("/portal/", "/portal/pension/apply"):
        html = client.get(url).text
        assert "DEMO – not a government site" in html
        assert 'src="/widget/v1/widget.js" data-site-key="urimai-practice"' in html


def test_postback_keeps_values_and_reloads_lists(client):
    response = client.post("/portal/pension/apply", data={**GOOD, "Taluk": "", "Village": "", "__EVENTTARGET": "District"})
    assert response.status_code == 200 and response.url.path == "/portal/pension/apply"
    assert 'value="SELVI MURUGAN"' in response.text and "<option value=\"Melur\"" in response.text
    changed = client.post("/portal/pension/apply", data={**GOOD, "District": "chennai", "__EVENTTARGET": "District"})
    assert "Melur Ward 2\" selected" not in changed.text and "Egmore" in changed.text


def test_server_checks_reject_bad_values_and_never_echo_aadhaar(client):
    bad = {**GOOD, "ApplicantName": "selvi", "MobileNo": "12345", "Age": "40", "Pincode": "999999",
           "MaritalStatus": "Married"}
    html = client.post("/portal/pension/apply", data=bad).text
    for message in ("English capital letters", "10-digit mobile", "Age does not match", "Tamil Nadu PIN",
                    "Only widows"):
        assert message in html
    assert "123412341234" not in html and 'class="summary"' in html


def test_under_18_rejected(client):
    dob = (dt.date.today().replace(year=dt.date.today().year - 17)).strftime("%d/%m/%Y")
    html = client.post("/portal/pension/apply", data={**GOOD, "DateOfBirth": dob, "Age": age(dob)}).text
    assert "18 years or older" in html


def test_full_application_gives_acknowledgement(client):
    assert client.get("/portal/pension/documents", follow_redirects=False).status_code == 303
    page2 = client.post("/portal/pension/apply", data={**GOOD, "Age": age()})
    assert page2.url.path == "/portal/pension/documents" and 'id="btnSubmit"' in page2.text
    client.get("/portal/captcha.svg")
    wrong = client.post("/portal/pension/documents", data={"Declaration": "on", "CaptchaText": "XXXXX"},
                        files={"Photo": ("p.png", b"\x89PNG" * 10, "image/png"),
                               "DeathCertificate": ("d.pdf", b"%PDF" * 10, "application/pdf")})
    assert "captcha text is wrong" in wrong.text
    client.get("/portal/captcha.svg")
    captcha = client.get("/portal/_test/captcha").text
    files = {"Photo": ("p.png", b"\x89PNG" * 10, "image/png"),
             "DeathCertificate": ("d.exe", b"MZ" * 10, "application/octet-stream")}
    assert "Wrong file" in client.post("/portal/pension/documents", data={"Declaration": "on", "CaptchaText": captcha},
                                       files=files).text
    client.get("/portal/captcha.svg")
    captcha = client.get("/portal/_test/captcha").text
    files["DeathCertificate"] = ("d.pdf", b"%PDF" * 10, "application/pdf")
    done = client.post("/portal/pension/documents", data={"Declaration": "on", "CaptchaText": captcha.lower()},
                       files=files)
    assert done.url.path == "/portal/pension/done" and "DEMO/" in done.text
    assert client.get("/portal/pension/documents", follow_redirects=False).status_code == 303  # data cleared


def test_declaration_is_required(client):
    client.post("/portal/pension/apply", data={**GOOD, "Age": age()})
    client.get("/portal/captcha.svg")
    html = client.post("/portal/pension/documents", data={"CaptchaText": client.get("/portal/_test/captcha").text}).text
    assert "Tick the declaration" in html and "Upload a JPG" in html


def test_test_hook_is_off_by_default(tmp_path):
    assert TestClient(create_app(tmp_path / "missing")).get("/portal/_test/captcha").status_code in (404, 405)
