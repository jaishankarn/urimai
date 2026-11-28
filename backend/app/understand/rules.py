"""Rule-based understanding of short spoken or typed replies, in Tamil, English and Tamil in English letters.

This converts what was said into what to type (number words to digits, a spoken date to a date, a spoken choice to
the list's option). It does not validate: lengths, formats and ranges are the website's to check, and the widget
passes the website's messages on.

No key is needed. The AI fallback (ai.py) is used only when these rules cannot parse a reply, and every value
it returns is passed back through these rules before use.
"""
import datetime as dt
import difflib
import re
import unicodedata

from app.contracts.handoff import Expecting, FieldInfo, Understanding

COMMANDS: dict[str, list[str]] = {
    "yes": ["yes", "yeah", "yep", "yup", "ya", "ok", "okay", "correct", "right", "sure", "fine", "haan", "ha",
            "that is right", "thats right", "it is right", "its right", "ஆமாம்", "ஆம்", "ஆமா", "சரி", "சரிதான்",
            "ஓகே", "சரியாக உள்ளது", "சரியா இருக்கு", "aamaa", "aama", "aamam", "aam", "sari", "seri", "sarithan",
            "correct than", "ok sari"],
    "no": ["no", "nope", "nah", "not correct", "wrong", "incorrect", "not right", "இல்லை", "இல்ல", "தவறு", "தப்பு",
           "வேண்டாம்", "சரியில்லை", "illa", "illai", "ille", "thappu", "thavaru", "vendam", "sariyilla"],
    "done": ["done", "finished", "completed", "complete", "i did it", "i have done it", "ok done", "uploaded",
             "typed", "ticked", "முடிந்தது", "முடிஞ்சது", "ஆச்சு", "முடிச்சாச்சு", "போட்டாச்சு", "செய்துவிட்டேன்",
             "பண்ணிட்டேன்", "mudinjathu", "mudinjadhu", "mudinthathu", "achu", "aachu", "pottachu", "panniten"],
    "repeat": ["repeat", "again", "say again", "say that again", "pardon", "once more", "repeat please",
               "மீண்டும்", "திரும்ப", "திரும்பச் சொல்லுங்கள்", "மறுபடியும்", "meendum", "thirumba", "marupadiyum"],
    "skip": ["skip", "skip it", "skip this", "later", "தவிர்", "விடுங்கள்", "அப்புறம்", "vidunga", "appuram"],
    "stop": ["stop", "cancel", "quit", "exit", "stop filling", "நிறுத்து", "நிறுத்துங்கள்", "போதும்", "niruthu",
             "nirutthu", "podhum", "pothum"],
    "back": ["back", "go back", "previous", "previous question", "பின்செல்", "முந்தைய", "பின்னாடி", "pinnadi",
             "munthaiya"],
    "help": ["what is this", "what is that", "explain", "help", "why", "what does it mean", "i dont understand",
             "இது என்ன", "என்ன இது", "புரியவில்லை", "புரியல", "ஏன்", "enna idhu", "idhu enna", "puriyala",
             "puriyavillai"],
}
# Leading words people add before a value ("my number is ...").
FILLERS = ["my name is", "my number is", "my mobile number is", "the number is", "my pin code is", "it is", "its",
           "it's", "this is", "i am", "i live in", "என் பெயர்", "என் எண்", "என் பெயர்", "பெயர்", "en peyar",
           "en per", "en number"]

UNITS = {
    "zero": 0, "oh": 0, "o": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "பூஜ்ஜியம்": 0, "பூஜ்யம்": 0, "சைபர்": 0, "ஒன்று": 1, "ஒண்ணு": 1, "இரண்டு": 2, "ரெண்டு": 2, "மூன்று": 3,
    "மூணு": 3, "நான்கு": 4, "நாலு": 4, "ஐந்து": 5, "அஞ்சு": 5, "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9,
    "பத்து": 10,
    "poojyam": 0, "saibar": 0, "onnu": 1, "ondru": 1, "rendu": 2, "irandu": 2, "moonu": 3, "moondru": 3,
    "naalu": 4, "nangu": 4, "anju": 5, "ainthu": 5, "aaru": 6, "ezhu": 7, "yezhu": 7, "ettu": 8, "onbadhu": 9,
    "onbathu": 9, "pathu": 10,
}
TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
        "ninety": 90}
ORDINALS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8,
            "ninth": 9, "tenth": 10, "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14,
            "fifteenth": 15, "sixteenth": 16, "seventeenth": 17, "eighteenth": 18, "nineteenth": 19,
            "twentieth": 20, "thirtieth": 30}
REPEATS = {"double": 2, "triple": 3}
MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3, "april": 4, "apr": 4, "may": 5,
    "june": 6, "jun": 6, "july": 7, "jul": 7, "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
    "ஜனவரி": 1, "பிப்ரவரி": 2, "மார்ச்": 3, "ஏப்ரல்": 4, "மே": 5, "ஜூன்": 6, "ஜூலை": 7, "ஆகஸ்ட்": 8,
    "ஆகஸ்டு": 8, "செப்டம்பர்": 9, "அக்டோபர்": 10, "நவம்பர்": 11, "டிசம்பர்": 12,
}
TAMIL_DIGITS = str.maketrans("௦௧௨௩௪௫௬௭௮௯", "0123456789")


def clean(text: str) -> str:
    """Lower case, Tamil digits to 0-9, punctuation to spaces (keeping @ . / - inside values), spaces collapsed."""
    text = unicodedata.normalize("NFC", text).translate(TAMIL_DIGITS).lower()
    text = text.replace("’", "'").replace("'", "")
    text = re.sub(r"[!?,;:\"()\[\]{}।…“”]+", " ", text)
    text = re.sub(r"(?<![\w@])\.|\.(?![\w])", " ", text)  # full stops that end a sentence
    return re.sub(r"\s+", " ", text).strip()


def _command(text: str, prefix: bool) -> tuple[str, str] | None:
    """(intent, rest) if the text is a command, or starts with one when prefix is True."""
    best = None
    for intent, phrases in COMMANDS.items():
        for phrase in phrases:
            if text == phrase:
                return intent, ""
            if prefix and text.startswith(phrase + " ") and (best is None or len(phrase) > len(best[2])):
                best = (intent, text[len(phrase) + 1:].strip(), phrase)
    return (best[0], best[1]) if best else None


def _strip_fillers(text: str) -> str:
    for filler in sorted(FILLERS, key=len, reverse=True):
        if text.startswith(filler + " "):
            return text[len(filler) + 1:].strip()
    return text


def spoken_digits(text: str) -> str | None:
    """'nine eight double four 0 1' -> '984401'. None if any word is not part of a number."""
    out, repeat = [], 1
    tokens = [t.lstrip("+") for t in re.findall(r"[^\s\-]+", text) if t.lstrip("+")]
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.isdigit():
            out.append(token * repeat if len(token) == 1 else token)
            repeat = 1
        elif token in REPEATS:
            repeat = REPEATS[token]
        elif token in UNITS:
            out.append(str(UNITS[token]) * repeat)
            repeat = 1
        elif token in TENS:
            value = TENS[token]
            if i + 1 < len(tokens) and tokens[i + 1] in UNITS and 0 < UNITS[tokens[i + 1]] < 10:
                value += UNITS[tokens[i + 1]]
                i += 1
            out.append(str(value))
        elif token in ("and", "plus", "+"):
            pass
        else:
            return None
        i += 1
    return "".join(out) or None


def spoken_number(text: str) -> int | None:
    """A single number such as 'fifty eight', '58', '14th' or 'twenty first'."""
    total, seen = 0, False
    for token in re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", text.strip()).split():
        value = int(token) if token.isdigit() else TENS.get(token, ORDINALS.get(token, UNITS.get(token)))
        if value is None:
            return None
        total, seen = total + value, True
    return total if seen else None


def parse_date(text: str, today: dt.date | None = None) -> dt.date | None:
    today = today or dt.date.today()
    text = clean(text).replace(" of ", " ")
    numeric = re.fullmatch(r"(\d{1,2})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{2}|\d{4})", text)
    iso = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if iso:
        y, m, d = int(iso[1]), int(iso[2]), int(iso[3])
    elif numeric:
        d, m, y = int(numeric[1]), int(numeric[2]), int(numeric[3])
    else:
        words = text.split()
        month_at = next((i for i, w in enumerate(words) if w in MONTHS), None)
        if month_at is None:
            return None
        m = MONTHS[words[month_at]]
        before, after = " ".join(words[:month_at]), words[month_at + 1:]
        if before:  # "14 march 1968"
            d = spoken_number(before)
            year_words = after
        else:       # "march 14 1968"
            if not after:
                return None
            d = spoken_number(after[0])
            year_words = after[1:]
        year_text = "".join(year_words) if all(w.isdigit() for w in year_words) else " ".join(year_words)
        if not year_text or d is None:
            return None
        y = int(year_text) if year_text.isdigit() else _spoken_year(year_text)
        if y is None:
            return None
    if y < 100:  # two-digit year: a birth date is in the past
        y += 2000 if 2000 + y <= today.year else 1900
    try:
        date = dt.date(y, m, d)
    except ValueError:
        return None
    return date  # whether the date is allowed (past, age limits) is the website's to say


def _spoken_year(text: str) -> int | None:
    """'nineteen sixty eight' -> 1968."""
    words = text.split()
    if len(words) >= 2 and words[0] in UNITS and UNITS[words[0]] >= 10:
        rest = spoken_number(" ".join(words[1:]))
        if rest is not None and rest < 100:
            return UNITS[words[0]] * 100 + rest
    return None


def format_date(date: dt.date, fmt: str | None) -> str:
    fmt = (fmt or "dd/mm/yyyy").lower()
    return fmt.replace("dd", f"{date.day:02d}").replace("mm", f"{date.month:02d}").replace("yyyy", f"{date.year}")


def _norm_option(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", unicodedata.normalize("NFC", text).lower())).strip()


def match_option(text: str, options: list[str], aliases: dict[str, list[str]] | None = None) -> str | None | list:
    """The option meant by the reply; a list of candidates if it is ambiguous; None if nothing matches."""
    said = _norm_option(text)
    if not said or not options:
        return None
    if len(said.split()) > 1 and all(len(w) == 1 for w in said.split()):  # "m b c" -> "mbc"
        said = said.replace(" ", "")
    names: list[tuple[str, str]] = [(_norm_option(o), o) for o in options]
    for key, words in (aliases or {}).items():
        # An alias key names an option exactly, or the code it starts with ("MBC" for "MBC – Most Backward Class").
        targets = [o for o in options if o == key] or [o for o in options if _norm_option(o).startswith(_norm_option(key) + " ")]
        for option in targets[:1]:
            names += [(_norm_option(key), option)] + [(_norm_option(w), option) for w in words]
    starts = {o for n, o in names if n.startswith(said + " ")}
    exact = {o for n, o in names if n == said or n.replace(" ", "") == said.replace(" ", "")}
    if len(exact) == 1:
        return exact.pop()
    if not exact and len(starts) == 1:  # "mbc" for "MBC – Most Backward Class"
        return starts.pop()
    contained = [(len(n), o) for n, o in names if n and re.search(rf"(?<!\w){re.escape(n)}(?!\w)", said)]
    if contained:
        longest = max(length for length, _ in contained)
        found = sorted({o for length, o in contained if length == longest})
        return found[0] if len(found) == 1 else found
    # Spelling slips only: every word must closely match, so "Madurai West" never becomes "Madurai East".
    def close(option: str) -> float:
        a, b = said.split(), option.split()
        if len(a) != len(b):
            return 0.0
        ratios = [difflib.SequenceMatcher(None, x, y).ratio() for x, y in zip(a, b)]
        return min(ratios) if min(ratios) >= 0.8 else 0.0
    scored = sorted(((close(n), o) for n, o in names if n), reverse=True)
    if scored and scored[0][0] > 0:
        close_ones = sorted({o for score, o in scored if score >= scored[0][0] - 0.02})
        return close_ones[0] if len(close_ones) == 1 else close_ones
    return None


def normalise(field: FieldInfo, text: str) -> tuple[str | None, str | None]:
    """(value, None) or (None, problem line key)."""
    text_in = text.translate(TAMIL_DIGITS)
    text = _strip_fillers(clean(text))
    if not text:
        return None, "not_understood"
    kind = field.kind or "text"
    if kind in ("digits", "mobile", "pincode"):
        digits = spoken_digits(text)
        if digits is None:
            return None, "not_understood"
        if kind == "mobile":  # a spoken country code or trunk zero is not part of the number people type
            if len(digits) == 12 and digits.startswith("91"):
                digits = digits[2:]
            elif len(digits) == 11 and digits.startswith("0"):
                digits = digits[1:]
        return digits, None
    if kind == "email":
        email = re.sub(r"\s+(at|அட்)\s+", "@", f" {text} ")
        email = re.sub(r"\s+(dot|புள்ளி|pulli)\s+", ".", email).replace(" ", "")
        return email, None
    if kind == "date":
        date = parse_date(text)
        return (date.isoformat(), None) if date else (None, "bad_date")
    if kind == "choice":
        found = match_option(text, field.options, field.aliases)
        if isinstance(found, str):
            return found, None
        return None, "ambiguous" if found else "not_in_list"
    if kind == "name_latin":
        letters = text.split()
        if len(letters) > 1 and all(len(w) == 1 for w in letters):  # spelt letter by letter
            text = "".join(letters)
        # A name in another script is passed on as said; the widget turns it into English letters when it can.
        return re.sub(r"\s+", " ", text).strip(" ."), None
    # Free text keeps the person's own letter case.
    original = re.sub(r"\s+", " ", unicodedata.normalize("NFC", text_in)).strip().strip(".!?।, ")
    for filler in sorted(FILLERS, key=len, reverse=True):
        if original.lower().startswith(filler + " "):
            original = original[len(filler) + 1:].strip()
            break
    return original or text, None


def understand(field: FieldInfo, expecting: Expecting, utterance: str) -> Understanding:
    text = clean(utterance)
    if not text:
        return Understanding(intent="unclear", problem="not_understood")
    if expecting == "confirm":
        found = _command(text, prefix=True)
        if found:
            intent, rest = found
            if intent == "no" and rest:  # "no, it is 9876543210"
                value, _ = normalise(field, rest)
                return Understanding(intent="no", value=value)
            if intent == "yes" and rest and _command(rest, prefix=True) and _command(rest, prefix=True)[0] == "no":
                return Understanding(intent="unclear", problem="not_understood")
            return Understanding(intent=intent)
        # A new value instead of yes or no is a correction.
        value, problem = normalise(field, utterance)
        return Understanding(intent="no", value=value) if value else Understanding(intent="unclear", problem=problem)
    found = _command(text, prefix=False)
    if expecting == "done":
        if found:
            return Understanding(intent="done" if found[0] == "yes" else found[0])
        return Understanding(intent="unclear", problem="not_understood")
    # expecting a value: a whole-reply command wins, except yes/no, which may be an option ("Yes" / "No").
    if found and found[0] not in ("yes", "no"):
        return Understanding(intent=found[0])
    value, problem = normalise(field, utterance)
    if value is not None:
        return Understanding(intent="value", value=value)
    if found:
        return Understanding(intent=found[0])
    return Understanding(intent="unclear", problem=problem)
