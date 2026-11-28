import re
import unicodedata


def normalise(value: str) -> str:
    """One spelling for the search copy of text and for queries. Displayed text is never changed."""
    value = unicodedata.normalize("NFC", value)
    # Many converted Tamil documents type AA + virama where RA + virama is meant (அவா் for அவர்).
    value = value.replace("ா்", "ர்")
    return re.sub(r"\s+", " ", value).strip()
