"""A test-only application site whose checks the widget does NOT know about in advance (none are in its form map):
an HTML pattern, an alert() pop-up, a late aria-invalid message, an unmapped required box, an unmapped email box
the browser refuses, and a server error shown only in a page summary."""
import html
import re

import yaml

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

def _field(key, labels, kind, en, ta, ask_en, ask_ta, **extra):
    return {"key": key, "page": "/fixtures/odd/apply", "find": {"labels": labels}, "mode": "fill", "kind": kind,
            "source": "ask", "label": {"en": en, "ta": ta}, "ask": {"en": ask_en, "ta": ask_ta}, **extra}


FORM_MAP = yaml.safe_dump({
    "id": "fixture-odd-form",
    "scheme_id": "destitute-widow-pension",
    "title": {"en": "Test form with unknown checks", "ta": "சோதனைப் படிவம்"},
    "site": {"key": "urimai-fixture", "origins": ["self"], "start_url": "/fixtures/odd/apply",
             "pages": ["/fixtures/odd/apply", "/fixtures/odd/done"]},
    "finish_page": "/fixtures/odd/done",
    "fingerprint": {"labels": ["applicant name", "ration card number", "annual income"], "min_match": 2},
    "fields": [
        _field("applicant", ["applicant name"], "text", "Applicant name", "விண்ணப்பதாரர் பெயர்", "What is your name?",
               "உங்கள் பெயர் என்ன?"),
        _field("ration", ["ration card number"], "text", "Ration card number", "ரேஷன் அட்டை எண்",
               "What is your ration card number?", "ரேஷன் அட்டை எண் என்ன?", format="upper"),
        _field("family", ["family members"], "digits", "Family members", "குடும்ப உறுப்பினர்கள்",
               "How many people are in your family?", "குடும்பத்தில் எத்தனை பேர்?"),
        _field("village_code", ["village code"], "text", "Village code", "கிராமக் குறியீடு", "What is your village code?",
               "கிராமக் குறியீடு என்ன?", format="upper"),
        _field("income", ["annual income"], "digits", "Annual income", "ஆண்டு வருமானம்",
               "What is your yearly income in rupees?", "ஆண்டு வருமானம் எவ்வளவு?"),
        {"key": "send", "page": "/fixtures/odd/apply", "find": {"selector": "#send"}, "mode": "submit",
         "say": {"en": "Please press Send yourself.", "ta": "“Send” பொத்தானை நீங்களே அழுத்துங்கள்."}},
    ],
}, allow_unicode=True)

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test form</title><script src="/widget/v1/widget.js" data-site-key="urimai-fixture" defer></script>
<style>body{{font-family:sans-serif;max-width:700px;margin:20px auto}} .form-group{{margin:10px 0}} .error{{color:#b00}}</style></head><body>
<h1>TEST FIXTURE – not a real site</h1>{summary}
<form method="post" action="/fixtures/odd/apply">
<div class="form-group"><label for="a">Applicant name</label> <input id="a" name="applicant" value="{applicant}"></div>
<div class="form-group"><label for="r">Ration card number</label> <input id="r" name="ration" pattern="[A-Z]{{2}}[0-9]{{6}}" title="Two letters and six digits" value="{ration}"></div>
<div class="form-group"><label for="f">Family members</label> <input id="f" name="family" value="{family}"></div>
<div class="form-group"><label for="v">Village code</label> <input id="v" name="village_code" aria-describedby="v-err" value="{village_code}"><span id="v-err" class="hint" hidden></span></div>
<div class="form-group"><label for="i">Annual income (₹)</label> <input id="i" name="income" value="{income}"></div>
<div class="form-group"><label for="fa">Father's name *</label> <input id="fa" name="father" required value="{father}"></div>
<div class="form-group"><label for="e">Email (optional)</label> <input id="e" name="email" type="email" value="{email}"></div>
<button id="send" type="submit">Send</button>
</form>
<script>
document.getElementById('f').addEventListener('blur', function () {{ if (+this.value > 20) alert('Family members cannot be more than 20.'); }});
document.getElementById('v').addEventListener('change', function () {{
  var el = this, err = document.getElementById('v-err');
  setTimeout(function () {{  // pretends to ask the server
    var bad = el.value && el.value !== 'VC100';
    el.setAttribute('aria-invalid', bad ? 'true' : 'false'); err.hidden = !bad; err.textContent = bad ? 'Unknown village code.' : '';
  }}, 500);
}});
</script></body></html>"""

FIELDS = ["applicant", "ration", "family", "village_code", "income", "father", "email"]


def router() -> APIRouter:
    api = APIRouter()

    def render(values: dict, summary: str = "") -> HTMLResponse:
        box = f'<div class="alert alert-danger" role="alert">{html.escape(summary)}</div>' if summary else ""
        return HTMLResponse(PAGE.format(summary=box, **{k: html.escape(values.get(k, "")) for k in FIELDS}))

    @api.get("/fixtures/odd/apply")
    def apply():
        return render({})

    @api.post("/fixtures/odd/apply")
    async def post(request: Request):
        form = await request.form()
        values = {k: str(form.get(k, "")) for k in FIELDS}
        if not re.fullmatch(r"\d+", values["income"]) or int(values["income"]) > 100000:
            return render(values, "Your income is above the limit for this scheme.")
        return RedirectResponse("/fixtures/odd/done", status_code=303)

    @api.get("/fixtures/odd/done")
    def done():
        return HTMLResponse('<!doctype html><html><head><script src="/widget/v1/widget.js" data-site-key="urimai-fixture" defer>'
                            '</script></head><body><h1>Received</h1><p>Application number: FIX-123456</p></body></html>')

    return api
