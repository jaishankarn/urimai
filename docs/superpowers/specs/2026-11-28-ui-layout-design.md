# UI layout: conversation and side panel, soft mint

Status: approved 28 Nov 2026. The mockups it was chosen from were throwaway and are not in the repo.

## Intent
The screens are a narrow centred column with a cream background and a lot of scrolling. Make the app use the whole screen: the person does everything on the left, and watches their details build up on the right, ending in suggested schemes. Due 30 Nov 2026, and it has to work on camera.

## Goals and limits
- Colours: see Themes below. The first plan was soft mint with the same green.
- Smaller type: body, messages and buttons 16px, headings 16 to 20px. 16px stays the floor, and tap targets stay at least 48px.
- On a wide screen (800px and up) the page does not scroll. Each panel scrolls on its own.
- Not in scope: new questions, rules, eligibility or AI behaviour; saving a conversation; new libraries; Hindi or Telugu.

## Approaches
- **A, conversation and side panel (picked):** shows talk and progress side by side. Medium work.
- **B, three columns:** shows everything at once, but crowded, narrow for Tamil, and the most work.
- **C, voice and current step:** least work, but no conversation history.

## Screens
- **First screen:** language and start buttons, restyled, fits without scrolling.
- **Left panel (48% wide):** consent, story, "what I understood", each question with its tap answers, then the confirm button. Earlier questions and replies stay above as a conversation. Microphone and typing box stay at the bottom.
- **Right panel, before confirming:** "Your details", grouped as About you, About your husband, and Household. A detail appears only once it is accepted. Details from the story appear after "Yes, this is right". "Change" asks that question again on the left.
- **Right panel, after confirming:** up to three suggestions, one open at a time. "See all results and sources" shows the full results in this panel, with the not-eligible ones collapsed. Documents open here too.
- **Phone (under 800px):** the two panels become tabs. It switches to Suggestions after confirming.
- **Tap journey (no key):** same layout, with answer buttons and no microphone. "Sarvam key not set" still shows.

## Product rules that must hold
- The consent text shows before anything is sent to Sarvam.
- Nothing is evaluated before confirming. Changing an answer clears the results until the person confirms again.
- An open suggestion shows all checks and source conflicts of its schemes, with sources and any "not yet reviewed" label. The no-guarantee line stays in view. Amounts are never added and nothing is called best.
- Only answers to visible questions are sent. The conversation is held in memory only. Only the colour choice is saved in the browser.

## Themes (added 28 Nov)
- Four themes: Lavender (default), Mint, Marigold with charcoal, Terracotta. Each has light and dark. Auto, the default, follows the device.
- Components use token names only; `index.css` gives each theme its values with `light-dark()`.
- Warnings stay amber and carry an icon; recording stays red with a stop icon and words.
- **Exception to "no browser storage":** only the theme and light or dark choice are saved. No answers or personal details. The app works when storage is blocked.

## Chat design (changed during the build)
The chat follows the form-widget design shared on 28 Nov: green header with a gold உ badge, a progress bar (in place of the top steps), each of Urimai's lines in both languages, a "Noted" tag, quick replies above a wide speak button, and a footnote on what Urimai never does. A slim typing box stays under the button. Up to four answers show as quick replies; longer lists stay in the conversation.

## Builder's calls (check these)
- The separate "Check your answers" screen goes; the right panel and the confirm button replace it.
- The tap journey also shows the top suggestions. Today only the voice journey does; the suggest call worked without a key.
- Conflicts, sources and review labels come from the full results, matched by each suggestion's scheme ids. No backend logic change.
- New screen text (panel, group and tab names) goes in both `en.yaml` and `ta.yaml`. The new Tamil is unchecked by a reader.
- Detail rows use short labels ("Age", "District"), added as `label_<question id>` lines in both languages.
- Look: Urimai design tokens in `index.css`, line icons, an உ badge. Noto Sans and Noto Sans Tamil ship with the app through the `@fontsource` font packages, so nothing loads from Google.
- On a phone the confirm button also sits under the details, so nobody confirms what they cannot see.
- Fix the narrow typing box in `Mic.tsx`.
- Keep the behaviour from the merged PR #9 review fixes: Back, edits after talking, late replies ignored, speech after leaving a step.
- Check with `pytest`, `npm run build`, and a browser click-through at 360px and 1280px, in both languages.
