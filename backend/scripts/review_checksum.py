"""Print the checksum a reviewer records after checking a rule: python -m scripts.review_checksum <slug>"""
import sys

from app.main import CONTENT_DIR
from app.scheme_library.loader import load_schemes

schemes = {s.id: s for s in load_schemes(CONTENT_DIR)}
if len(sys.argv) != 2 or sys.argv[1] not in schemes:
    sys.exit(f"usage: python -m scripts.review_checksum <slug>; slugs: {', '.join(schemes)}")
scheme = schemes[sys.argv[1]]
print(scheme.checksum())
print("reviewed" if scheme.reviewed else "NOT reviewed", file=sys.stderr)
