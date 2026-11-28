"""Routes the Urimai website uses: which forms exist for a scheme, and the handoff to the widget."""
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.contracts.handoff import FormSummary, HandoffRequest, HandoffResponse
from app.forms.loader import FormRegistry
from app.handoff.demo import SAMPLE_FACTS
from app.handoff.store import Store


def same_origin(request: Request) -> bool:
    """True when the request comes from a page on this server (or sends no Origin, as same-origin GETs do)."""
    origin = request.headers.get("origin")
    return origin is None or urlsplit(origin).netloc == request.headers.get("host")


def router(registry: FormRegistry, store: Store) -> APIRouter:
    api = APIRouter()

    def start_url(form_id: str, code: str) -> str:
        return f"{registry.forms[form_id].site.start_url}#urimai={code}"

    @api.get("/api/forms")
    def forms(scheme_id: str) -> list[FormSummary]:
        return [FormSummary(form_id=f.id, title=f.title, start_url=f.site.start_url, demo=f.demo)
                for f in registry.for_scheme(scheme_id)]

    # POST so the confirmed details never appear in an address or log. Same origin only.
    @api.post("/api/handoff")
    def handoff(body: HandoffRequest, request: Request) -> HandoffResponse:
        if not same_origin(request):
            raise HTTPException(403, "cross-origin handoff refused")
        if body.form_id not in registry.forms:
            raise HTTPException(404, "unknown form")
        return HandoffResponse(url=start_url(body.form_id, store.create_code(body.form_id, body.lang, body.facts)))

    @api.get("/api/demo/handoff")
    def demo_handoff(form_id: str, lang: str = "ta") -> RedirectResponse:
        """Open a demo form as if Urimai had handed over the sample (made-up) widow's confirmed answers."""
        form = registry.forms.get(form_id)
        if form is None or not form.demo:
            raise HTTPException(404, "no demo form with that id")
        lang = lang if lang in ("en", "ta") else "ta"
        return RedirectResponse(start_url(form_id, store.create_code(form_id, lang, SAMPLE_FACTS)), status_code=303)

    return api
