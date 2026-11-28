"""Practice portal: a demo pension application site at /portal/, clearly marked as not a government site.

It is treated like a third-party site: it knows nothing about Urimai except the one widget script line a
department would add. It uses patterns common on older government forms (table layout, a read-only calendar,
lists that reload the page, a searchable list, a frame, uploads, an image captcha). Data is held in memory per
browser cookie for the demo only and is cleared after the acknowledgement.
"""
import datetime as dt
import random
import re
import secrets
import threading
import time
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.portal.data import DISTRICTS, taluks, villages

HERE = Path(__file__).resolve().parent
COOKIE = "demo_portal_sid"
TTL = 60 * 60
GENDERS = ["Female", "Male", "Transgender"]
MARITAL = ["Married", "Unmarried", "Widow", "Divorced"]
COMMUNITIES = {"BC": "BC – Backward Class", "MBC": "MBC – Most Backward Class", "SC": "SC – Scheduled Caste",
               "ST": "ST – Scheduled Tribe", "OC": "OC – Other / General"}
PAGE1 = ["ApplicantName", "ApplicantNameTamil", "HusbandName", "Gender", "DateOfBirth", "Age", "MaritalStatus",
         "Community", "MobileNo", "AadhaarNo", "District", "Taluk", "Village", "DoorNo", "Street", "Pincode"]
PHOTO_TYPES = {"image/jpeg", "image/png"}
DOC_TYPES = {"image/jpeg", "image/png", "application/pdf"}


class Sessions:
    def __init__(self):
        self._lock = threading.Lock()
        self._data: dict[str, dict] = {}

    def get(self, sid: str | None) -> tuple[str, dict]:
        with self._lock:
            now = time.time()
            self._data = {k: v for k, v in self._data.items() if v["_seen"] > now - TTL}
            if not sid or sid not in self._data:
                sid = secrets.token_urlsafe(16)
                self._data[sid] = {"page1": {}, "done1": False}
            self._data[sid]["_seen"] = now
            return sid, self._data[sid]


def age_on(dob: dt.date, today: dt.date) -> int:
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def parse_dob(text: str) -> dt.date | None:
    match = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", text or "")
    if not match:
        return None
    try:
        return dt.date(int(match[3]), int(match[2]), int(match[1]))
    except ValueError:
        return None


def check_page1(v: dict[str, str], today: dt.date) -> dict[str, str]:
    errors = {}
    if not re.fullmatch(r"[A-Z][A-Z .]{1,59}", v.get("ApplicantName", "")):
        errors["ApplicantName"] = "Enter the name in English capital letters only."
    if not re.search(r"[஀-௿]", v.get("ApplicantNameTamil", "")):
        errors["ApplicantNameTamil"] = "Enter the name in Tamil."
    if not re.fullmatch(r"[A-Z][A-Z .]{1,59}", v.get("HusbandName", "")):
        errors["HusbandName"] = "Enter the husband's name in English capital letters only."
    if v.get("Gender") not in GENDERS:
        errors["Gender"] = "Select the gender."
    dob = parse_dob(v.get("DateOfBirth", ""))
    if dob is None or dob > today:
        errors["DateOfBirth"] = "Select a valid date of birth."
    elif age_on(dob, today) < 18:
        errors["DateOfBirth"] = "The applicant must be 18 years or older."
    elif v.get("Age") != str(age_on(dob, today)):
        errors["Age"] = "Age does not match the date of birth."
    if v.get("MaritalStatus") not in MARITAL:
        errors["MaritalStatus"] = "Select the marital status."
    elif v["MaritalStatus"] != "Widow":
        errors["MaritalStatus"] = "Only widows can apply under this scheme."
    if v.get("Community") not in COMMUNITIES:
        errors["Community"] = "Select the community."
    if not re.fullmatch(r"[6-9]\d{9}", v.get("MobileNo", "")):
        errors["MobileNo"] = "Enter a valid 10-digit mobile number."
    if not re.fullmatch(r"\d{12}", v.get("AadhaarNo", "")):
        errors["AadhaarNo"] = "Enter a valid 12-digit Aadhaar number."
    if v.get("District") not in DISTRICTS:
        errors["District"] = "Select the district."
    elif v.get("Taluk") not in taluks(v["District"]):
        errors["Taluk"] = "Select the taluk."
    elif v.get("Village") not in villages(v["District"], v["Taluk"]):
        errors["Village"] = "Select the village or ward."
    if not v.get("DoorNo", "").strip():
        errors["DoorNo"] = "Enter the door number."
    if len(v.get("Street", "").strip()) < 3:
        errors["Street"] = "Enter the street or area."
    if not re.fullmatch(r"6[0-4]\d{4}", v.get("Pincode", "")):
        errors["Pincode"] = "Enter a valid Tamil Nadu PIN code (6 digits)."
    return errors


def captcha_svg(text: str) -> str:
    rng = random.Random(text)
    letters = "".join(
        f'<text x="{14 + i * 24}" y="{30 + rng.randint(-5, 5)}" transform="rotate({rng.randint(-20, 20)} '
        f'{14 + i * 24} 28)" font-size="26" font-family="serif" fill="#{rng.randint(0, 0x666666):06x}">{c}</text>'
        for i, c in enumerate(text))
    lines = "".join(
        f'<line x1="{rng.randint(0, 140)}" y1="{rng.randint(0, 44)}" x2="{rng.randint(0, 140)}" '
        f'y2="{rng.randint(0, 44)}" stroke="#999" stroke-width="1"/>' for _ in range(6))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="140" height="44" viewBox="0 0 140 44">'
            f'<rect width="140" height="44" fill="#f3eddc"/>{lines}{letters}</svg>')


def router(test_hooks: bool = False) -> APIRouter:
    api = APIRouter()
    templates = Jinja2Templates(directory=HERE / "templates")
    sessions = Sessions()

    def page(request: Request, name: str, data: dict, **context) -> HTMLResponse:
        response = templates.TemplateResponse(request, name, context)
        response.set_cookie(COOKIE, data["_sid"], httponly=True, samesite="lax", max_age=TTL)
        response.headers["Cache-Control"] = "no-store"
        return response

    def state(request: Request) -> dict:
        sid, data = sessions.get(request.cookies.get(COOKIE))
        data["_sid"] = sid
        return data

    def redirect(url: str, data: dict) -> RedirectResponse:
        response = RedirectResponse(url, status_code=303)
        response.set_cookie(COOKIE, data["_sid"], httponly=True, samesite="lax", max_age=TTL)
        return response

    def apply_page(request: Request, data: dict, errors: dict[str, str] | None = None):
        v = data["page1"]
        return page(request, "apply.html", data, v=v, errors=errors or {}, districts=DISTRICTS,
                    taluks=taluks(v.get("District", "")), villages=villages(v.get("District", ""), v.get("Taluk", "")),
                    genders=GENDERS, marital=MARITAL, communities=COMMUNITIES)

    @api.get("/portal", include_in_schema=False)
    @api.get("/portal/", include_in_schema=False)
    def home(request: Request):
        return page(request, "home.html", state(request))

    @api.get("/portal/pension/apply", include_in_schema=False)
    def apply_form(request: Request):
        return apply_page(request, state(request))

    @api.post("/portal/pension/apply", include_in_schema=False)
    async def apply_post(request: Request):
        data = state(request)
        form = await request.form()
        values = {k: str(form.get(k, "")).strip() for k in PAGE1}
        event = str(form.get("__EVENTTARGET", ""))
        old = data["page1"]
        if event in ("District", "Taluk", "Village"):
            # A postback, as on older sites: keep what was typed and reload the lists.
            if event == "District" and values["District"] != old.get("District"):
                values["Taluk"] = values["Village"] = ""
            if event == "Taluk" and values["Taluk"] != old.get("Taluk"):
                values["Village"] = ""
            data["page1"] = values
            return redirect("/portal/pension/apply", data)
        errors = check_page1(values, dt.date.today())
        if errors:
            values["AadhaarNo"] = ""  # never sent back to the browser
            data["page1"] = values
            return apply_page(request, data, errors)
        data["page1"], data["done1"] = values, True
        return redirect("/portal/pension/documents", data)

    @api.get("/portal/pension/address-frame", include_in_schema=False)
    def address_frame(request: Request):
        data = state(request)
        return page(request, "address_frame.html", data, v=data["page1"])

    @api.get("/portal/pension/documents", include_in_schema=False)
    def documents(request: Request):
        data = state(request)
        if not data["done1"]:
            return redirect("/portal/pension/apply", data)
        return page(request, "documents.html", data, errors={})

    @api.post("/portal/pension/documents", include_in_schema=False)
    async def documents_post(request: Request):
        data = state(request)
        if not data["done1"]:
            return redirect("/portal/pension/apply", data)
        form = await request.form()
        errors = {}
        for name, types, limit, label in (("Photo", PHOTO_TYPES, 500_000, "a JPG or PNG photo up to 500 KB"),
                                          ("DeathCertificate", DOC_TYPES, 1_000_000, "a PDF, JPG or PNG up to 1 MB")):
            upload = form.get(name)
            content = await upload.read() if hasattr(upload, "read") else b""
            if not content:
                errors[name] = f"Upload {label}."
            elif upload.content_type not in types or len(content) > limit:
                errors[name] = f"Wrong file. Upload {label}."
        if form.get("Declaration") != "on":
            errors["Declaration"] = "Tick the declaration to continue."
        expected = data.pop("captcha", None)
        if not expected or str(form.get("CaptchaText", "")).strip().upper() != expected:
            errors["CaptchaText"] = "The captcha text is wrong. Type the new letters."
        if errors:
            return page(request, "documents.html", data, errors=errors)
        ref = f"DEMO/{dt.date.today().year}/{secrets.randbelow(900000) + 100000:06d}"
        name = data["page1"].get("ApplicantName", "")
        sid = data["_sid"]
        data.clear()  # the demo keeps nothing after the acknowledgement except the reference to show
        data.update({"page1": {}, "done1": False, "ref": ref, "ref_name": name, "_sid": sid, "_seen": time.time()})
        return redirect("/portal/pension/done", data)

    @api.get("/portal/pension/done", include_in_schema=False)
    def done(request: Request):
        data = state(request)
        if not data.get("ref"):
            return redirect("/portal/", data)
        return page(request, "done.html", data, ref=data["ref"], applicant=data.get("ref_name", ""))

    @api.get("/portal/captcha.svg", include_in_schema=False)
    def captcha(request: Request):
        data = state(request)
        data["captcha"] = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(5))
        response = Response(captcha_svg(data["captcha"]), media_type="image/svg+xml")
        response.headers["Cache-Control"] = "no-store"
        response.set_cookie(COOKIE, data["_sid"], httponly=True, samesite="lax", max_age=TTL)
        return response

    if test_hooks:
        @api.get("/portal/_test/captcha", include_in_schema=False)
        def test_captcha(request: Request):
            return PlainTextResponse(state(request).get("captcha", ""))

    return api


def static_files() -> StaticFiles:
    return StaticFiles(directory=HERE / "static")

