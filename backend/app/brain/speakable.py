"""The only words the paid text-to-speech route will say: the app's own.

Without this, anyone with a public link could use the project's key to speak any text.
"""
from collections import OrderedDict

from app.contracts.content import Content

REMEMBERED = 600


def _saved(content: Content) -> set[str]:
    ui = content.ui
    texts = set(ui.values())
    for question in content.questions:
        texts.add(question.text)
        answers = [option.label for option in question.options or []] + [ui["dont_know"]]
        if question.type == "number":
            answers += [str(n) for n in range(question.min or 0, (question.max or 120) + 1)]
        for answer in answers:
            # These two shapes match what the screen reads back (journey/Talk.tsx).
            texts.add(f"{question.text} {answer}.")
            texts.add(f"{ui['last_answer']}: {answer}.")
    return texts


class Speakable:
    def __init__(self, lines: dict[str, Content]):
        self._saved = {lang: _saved(content) for lang, content in lines.items()}
        # Suggestion sentences are built from the rules when asked for. ponytail: in this one process only;
        # with several server processes this needs shared storage or signed text.
        self._written: OrderedDict[tuple[str, str], None] = OrderedDict()

    def remember(self, lang: str, texts: list[str]) -> None:
        for text in texts:
            self._written[(lang, text)] = None
            self._written.move_to_end((lang, text))
        while len(self._written) > REMEMBERED:
            self._written.popitem(last=False)

    def allows(self, lang: str, text: str) -> bool:
        return text in self._saved[lang] or (lang, text) in self._written
